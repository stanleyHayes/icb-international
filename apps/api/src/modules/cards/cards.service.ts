import type {
  CardDetail,
  CardSummary,
  CursorPage,
  IssueCardRequest,
  ReportCardRequest,
  updateCardRequestSchema,
} from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError } from '../../common/errors/index.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { CardIssuanceService } from './application/card-issuance.service.js';
import { CardReader, type CardQuery } from './application/card-reader.js';
import { INITIAL_STATUS } from './domain/card-defaults.js';
import { assertCardAmendable, CARD_ACTIVE, statusAfterFreeze } from './domain/card-state.js';
import { CardDoc } from './infrastructure/card.schemas.js';

export type UpdateCardRequest = ReturnType<typeof updateCardRequestSchema.parse>;

/** Which state a report leaves the card in. Fraud is treated as theft, because it is. */
const REPORT_STATUS: Readonly<Record<ReportCardRequest['reason'], string>> = {
  lost: 'lost',
  stolen: 'stolen',
  fraud: 'stolen',
  damaged: 'cancelled',
  not_received: 'cancelled',
};

/**
 * The card lifecycle a customer drives: issue, activate, freeze, report, cancel.
 *
 * Reporting a card is the operation worth reading twice. It is irreversible by design — a card
 * someone has told the bank was stolen must never come back — and it is the only path that mints a
 * replacement, linked to its predecessor so that support can follow the chain without guessing.
 */
@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    @InjectModel(CardDoc.name) private readonly cards: Model<CardDoc>,
    private readonly reader: CardReader,
    private readonly issuance: CardIssuanceService,
    private readonly clock: ClockService,
  ) {}

  async list(customerId: string, query: CardQuery): Promise<CursorPage<CardSummary>> {
    return this.reader.list(customerId, query);
  }

  async detail(cardId: string, customerId: string): Promise<CardDetail> {
    return this.reader.detailOwned(cardId, customerId);
  }

  async issue(customerId: string, request: IssueCardRequest): Promise<CardDetail> {
    return this.issuance.issue(customerId, request);
  }

  /** Nickname, freeze and contactless in one place, because the app edits them from one screen. */
  async update(
    cardId: string,
    customerId: string,
    request: UpdateCardRequest,
  ): Promise<CardDetail> {
    const card = await this.reader.loadOwned(cardId, customerId);
    assertCardAmendable(card);

    const update: Record<string, unknown> = {};
    if (request.nickname !== undefined) {
      update['nickname'] = request.nickname;
    }
    if (request.contactlessEnabled !== undefined) {
      update['contactlessEnabled'] = request.contactlessEnabled;
    }
    if (request.frozen !== undefined) {
      update['frozen'] = request.frozen;
      update['status'] = statusAfterFreeze(card.activatedAt, request.frozen);
    }

    if (Object.keys(update).length > 0) {
      await this.cards.updateOne({ _id: card._id }, { $set: update });
    }
    return this.reader.detailOwned(cardId, customerId);
  }

  async setFrozen(cardId: string, customerId: string, frozen: boolean): Promise<CardDetail> {
    return this.update(cardId, customerId, { frozen });
  }

  /** Activation is the customer confirming the card reached them. Only an issued card can take it. */
  async activate(cardId: string, customerId: string): Promise<CardDetail> {
    const card = await this.reader.loadOwned(cardId, customerId);
    assertCardAmendable(card);

    if (card.status !== INITIAL_STATUS) {
      throw new ConflictError('Only a newly issued card can be activated', {
        cardId,
        status: card.status,
      });
    }

    await this.cards.updateOne(
      { _id: card._id },
      { $set: { status: CARD_ACTIVE, activatedAt: this.clock.now(), frozen: false } },
    );

    this.logger.log({ cardId }, 'Card activated');
    return this.reader.detailOwned(cardId, customerId);
  }

  async cancel(cardId: string, customerId: string, reason: string): Promise<CardDetail> {
    const card = await this.reader.loadOwned(cardId, customerId);
    assertCardAmendable(card);

    await this.cards.updateOne(
      { _id: card._id },
      {
        $set: {
          status: 'cancelled',
          frozen: true,
          cancelledAt: this.clock.now(),
          cancellationReason: reason,
        },
      },
    );

    this.logger.log({ cardId, reason }, 'Card cancelled');
    return this.reader.detailOwned(cardId, customerId);
  }

  /**
   * Report a card and, unless the customer declines it, replace it. The returned detail is the
   * *replacement* when one was minted, because that is the card the customer now needs to see.
   */
  async report(
    cardId: string,
    customerId: string,
    request: ReportCardRequest,
  ): Promise<CardDetail> {
    const card = await this.reader.loadOwned(cardId, customerId);
    assertCardAmendable(card);
    await this.markReported(card, request);

    if (!request.reissue) {
      return this.reader.detailOwned(cardId, customerId);
    }

    const replacement = await this.issuance.reissue(card);
    // The replacement inherits the controls and limits the customer had already tuned; it does
    // not inherit the PIN, which must be set again on the new card.
    await this.cards.updateOne(
      { _id: replacement._id },
      { $set: { controls: card.controls, limits: card.limits } },
    );
    await this.cards.updateOne({ _id: card._id }, { $set: { replacedByCardId: replacement._id } });

    this.logger.log({ cardId, replacementId: replacement._id }, 'Card reported and replaced');
    return this.reader.detailOwned(replacement._id, customerId);
  }

  private async markReported(card: CardDoc, request: ReportCardRequest): Promise<void> {
    const status = REPORT_STATUS[request.reason];
    const reportedAt = this.clock.now();

    await this.cards.updateOne(
      { _id: card._id },
      {
        $set: {
          status,
          frozen: true,
          reportedReason: request.detail ? `${request.reason}: ${request.detail}` : request.reason,
          reportedAt,
          cancelledAt: status === 'cancelled' ? reportedAt : null,
        },
      },
    );
  }
}
