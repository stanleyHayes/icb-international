import type { TransferRail } from '@icb/contracts';

import type { ClockService } from '../../../simulation/clock/clock.service.js';
import { RAIL_CUT_OFF, RAIL_SETTLEMENT_DAYS } from './transfers.constants.js';

export interface CutOffEvaluation {
  /** Today's cut-off instant, or null for rails that never close. */
  readonly cutOffAt: Date | null;
  /** True when `at` is at or past the cut-off — settlement rolls a business day. */
  readonly pastCutOff: boolean;
}

export interface ArrivalEstimate {
  readonly estimatedArrival: Date;
  readonly cutOffAt: Date | null;
  readonly pastCutOff: boolean;
}

/**
 * Per-rail cut-off evaluation against the business calendar.
 *
 * A wire at 16:01 on a Friday settles Monday, not Saturday: the cut-off pushes the submission to
 * the next business day, and only then does the rail's settlement lag start counting. Quotes use
 * this so the arrival the customer is shown is the arrival the rail will actually deliver.
 */
export function evaluateCutOff(
  rail: TransferRail,
  at: Date,
  clock: ClockService,
): CutOffEvaluation {
  const cutOff = RAIL_CUT_OFF[rail];
  if (cutOff === null) {
    return { cutOffAt: null, pastCutOff: false };
  }
  return { cutOffAt: cutOffInstant(cutOff, at), pastCutOff: clock.isPastCutOff(cutOff, at) };
}

/** When a transfer sent at `at` will land, honouring the cut-off and the business calendar. */
export function estimateArrival(
  rail: TransferRail,
  at: Date,
  clock: ClockService,
): ArrivalEstimate {
  const { cutOffAt, pastCutOff } = evaluateCutOff(rail, at, clock);

  let cursor = at;
  if (pastCutOff || !clock.isBusinessDay(cursor)) {
    cursor = clock.nextBusinessDay(cursor);
  }

  const lagDays = RAIL_SETTLEMENT_DAYS[rail];
  const estimatedArrival = lagDays === 0 ? cursor : clock.addBusinessDays(lagDays, cursor);
  return { estimatedArrival, cutOffAt, pastCutOff };
}

/** Today's cut-off as an instant: `HH:mm` pinned onto the UTC date of `at`. */
function cutOffInstant(cutOff: string, at: Date): Date {
  const [hours = '0', minutes = '0'] = cutOff.split(':');
  const dayStart = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return new Date(dayStart + (Number(hours) * 60 + Number(minutes)) * 60 * 1000);
}

/** Start of the due date at the execution hour — when a scheduled transfer actually runs. */
export function scheduledExecutionInstant(isoDate: string, hourUtc: number): Date {
  const dayStart = Date.parse(`${isoDate}T00:00:00.000Z`);
  return new Date(dayStart + hourUtc * 60 * 60 * 1000);
}
