import {
  contributeToGoalRequestSchema,
  updateSavingsGoalRequestSchema,
  type CreateSavingsGoalRequest,
  type SavingsGoal,
} from '@icb/contracts';
import { fromMinorUnits } from '@icb/money';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../common/errors/domain.error.js';
import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { nextContributionDate, type ContributionFrequency } from './domain/goal-maths.js';
import { toSavingsGoal } from './infrastructure/savings-goal.mapper.js';
import type { AutoContributionRecord } from './infrastructure/savings-goal.schemas.js';
import { SavingsGoalDoc } from './infrastructure/savings-goal.schemas.js';
import { SavingsContributionsService } from './savings-contributions.service.js';

/** Request shapes derived from the contract schemas rather than restated here. */
export type UpdateSavingsGoalRequest = ReturnType<typeof updateSavingsGoalRequestSchema.parse>;
export type ContributeToGoalRequest = ReturnType<typeof contributeToGoalRequestSchema.parse>;
type AutoContributionRequest = NonNullable<CreateSavingsGoalRequest['autoContribution']>;

const CANCELLED = 'cancelled';

/**
 * Savings goals.
 *
 * A goal is an intention laid over a real account: it never holds money of its own, it points at
 * the account that does. That is why deleting a goal that has taken contributions cancels it
 * rather than erasing it — the money moved, and the record of why must survive the customer
 * changing their mind.
 */
@Injectable()
export class SavingsGoalsService {
  constructor(
    @InjectModel(SavingsGoalDoc.name) private readonly goals: Model<SavingsGoalDoc>,
    private readonly contributions: SavingsContributionsService,
    private readonly accounts: AccountsService,
    private readonly clock: ClockService,
  ) {}

  async create(customerId: string, request: CreateSavingsGoalRequest): Promise<SavingsGoal> {
    const account = await this.accounts.loadSpendable(request.accountId, customerId);
    this.assertCurrency(account.currency, request.target.currency);

    const autoContribution = await this.buildAutoContribution(
      customerId,
      request.autoContribution,
      account.currency,
    );

    const [created] = await this.goals.create([
      {
        _id: newId(),
        customerId,
        accountId: account._id,
        name: request.name,
        icon: request.icon,
        targetMinorUnits: request.target.minorUnits,
        currency: account.currency,
        targetDate: request.targetDate ?? null,
        roundUpsEnabled: request.roundUpsEnabled,
        autoContribution,
        status: 'active',
        createdAt: this.clock.now(),
        achievedAt: null,
      },
    ]);

    if (!created) {
      throw new ConflictError('The savings goal could not be created');
    }
    return toSavingsGoal(created, 0, this.clock.today());
  }

  async list(customerId: string): Promise<SavingsGoal[]> {
    const goals = await this.goals
      .find({ customerId, status: { $ne: CANCELLED } })
      .sort({ createdAt: 1 })
      .lean();

    const saved = await this.contributions.savedFor(goals.map((goal) => goal._id));
    const today = this.clock.today();

    return goals.map((goal) => toSavingsGoal(goal, saved.get(goal._id) ?? 0, today));
  }

  async get(customerId: string, goalId: string): Promise<SavingsGoal> {
    const goal = await this.loadGoal(customerId, goalId);
    const saved = await this.contributions.savedForOne(goalId);
    return toSavingsGoal(goal, saved, this.clock.today());
  }

  async update(
    customerId: string,
    goalId: string,
    patch: UpdateSavingsGoalRequest,
  ): Promise<SavingsGoal> {
    const goal = await this.loadGoal(customerId, goalId);
    const update = await this.buildUpdate(customerId, goal, patch);

    if (Object.keys(update).length > 0) {
      await this.goals.updateOne({ _id: goalId, customerId }, { $set: update });
    }
    return this.get(customerId, goalId);
  }

  /**
   * Delete a goal.
   *
   * A goal that never took a contribution is removed outright. One that did is cancelled instead:
   * its contributions each reference a ledger transaction, and orphaning those records would
   * leave money in an account with nothing to explain how it got there.
   */
  async remove(customerId: string, goalId: string): Promise<void> {
    const goal = await this.loadGoal(customerId, goalId);

    if ((await this.contributions.countFor(goal._id)) === 0) {
      await this.goals.deleteOne({ _id: goal._id, customerId });
      return;
    }
    await this.goals.updateOne({ _id: goal._id, customerId }, { $set: { status: CANCELLED } });
  }

  async contribute(
    customerId: string,
    goalId: string,
    request: ContributeToGoalRequest,
  ): Promise<SavingsGoal> {
    const goal = await this.loadGoal(customerId, goalId);
    const amount = fromMinorUnits(request.amount.minorUnits, request.amount.currency);
    return this.contributions.contribute(customerId, goal, request.fromAccountId, amount);
  }

  private async buildUpdate(
    customerId: string,
    goal: SavingsGoalDoc,
    patch: UpdateSavingsGoalRequest,
  ): Promise<Record<string, unknown>> {
    const update: Record<string, unknown> = {};

    if (patch.name !== undefined) update['name'] = patch.name;
    if (patch.icon !== undefined) update['icon'] = patch.icon;
    if (patch.roundUpsEnabled !== undefined) update['roundUpsEnabled'] = patch.roundUpsEnabled;
    if (patch.status !== undefined) update['status'] = patch.status;
    if (patch.targetDate !== undefined) update['targetDate'] = patch.targetDate;
    if (patch.target !== undefined) {
      this.assertCurrency(goal.currency, patch.target.currency);
      update['targetMinorUnits'] = patch.target.minorUnits;
    }
    if (patch.autoContribution !== undefined) {
      update['autoContribution'] = await this.buildAutoContribution(
        customerId,
        patch.autoContribution,
        goal.currency,
      );
    }
    return update;
  }

  /** Standing instructions are validated the same way a one-off contribution is. */
  private async buildAutoContribution(
    customerId: string,
    request: AutoContributionRequest | undefined,
    goalCurrency: string,
  ): Promise<AutoContributionRecord | null> {
    if (!request) {
      return null;
    }
    const source = await this.accounts.loadSpendable(request.fromAccountId, customerId);
    this.assertCurrency(goalCurrency, request.amount.currency);
    this.assertCurrency(goalCurrency, source.currency);

    return {
      amountMinorUnits: request.amount.minorUnits,
      frequency: request.frequency,
      nextRunOn: nextContributionDate(
        request.frequency as ContributionFrequency,
        this.clock.today(),
      ),
      fromAccountId: source._id,
    };
  }

  /** Loads a goal the customer actually owns. Ownership is the query, never a later comparison. */
  async loadGoal(customerId: string, goalId: string): Promise<SavingsGoalDoc> {
    const goal = await this.goals.findOne({ _id: goalId, customerId }).lean();
    if (!goal) {
      throw new NotFoundError('Savings goal', goalId);
    }
    return goal;
  }

  private assertCurrency(expected: string, actual: string): void {
    if (expected === actual) {
      return;
    }
    throw new DomainError(
      'ACCOUNT_CURRENCY_MISMATCH',
      'The amount must be in the same currency as the account holding the goal',
      { context: { expected, actual } },
    );
  }
}
