import { describeAmount, numberParam, severity } from './rule.params.js';
import { fired, notFired, type HistoryPoint, type RuleEvaluator } from './rule.types.js';

/**
 * Amount anomaly: is this amount unusual *for this customer*?
 *
 * A flat "anything over 5,000 is suspicious" limit punishes the customer who always moves 8,000
 * and misses the one who has never moved more than 40. So the comparison is against the
 * customer's own distribution, expressed as a z-score.
 */

interface Distribution {
  readonly mean: number;
  readonly standardDeviation: number;
  readonly samples: number;
}

/** Population mean and standard deviation of the customer's own recent amounts. */
export function distributionOf(history: readonly HistoryPoint[]): Distribution {
  const samples = history.length;
  if (samples === 0) {
    return { mean: 0, standardDeviation: 0, samples: 0 };
  }
  const mean = history.reduce((total, point) => total + point.minorUnits, 0) / samples;
  const variance =
    history.reduce((total, point) => total + (point.minorUnits - mean) ** 2, 0) / samples;
  return { mean, standardDeviation: Math.sqrt(variance), samples };
}

/**
 * A floor under the standard deviation.
 *
 * A customer who has paid exactly 20.00 nine times has a deviation of zero, which would make
 * every other amount infinitely anomalous. The floor is a percentage of the mean, so it scales
 * with how much money the customer normally moves.
 */
function spreadFloor(mean: number, floorPercent: number): number {
  return Math.max((Math.abs(mean) * floorPercent) / 100, 1);
}

export const amountAnomalyRule: RuleEvaluator = (context, parameters) => {
  const minSamples = numberParam(parameters, 'minSamples', 5);
  const zThreshold = numberParam(parameters, 'zThreshold', 3);
  const floorPercent = numberParam(parameters, 'deviationFloorPercent', 10);

  const { mean, standardDeviation, samples } = distributionOf(context.history);
  const spend = describeAmount(context.amountMinorUnits, context.currency);

  if (samples < minSamples) {
    return notFired(
      `${spend} against only ${samples} prior movements — too little history to judge`,
      `at least ${minSamples} prior movements`,
    );
  }

  const spread = Math.max(standardDeviation, spreadFloor(mean, floorPercent));
  const zScore = (context.amountMinorUnits - mean) / spread;
  const observed =
    `${spend} is ${zScore.toFixed(1)} standard deviations from this customer's ` +
    `${samples}-movement mean of ${describeAmount(Math.round(mean), context.currency)}`;
  const threshold = `${zThreshold.toFixed(1)} standard deviations`;

  if (zScore <= zThreshold) {
    return notFired(observed, threshold);
  }
  return fired(observed, threshold, severity(zScore, zThreshold, 2));
};
