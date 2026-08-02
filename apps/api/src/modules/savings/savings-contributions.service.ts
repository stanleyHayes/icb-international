import type { SavingsGoal } from '@icb/contracts';
import { isGreaterThan, type CurrencyCode, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { DomainError } from '../../common/errors/domain.error.js';
import { ConflictError, InsufficientFundsError, NotFoundError } from '../../common/errors/index.js';
import { newId, newReference } from '../../infrastructure/database/identifier.js';
import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { customerRef } from '../ledger/domain/account-ref.js';
import type { PostingCommand } from '../ledger/domain/posting.types.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { roundUpFor } from './domain/round-up.js';
import { toSavingsGoal } from './infrastructure/savings-goal.mapper.js';
import { SavingsContributionDoc, SavingsGoalDoc } from './infrastructure/savings-goal.schemas.js';

/** How a contribution came about. Stored on the record so a statement can explain itself. */
export type ContributionKind = 'manual' | 'round_up' | 'auto';

export interface ContributionCommand {
  readonly goal: SavingsGoalDoc;
  readonly customerId: string;
  readonly fromAccountId: string;
  readonly amount: Money;
  readonly kind: ContributionKind;
}

const ACHIEVED = 'achieved';
const ACTIVE = 'active';

/**
 * Money moving into a savings goal.
 *
 * A contribution is a real transfer, not a label: the funding account is debited and the goal's
 * savings account is credited in one balanced posting, and the contribution record carries the
 * id of that posting. "How much have I saved?" is therefore answered by summing records that
 * each point at a ledger transaction, rather than by trusting a counter someone remembered to
 * increment.
 */
@Injectable()
export class SavingsContributionsService {
  private readonly logger = new Logger(SavingsContributionsService.name);

  constructor(
    @InjectModel(SavingsContributionDoc.name)
    private readonly contributions: Model<SavingsContributionDoc>,
    @InjectModel(SavingsGoalDoc.name) private readonly goals: Model<SavingsGoalDoc>,
    private readonly accounts: AccountsService,
    private readonly ledger: LedgerService,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  /** Saved-to-date for many goals in one round trip, so a list response is a single query. */
  async savedFor(goalIds: readonly string[]): Promise<Map<string, number>> {
    if (goalIds.length === 0) {
      return new Map();
    }
    const rows = await this.contributions
      .aggregate<{ _id: string; total: number }>([
        { $match: { goalId: { $in: [...goalIds] } } },
        { $group: { _id: '$goalId', total: { $sum: '$minorUnits' } } },
      ])
      .exec();

    return new Map(rows.map((row) => [row._id, row.total]));
  }

  /** Saved-to-date for one goal. Takes the session so it can be read inside the posting. */
  async savedForOne(goalId: string, session?: ClientSession): Promise<number> {
    const rows = await this.contributions
      .aggregate<{ total: number }>(
        [{ $match: { goalId } }, { $group: { _id: null, total: { $sum: '$minorUnits' } } }],
        session ? { session } : {},
      )
      .exec();

    return rows[0]?.total ?? 0;
  }

  async countFor(goalId: string): Promise<number> {
    return this.contributions.countDocuments({ goalId });
  }

  /** A customer-initiated contribution. */
  async contribute(
    customerId: string,
    goal: SavingsGoalDoc,
    fromAccountId: string,
    amount: Money,
  ): Promise<SavingsGoal> {
    return this.deposit({ goal, customerId, fromAccountId, amount, kind: 'manual' });
  }

  /**
   * Sweep the change from a purchase into the customer's round-up goal.
   *
   * Best effort by design: no goal, no change, or not enough left in the account means the
   * purchase simply generates no sweep. A round-up must never be the reason an account goes
   * overdrawn, and it must never fail the transaction that triggered it.
   */
  async applyRoundUp(
    customerId: string,
    purchase: Money,
    fromAccountId: string,
  ): Promise<SavingsGoal | null> {
    const goal = await this.goals
      .findOne({ customerId, roundUpsEnabled: true, status: ACTIVE, currency: purchase.currency })
      .sort({ createdAt: 1 })
      .lean();

    const roundUp = roundUpFor(purchase);
    if (!goal || roundUp.minorUnits <= 0 || goal.accountId === fromAccountId) {
      return null;
    }

    const balances = await this.accounts.balancesFor(fromAccountId, purchase.currency);
    if (isGreaterThan(roundUp, balances.available)) {
      return null;
    }

    return this.deposit({ goal, customerId, fromAccountId, amount: roundUp, kind: 'round_up' });
  }

  /** Validate, move the money, record the contribution, and re-evaluate the goal. */
  private async deposit(command: ContributionCommand): Promise<SavingsGoal> {
    const { goal, amount } = command;
    this.assertContributable(command);

    const source = await this.accounts.loadSpendable(command.fromAccountId, command.customerId);
    this.assertCurrency(source.currency, goal.currency, amount.currency);

    const balances = await this.accounts.balancesFor(source._id, amount.currency as CurrencyCode);
    if (isGreaterThan(amount, balances.available)) {
      throw new InsufficientFundsError(source._id, amount, balances.available);
    }

    const saved = await this.transactionManager.withTransaction((session) =>
      this.postAndRecord(command, source.number, session),
    );

    this.logger.log(
      { goalId: goal._id, kind: command.kind, minorUnits: amount.minorUnits },
      'Savings contribution posted',
    );
    return this.reload(goal._id, saved);
  }

  private assertContributable(command: ContributionCommand): void {
    const { goal } = command;
    if (goal.status !== ACTIVE && goal.status !== ACHIEVED) {
      throw new ConflictError('This goal is not accepting contributions', {
        goalId: goal._id,
        status: goal.status,
      });
    }
    if (goal.accountId === command.fromAccountId) {
      throw new ConflictError('A goal cannot be funded from the account that holds it', {
        goalId: goal._id,
      });
    }
  }

  /** One unit of work: the balanced posting, the contribution record, and the achieved flag. */
  private async postAndRecord(
    command: ContributionCommand,
    sourceNumber: string,
    session: ClientSession,
  ): Promise<number> {
    const posted = await this.ledger.postWithin(this.buildPosting(command, sourceNumber), session);
    await this.recordContribution(command, posted.id, session);

    const saved = await this.savedForOne(command.goal._id, session);
    await this.markAchieved(command.goal, saved, session);
    return saved;
  }

  /** Debit the funding account, credit the account the goal is held in. Nothing else. */
  private buildPosting(command: ContributionCommand, sourceNumber: string): PostingCommand {
    const { goal, amount } = command;
    const narrative = `Saved to ${goal.name}`;

    return {
      type: 'transfer_out',
      description: narrative,
      actor: { kind: 'customer', id: command.customerId, label: sourceNumber },
      reference: newReference('SAV'),
      sourceType: 'savings_goal',
      sourceId: goal._id,
      metadata: { goalId: goal._id, contributionKind: command.kind },
      lines: [
        { accountRef: customerRef(command.fromAccountId), direction: 'debit', amount, narrative },
        {
          accountRef: customerRef(goal.accountId),
          direction: 'credit',
          amount,
          narrative: `From ${sourceNumber}`,
        },
      ],
    };
  }

  private async recordContribution(
    command: ContributionCommand,
    transactionId: string,
    session: ClientSession,
  ): Promise<void> {
    await this.contributions.create(
      [
        {
          _id: newId(),
          goalId: command.goal._id,
          customerId: command.customerId,
          fromAccountId: command.fromAccountId,
          minorUnits: command.amount.minorUnits,
          currency: command.amount.currency,
          kind: command.kind,
          transactionId,
          createdAt: this.clock.now(),
        },
      ],
      { session, ordered: true },
    );
  }

  /** A goal is achieved the moment its balance reaches the target, not when someone looks. */
  private async markAchieved(
    goal: SavingsGoalDoc,
    saved: number,
    session: ClientSession,
  ): Promise<void> {
    if (saved < goal.targetMinorUnits || goal.status === ACHIEVED) {
      return;
    }
    await this.goals.updateOne(
      { _id: goal._id },
      { $set: { status: ACHIEVED, achievedAt: this.clock.now() } },
      { session },
    );
  }

  private assertCurrency(account: string, goal: string, amount: string): void {
    if (account === goal && goal === amount) {
      return;
    }
    throw new DomainError(
      'ACCOUNT_CURRENCY_MISMATCH',
      'A contribution must be in the currency of both accounts',
      { context: { accountCurrency: account, goalCurrency: goal, amountCurrency: amount } },
    );
  }

  private async reload(goalId: string, saved: number): Promise<SavingsGoal> {
    const goal = await this.goals.findById(goalId).lean();
    if (!goal) {
      throw new NotFoundError('Savings goal', goalId);
    }
    return toSavingsGoal(goal, saved, this.clock.today());
  }
}
