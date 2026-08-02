import { ISO_DURATION_PATTERN } from '@icb/contracts';

import { ValidationError } from '../../../common/errors/index.js';

const MS = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
} as const;

/**
 * ISO 8601 duration to milliseconds, over the subset the contract admits: `P30D`, `PT6H`,
 * `P1DT12H30M`. Months and years are deliberately absent — "one month" is not a fixed number of
 * milliseconds, and an operator who wants to cross a month boundary should say `P30D` or set an
 * absolute instant rather than have the code guess which month they meant.
 */
export function parseIsoDuration(duration: string): number {
  const match = ISO_DURATION_PATTERN.exec(duration);

  if (!match || duration === 'P' || duration.endsWith('T')) {
    throw new ValidationError('Expected an ISO 8601 duration such as P30D or PT6H', [
      { path: 'duration', message: 'Unsupported duration' },
    ]);
  }

  const days = unit(match[1]) * MS.day;
  const hours = unit(match[3]) * MS.hour;
  const minutes = unit(match[4]) * MS.minute;
  const seconds = unit(match[5]) * MS.second;
  const total = days + hours + minutes + seconds;

  if (total <= 0) {
    throw new ValidationError('A duration must be greater than zero', [
      { path: 'duration', message: 'Must advance the clock by at least one second' },
    ]);
  }
  return total;
}

/** `30D` → 30. Absent components contribute nothing. */
function unit(component: string | undefined): number {
  return component ? Number.parseInt(component, 10) : 0;
}
