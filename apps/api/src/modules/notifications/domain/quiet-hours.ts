import type { QuietHours } from './preference.types.js';

/**
 * Quiet hours, evaluated in the bank's business timezone.
 *
 * Evaluating "22:00 to 07:00" in UTC would silence a customer in Accra at the wrong end of the
 * night, so the instant is converted to local wall-clock time first. The instant itself always
 * comes from ClockService, which is what lets a simulated jump to 03:00 actually go quiet.
 */

const MINUTES_PER_HOUR = 60;

/** `HH:mm` → minutes since local midnight. Malformed input reads as midnight, never as NaN. */
function toMinutes(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  const parsed = Number(hours) * MINUTES_PER_HOUR + Number(minutes);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Wall-clock minutes at `at` in `timeZone`, via Intl rather than a hand-rolled offset table. */
export function localMinutes(at: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(at);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '0';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '0';
  return Number(hour) * MINUTES_PER_HOUR + Number(minute);
}

/**
 * Whether `at` falls inside the customer's quiet window.
 *
 * The window normally wraps midnight (22:00 → 07:00), so the comparison is a union of two ranges
 * rather than a single interval. A zero-length window silences nothing, which is the only sane
 * reading of "from 08:00 to 08:00".
 */
export function isWithinQuietHours(quietHours: QuietHours, at: Date, timeZone: string): boolean {
  if (!quietHours.enabled) {
    return false;
  }

  const from = toMinutes(quietHours.from);
  const to = toMinutes(quietHours.to);
  if (from === to) {
    return false;
  }

  const now = localMinutes(at, timeZone);
  return from < to ? now >= from && now < to : now >= from || now < to;
}
