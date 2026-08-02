import { MS_PER_MINUTE, numberParam, severity } from './rule.params.js';
import { fired, notFired, type RuleEvaluator } from './rule.types.js';

/**
 * Velocity: how many movements the customer has made in a rolling window.
 *
 * A compromised credential is usually drained quickly, so burst count is the cheapest early
 * signal there is. The event under assessment is counted as well — otherwise the rule is always
 * one transaction behind the fraud.
 */
export const velocityRule: RuleEvaluator = (context, parameters) => {
  const windowMinutes = numberParam(parameters, 'windowMinutes', 60);
  const maxCount = numberParam(parameters, 'maxCount', 5);

  const since = context.at.getTime() - windowMinutes * MS_PER_MINUTE;
  const count =
    1 + context.history.filter((point) => point.at.getTime() >= since).length;

  const observed = `${count} movements in the last ${windowMinutes} minutes`;
  const threshold = `at most ${maxCount} in ${windowMinutes} minutes`;

  if (count <= maxCount) {
    return notFired(observed, threshold);
  }
  return fired(observed, threshold, severity(count, maxCount, 3));
};
