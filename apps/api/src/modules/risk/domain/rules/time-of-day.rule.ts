import { numberParam } from './rule.params.js';
import { fired, notFired, type RuleEvaluator } from './rule.types.js';

/**
 * Time of day: activity in the hours the customer is normally asleep.
 *
 * The weakest signal in the set, and weighted accordingly. It exists because it *combines* — a
 * 03:00 payment is unremarkable, and a 03:00 payment to a brand-new payee from a brand-new device
 * is the shape of an account takeover.
 */
const HOURS_IN_DAY = 24;

function inWindow(hour: number, start: number, end: number): boolean {
  // A window may wrap midnight (23 → 05), which is exactly the interesting case.
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

export const timeOfDayRule: RuleEvaluator = (context, parameters) => {
  const start = Math.trunc(numberParam(parameters, 'startHourUtc', 1)) % HOURS_IN_DAY;
  const end = Math.trunc(numberParam(parameters, 'endHourUtc', 5)) % HOURS_IN_DAY;

  const hour = context.at.getUTCHours();
  const observed = `Event at ${String(hour).padStart(2, '0')}:00 UTC`;
  const threshold = `outside ${String(start).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:00 UTC`;

  if (!inWindow(hour, start, end)) {
    return notFired(observed, threshold);
  }
  return fired(`${observed}, inside the overnight window`, threshold, 1);
};
