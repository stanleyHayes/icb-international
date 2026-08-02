import type { SavingsGoal } from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import { computeGoalProgress, type ContributionFrequency } from '../domain/goal-maths.js';
import type { AutoContributionRecord, SavingsGoalDoc } from './savings-goal.schemas.js';

/**
 * Persistence → contract.
 *
 * `saved` arrives as a parameter rather than being read off the document: the total is derived
 * from the contribution ledger, and the mapper is where that derived figure meets the stored
 * contract terms. Progress, the required monthly amount and the on-track flag are computed here
 * from the same inputs, so a list response and a single-goal response can never disagree.
 */

function toAutoContribution(
  record: AutoContributionRecord,
  currency: string,
): NonNullable<SavingsGoal['autoContribution']> {
  return {
    amount: toMoneyDto(record.amountMinorUnits, currency),
    frequency: record.frequency as ContributionFrequency,
    nextRunOn: record.nextRunOn,
    fromAccountId: record.fromAccountId,
  };
}

export function toSavingsGoal(
  goal: SavingsGoalDoc,
  savedMinorUnits: number,
  today: string,
): SavingsGoal {
  const progress = computeGoalProgress({
    targetMinorUnits: goal.targetMinorUnits,
    savedMinorUnits,
    startedOn: goal.createdAt.toISOString().slice(0, 10),
    today,
    targetDate: goal.targetDate,
  });

  return {
    id: goal._id,
    accountId: goal.accountId,
    name: goal.name,
    icon: goal.icon,
    target: toMoneyDto(goal.targetMinorUnits, goal.currency),
    saved: toMoneyDto(savedMinorUnits, goal.currency),
    progress: progress.progress,
    targetDate: goal.targetDate,
    requiredMonthly:
      progress.requiredMonthlyMinorUnits === null
        ? null
        : toMoneyDto(progress.requiredMonthlyMinorUnits, goal.currency),
    onTrack: progress.onTrack,
    autoContribution:
      goal.autoContribution === null
        ? null
        : toAutoContribution(goal.autoContribution, goal.currency),
    roundUpsEnabled: goal.roundUpsEnabled,
    status: goal.status as SavingsGoal['status'],
    createdAt: goal.createdAt.toISOString(),
    achievedAt: goal.achievedAt?.toISOString() ?? null,
  };
}
