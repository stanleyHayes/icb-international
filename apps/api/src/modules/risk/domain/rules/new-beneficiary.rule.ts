import { describeAmount, numberParam, severity } from './rule.params.js';
import { fired, notFired, type RuleEvaluator } from './rule.types.js';

/**
 * New beneficiary: money leaving to a payee this customer has never paid before.
 *
 * On its own this is ordinary — everyone has a first payment to a new landlord. It earns its
 * weight in combination, which is exactly why it is a weighted rule and not a hard block: a
 * first-time payee *plus* an unusual amount *plus* a new device is a very different story.
 */
export const newBeneficiaryRule: RuleEvaluator = (context, parameters) => {
  const minAmount = numberParam(parameters, 'minAmountMinorUnits', 50_000);
  const spend = describeAmount(context.amountMinorUnits, context.currency);
  const threshold = `first payment above ${describeAmount(minAmount, context.currency)}`;

  if (!context.beneficiaryId) {
    return notFired('No beneficiary is attached to this event', threshold);
  }

  if (context.knownBeneficiaryIds.includes(context.beneficiaryId)) {
    return notFired(`Beneficiary ${context.beneficiaryId} has been paid before`, threshold);
  }

  const observed = `${spend} to a beneficiary never paid before (${context.beneficiaryId})`;
  if (context.amountMinorUnits < minAmount) {
    return notFired(`${observed}, below the amount this rule watches`, threshold);
  }

  return fired(observed, threshold, severity(context.amountMinorUnits, minAmount, 4));
};
