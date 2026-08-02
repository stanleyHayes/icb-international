import { describeAmount, numberParam } from './rule.params.js';
import { fired, notFired, type RuleEvaluator } from './rule.types.js';

/** An unfamiliar device moving real money scores the whole weight; a small amount, most of it. */
const UNFAMILIAR_DEVICE_SEVERITY = 0.6;

/**
 * Device change: money moving from hardware the customer has never used.
 *
 * Deliberately silent on a customer's *first* device — there is nothing to have changed from, and
 * firing on every new customer would train analysts to ignore the rule, which is worse than not
 * having it.
 */
export const deviceChangeRule: RuleEvaluator = (context, parameters) => {
  const minAmount = numberParam(parameters, 'minAmountMinorUnits', 20_000);
  const threshold = `a device seen before, or an amount under ${describeAmount(minAmount, context.currency)}`;

  if (!context.deviceId) {
    return notFired('No device fingerprint was supplied with this event', threshold);
  }
  if (context.knownDeviceIds.length === 0) {
    return notFired(`Device ${context.deviceId} is the first ever seen for this customer`, threshold);
  }
  if (context.knownDeviceIds.includes(context.deviceId)) {
    return notFired(`Device ${context.deviceId} has been used before`, threshold);
  }

  const observed =
    `${describeAmount(context.amountMinorUnits, context.currency)} from device ${context.deviceId}, ` +
    `unseen against ${context.knownDeviceIds.length} known device(s)`;

  return fired(
    observed,
    threshold,
    context.amountMinorUnits >= minAmount ? 1 : UNFAMILIAR_DEVICE_SEVERITY,
  );
};
