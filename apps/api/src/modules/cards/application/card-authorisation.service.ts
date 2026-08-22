import type { CardAuthorisation, CardChannel, MoneyDto, TransactionCategory } from '@icb/contracts';
import { fromMinorUnits, isGreaterThan, type CurrencyCode, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { DomainError, InsufficientFundsError } from '../../../common/errors/index.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { AccountsService } from '../../accounts/accounts.service.js';
import { customerRef } from '../../ledger/domain/account-ref.js';
import { balanceKey } from '../../ledger/domain/balance-key.js';
import { HoldService } from '../../ledger/hold.service.js';
import {
  evaluateAuthorisation,
  type AuthorisationContext,
  type AuthorisationDecline,
} from '../domain/authorisation-rules.js';
import { generateArn } from '../domain/card-numbers.js';
import { toDeclineError } from '../domain/decline-error.js';
import { assertCardUsable } from '../domain/card-state.js';
import { categoryForMcc } from '../domain/mcc.js';
import { CardAuthorisationDoc } from '../infrastructure/card-authorisation.schemas.js';
import { toCardAuthorisation } from '../infrastructure/card.mapper.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';
import { CardReader } from './card-reader.js';

/** A message from the simulated card network. */
export interface AuthoriseCardCommand {
  readonly merchantName: string;
  readonly mcc: string;
  readonly amount: MoneyDto;
  readonly channel: CardChannel;
  readonly country: string | null;
}

interface AuthorisationRecord {
  readonly id: string;
  readonly card: CardDoc;
  readonly command: AuthoriseCardCommand;
  readonly category: TransactionCategory;
  readonly status: string;
  readonly declineReason: string | null;
  readonly arn: string | null;
  readonly holdId: string | null;
  readonly authorisedAt: Date;
  readonly expiresAt: Date;
}

export const HOLD_REASON = 'Card authorisation';
export const AUTHORISATION_SOURCE = 'card_authorisation';
/** Seven days, matching the window the card networks give a merchant to claim the money. */
export const AUTHORISATION_EXPIRY_MS = 7 * 86_400_000;

const APPROVED = 'approved';
const DECLINED = 'declined';

/**
 * The authorisation half of the card lifecycle.
 *
 * The order of operations is the point of this class. Controls and limits are evaluated *before*
 * any money is reserved, a decline is written to the log whether or not it succeeded, and the hold
 * and the authorisation record commit in one transaction — so there is no window in which a
 * customer's balance is reserved against an authorisation that does not exist, or vice versa.
 */
@Injectable()
export class CardAuthorisationService {
  private readonly logger = new Logger(CardAuthorisationService.name);

  constructor(
    @InjectModel(CardAuthorisationDoc.name)
    private readonly authorisations: Model<CardAuthorisationDoc>,
    private readonly reader: CardReader,
    private readonly accounts: AccountsService,
    private readonly holds: HoldService,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  async authorise(cardId: string, command: AuthoriseCardCommand): Promise<CardAuthorisation> {
    const card = await this.reader.loadById(cardId);
    const now = this.clock.now();
    assertCardUsable(card, now);

    const currency = card.currency as CurrencyCode;
    if (command.amount.currency !== currency) {
      throw new DomainError(
        'ACCOUNT_CURRENCY_MISMATCH',
        'This card cannot be billed in that currency',
        {
          context: { cardCurrency: currency, requested: command.amount.currency },
        },
      );
    }

    const context = await this.buildContext(card, command, now);
    const decline = evaluateAuthorisation(context);
    if (decline) {
      await this.declineAndThrow(card, command, context, decline, now);
    }

    const amount = fromMinorUnits(command.amount.minorUnits, currency);
    await this.assertFunds(card, command, context, amount, now);
    return this.approve(card, command, context, amount, now);
  }

  /** Every input the decision needs, gathered once so the rules stay pure. */
  private async buildContext(
    card: CardDoc,
    command: AuthoriseCardCommand,
    now: Date,
  ): Promise<AuthorisationContext> {
    const window = await this.reader.spendWindow(card._id);
    const travelling =
      card.travelNoticeUntil !== null &&
      card.travelNoticeUntil.getTime() >= now.getTime() &&
      (card.travelNoticeFrom === null || card.travelNoticeFrom.getTime() <= now.getTime());

    return {
      // The card-level contactless switch is folded into the channel controls so that the toggle
      // the customer sees on the card itself actually declines a tap, rather than only the one
      // buried in the controls screen.
      controls: {
        ...card.controls,
        channels: {
          ...card.controls.channels,
          contactless: card.controls.channels.contactless && card.contactlessEnabled,
        },
      },
      limits: card.limits,
      channel: command.channel,
      category: categoryForMcc(command.mcc),
      country: command.country,
      homeCountry: card.issuingCountry,
      travelCountries: travelling ? card.travelCountries : [],
      amountMinorUnits: command.amount.minorUnits,
      spentTodayMinorUnits: window.todayMinorUnits,
      spentMonthMinorUnits: window.monthMinorUnits,
      atmTodayMinorUnits: window.atmTodayMinorUnits,
    };
  }

  /** A declined authorisation is still an authorisation: it is logged, then it is raised. */
  private async declineAndThrow(
    card: CardDoc,
    command: AuthoriseCardCommand,
    context: AuthorisationContext,
    decline: AuthorisationDecline,
    now: Date,
  ): Promise<never> {
    await this.write({
      ...this.baseRecord(card, command, context, now),
      status: DECLINED,
      declineReason: decline.reason,
      arn: null,
      holdId: null,
    });

    this.logger.log({ cardId: card._id, reason: decline.reason }, 'Card authorisation declined');
    throw toDeclineError(card, decline);
  }

  private async assertFunds(
    card: CardDoc,
    command: AuthoriseCardCommand,
    context: AuthorisationContext,
    amount: Money,
    now: Date,
  ): Promise<void> {
    const balances = await this.accounts.balancesFor(card.accountId, amount.currency);
    if (!isGreaterThan(amount, balances.available)) {
      return;
    }

    await this.write({
      ...this.baseRecord(card, command, context, now),
      status: DECLINED,
      declineReason: 'Insufficient funds',
      arn: null,
      holdId: null,
    });
    throw new InsufficientFundsError(card.accountId, amount, balances.available);
  }

  /** Reserve the money and record the approval together, or do neither. */
  private async approve(
    card: CardDoc,
    command: AuthoriseCardCommand,
    context: AuthorisationContext,
    amount: Money,
    now: Date,
  ): Promise<CardAuthorisation> {
    const id = newId();
    const base = this.baseRecord(card, command, context, now, id);

    const accountRef = customerRef(card.accountId);

    const created = await this.transactionManager.withTransaction(
      async (session) => {
        const hold = await this.holds.placeWithin(
          {
            accountRef,
            amount,
            reason: HOLD_REASON,
            expiresInMs: AUTHORISATION_EXPIRY_MS,
            sourceType: AUTHORISATION_SOURCE,
            sourceId: id,
          },
          session,
        );

        return this.write(
          {
            ...base,
            status: APPROVED,
            declineReason: null,
            arn: generateArn(now),
            holdId: hold.id,
          },
          session,
        );
      },
      // A terminal that retries and a customer paying on the same account at once both land on
      // this balance. Queueing on it is what stops one of the two authorisations vanishing.
      { lockKeys: [balanceKey(accountRef, amount.currency)] },
    );

    this.logger.log({ cardId: card._id, authorisationId: id }, 'Card authorisation approved');
    return toCardAuthorisation(created);
  }

  private baseRecord(
    card: CardDoc,
    command: AuthoriseCardCommand,
    context: AuthorisationContext,
    now: Date,
    id: string = newId(),
  ): Omit<AuthorisationRecord, 'status' | 'declineReason' | 'arn' | 'holdId'> {
    return {
      id,
      card,
      command,
      category: context.category,
      authorisedAt: now,
      expiresAt: new Date(now.getTime() + AUTHORISATION_EXPIRY_MS),
    };
  }

  private async write(
    record: AuthorisationRecord,
    session?: ClientSession,
  ): Promise<CardAuthorisationDoc> {
    const { card, command } = record;
    const [created] = await this.authorisations.create(
      [
        {
          _id: record.id,
          cardId: card._id,
          customerId: card.customerId,
          accountId: card.accountId,
          merchantName: command.merchantName,
          mcc: command.mcc,
          category: record.category,
          channel: command.channel,
          country: command.country,
          minorUnits: command.amount.minorUnits,
          billingMinorUnits: command.amount.minorUnits,
          capturedMinorUnits: null,
          currency: card.currency,
          status: record.status,
          declineReason: record.declineReason,
          arn: record.arn,
          holdId: record.holdId,
          transactionId: null,
          authorisedAt: record.authorisedAt,
          expiresAt: record.expiresAt,
          capturedAt: null,
          reversedAt: null,
        },
      ],
      session ? { session, ordered: true } : { ordered: true },
    );

    if (!created) {
      throw new DomainError('INTERNAL_ERROR', 'The authorisation could not be recorded');
    }
    return created;
  }
}
