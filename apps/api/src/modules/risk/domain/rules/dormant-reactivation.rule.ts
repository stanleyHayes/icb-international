import { MS_PER_DAY, describeAmount, numberParam, severity } from './rule.params.js';
import { fired, notFired, type RuleEvaluator } from './rule.types.js';

/**
 * Dormant reactivation: a quiet account that suddenly moves money.
 *
 * Dormant accounts are the preferred vehicle for both takeover and mule activity — nobody is
 * watching the statement, and the balance has had time to accumulate. The pairing of a long
 * silence with a material amount is the signal; either alone is not.
 */
export const dormantReactivationRule: RuleEvaluator = (context, parameters) => {
  const dormantDays = numberParam(parameters, 'dormantDays', 90);
  const minAmount = numberParam(parameters, 'minAmountMinorUnits', 100_000);
  const threshold =
    `activity within ${dormantDays} days, or an amount under ` +
    `${describeAmount(minAmount, context.currency)}`;

  if (!context.lastActivityAt) {
    return notFired('No previous activity is recorded for this customer', threshold);
  }

  const quietDays = (context.at.getTime() - context.lastActivityAt.getTime()) / MS_PER_DAY;
  const observed =
    `${describeAmount(context.amountMinorUnits, context.currency)} after ` +
    `${Math.floor(quietDays)} days of no activity`;

  if (quietDays < dormantDays || context.amountMinorUnits < minAmount) {
    return notFired(observed, threshold);
  }
  return fired(observed, threshold, severity(quietDays, dormantDays, 3));
};
