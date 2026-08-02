import type { CardAuthorisation, TransactionType } from '@icb/contracts';
import { fromMinorUnits, type CurrencyCode, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { ConflictError, DomainError, NotFoundError } from '../../../common/errors/index.js';
import { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { customerRef, glRef } from '../../ledger/domain/account-ref.js';
import { GL_CARD_SETTLEMENT } from '../../ledger/domain/chart-of-accounts.js';
import type { PostingLine } from '../../ledger/domain/posting.types.js';
import { HoldService } from '../../ledger/hold.service.js';
import { LedgerService } from '../../ledger/ledger.service.js';
import { CardAuthorisationDoc } from '../infrastructure/card-authorisation.schemas.js';
import { toCardAuthorisation } from '../infrastructure/card.mapper.js';

const APPROVED = 'approved';
const AUTHORISATION = 'Card authorisation';

/**
 * Settlement: what happens after the terminal has already said yes.
 *
 * A capture does two things that must not come apart — it releases the reservation on the
 * customer's balance and it posts the real money movement — so both happen inside one database
 * transaction. Release without posting means the customer gets the money back and the merchant
 * still gets paid; posting without release double-counts the spend until the hold expires.
 *
 * Partial capture is the normal case, not an edge case: a restaurant authorises for the bill plus
 * a tip allowance and claims less, a fuel pump authorises a nominal amount and claims the fill.
 */
@Injectable()
export class CardCaptureService {
  private readonly logger = new Logger(CardCaptureService.name);

  constructor(
    @InjectModel(CardAuthorisationDoc.name)
    private readonly authorisations: Model<CardAuthorisationDoc>,
    private readonly ledger: LedgerService,
    private readonly holds: HoldService,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  /**
   * Claim an authorised amount. `capturedMinorUnits` may be less than authorised but never more —
   * a merchant that wants more money needs a new authorisation.
   */
  async capture(authorisationId: string, capturedMinorUnits?: number): Promise<CardAuthorisation> {
    const authorisation = await this.loadApproved(authorisationId);
    const captured = capturedMinorUnits ?? authorisation.minorUnits;
    assertCapturable(authorisation, captured);

    const currency = authorisation.currency as CurrencyCode;
    const amount = fromMinorUnits(captured, currency);
    const capturedAt = this.clock.now();

    await this.transactionManager.withTransaction(async (session) => {
      await this.releaseHold(authorisation, 'Card authorisation captured', session);
      const posted = await this.post(authorisation, amount, session);

      await this.authorisations.updateOne(
        { _id: authorisationId, status: APPROVED },
        {
          $set: {
            status: 'captured',
            capturedMinorUnits: captured,
            billingMinorUnits: captured,
            capturedAt,
            transactionId: posted.id,
          },
        },
        { session },
      );
    });

    this.logger.log({ authorisationId, capturedMinorUnits: captured }, 'Card authorisation captured');
    return this.reload(authorisationId);
  }

  /**
   * The merchant abandoned the sale. The reservation goes back to the customer and nothing is
   * posted — a reversal of an authorisation that never settled is not a ledger event, and writing
   * one would put a pair of meaningless lines on the statement.
   */
  async reverse(authorisationId: string): Promise<CardAuthorisation> {
    const authorisation = await this.loadApproved(authorisationId);
    const reversedAt = this.clock.now();

    await this.transactionManager.withTransaction(async (session) => {
      await this.releaseHold(authorisation, 'Card authorisation reversed', session);
      await this.authorisations.updateOne(
        { _id: authorisationId, status: APPROVED },
        { $set: { status: 'reversed', reversedAt } },
        { session },
      );
    });

    this.logger.log({ authorisationId }, 'Card authorisation reversed');
    return this.reload(authorisationId);
  }

  /**
   * Debit the customer and credit card settlement receivable (GL 1200): the customer's money has
   * left, and the bank now owes it onward to the acquirer.
   */
  private async post(
    authorisation: CardAuthorisationDoc,
    amount: Money,
    session: ClientSession,
  ): Promise<{ id: string }> {
    const lines: PostingLine[] = [
      {
        accountRef: customerRef(authorisation.accountId),
        direction: 'debit',
        amount,
        narrative: authorisation.merchantName,
      },
      {
        accountRef: glRef(GL_CARD_SETTLEMENT),
        direction: 'credit',
        amount,
        narrative: `Card settlement ${authorisation.arn ?? authorisation._id}`,
      },
    ];

    return this.ledger.postWithin(
      {
        type: transactionTypeFor(authorisation.channel),
        description: authorisation.merchantName,
        actor: { kind: 'system', id: null, label: 'Card network' },
        lines,
        sourceType: 'card',
        sourceId: authorisation.cardId,
        metadata: {
          authorisationId: authorisation._id,
          arn: authorisation.arn ?? '',
          mcc: authorisation.mcc,
        },
      },
      session,
    );
  }

  private async releaseHold(
    authorisation: CardAuthorisationDoc,
    reason: string,
    session: ClientSession,
  ): Promise<void> {
    if (authorisation.holdId) {
      await this.holds.release(authorisation.holdId, reason, session);
    }
  }

  private async loadApproved(authorisationId: string): Promise<CardAuthorisationDoc> {
    const authorisation = await this.authorisations.findById(authorisationId).lean();
    if (!authorisation) {
      throw new NotFoundError(AUTHORISATION, authorisationId);
    }
    if (authorisation.status !== APPROVED) {
      throw new ConflictError(`This authorisation is ${authorisation.status}`, {
        authorisationId,
        status: authorisation.status,
      });
    }
    return authorisation;
  }

  private async reload(authorisationId: string): Promise<CardAuthorisation> {
    const authorisation = await this.authorisations.findById(authorisationId).lean();
    if (!authorisation) {
      throw new NotFoundError(AUTHORISATION, authorisationId);
    }
    return toCardAuthorisation(authorisation);
  }
}

function assertCapturable(authorisation: CardAuthorisationDoc, captured: number): void {
  if (!Number.isInteger(captured) || captured <= 0) {
    throw new DomainError('VALIDATION_FAILED', 'A capture must be a positive whole minor amount');
  }
  if (captured > authorisation.minorUnits) {
    throw new ConflictError('A capture cannot exceed the authorised amount', {
      authorisedMinorUnits: authorisation.minorUnits,
      capturedMinorUnits: captured,
    });
  }
}

/** An ATM authorisation settles as a cash withdrawal; everything else as a purchase. */
function transactionTypeFor(channel: string): TransactionType {
  return channel === 'atm' ? 'atm_withdrawal' : 'card_purchase';
}
