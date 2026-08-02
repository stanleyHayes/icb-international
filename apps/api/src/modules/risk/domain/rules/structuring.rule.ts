import { MS_PER_HOUR, describeAmount, numberParam, severity } from './rule.params.js';
import { fired, notFired, type RuleEvaluator } from './rule.types.js';

/**
 * Structuring: repeated amounts deliberately parked just under a reporting threshold.
 *
 * Four payments of 9,800 against a 10,000 reporting line is not a coincidence; it is somebody who
 * knows where the line is. The rule only counts amounts *inside the band* — a mix of 200s and
 * 9,800s is not structuring, and treating it as such would bury the analysts in noise.
 */
const PERCENT = 100;

export const structuringRule: RuleEvaluator = (context, parameters) => {
  const reportingThreshold = numberParam(parameters, 'reportingThresholdMinorUnits', 1_000_000);
  const bandPercent = numberParam(parameters, 'bandPercent', 10);
  const minOccurrences = numberParam(parameters, 'minOccurrences', 3);
  const windowHours = numberParam(parameters, 'windowHours', 72);

  const floor = Math.round((reportingThreshold * (PERCENT - bandPercent)) / PERCENT);
  const band = `between ${describeAmount(floor, context.currency)} and ${describeAmount(reportingThreshold, context.currency)}`;
  const threshold = `fewer than ${minOccurrences} amounts ${band} in ${windowHours} hours`;

  const inBand = (minorUnits: number): boolean =>
    minorUnits >= floor && minorUnits < reportingThreshold;

  if (!inBand(context.amountMinorUnits)) {
    return notFired(
      `${describeAmount(context.amountMinorUnits, context.currency)} is not just under the reporting line`,
      threshold,
    );
  }

  const since = context.at.getTime() - windowHours * MS_PER_HOUR;
  const count =
    1 +
    context.history.filter(
      (point) => point.at.getTime() >= since && inBand(point.minorUnits),
    ).length;

  const observed = `${count} amounts ${band} within ${windowHours} hours`;
  if (count < minOccurrences) {
    return notFired(observed, threshold);
  }
  return fired(observed, threshold, severity(count, minOccurrences, 2));
};
