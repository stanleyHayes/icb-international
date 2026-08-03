import { describe, expect, it } from 'vitest';

import { ClockService } from '../../../../simulation/clock/clock.service.js';
import {
  estimateArrival,
  evaluateCutOff,
  scheduledExecutionInstant,
} from '../cut-offs.js';

function clockAt(instant: string): ClockService {
  const clock = new ClockService();
  clock.freeze(new Date(instant));
  return clock;
}

describe('evaluateCutOff', () => {
  it('reports no cut-off for the book-transfer rails', () => {
    const clock = clockAt('2026-08-04T10:00:00.000Z'); // Tuesday
    expect(evaluateCutOff('internal', clock.now(), clock)).toEqual({
      cutOffAt: null,
      pastCutOff: false,
    });
    expect(evaluateCutOff('on_us', clock.now(), clock).cutOffAt).toBeNull();
  });

  it('is not past the wire cut-off at 15:59 and past it at 16:00', () => {
    const before = clockAt('2026-08-04T15:59:00.000Z');
    expect(evaluateCutOff('wire', before.now(), before).pastCutOff).toBe(false);

    const at = clockAt('2026-08-04T16:00:00.000Z');
    const evaluation = evaluateCutOff('wire', at.now(), at);
    expect(evaluation.pastCutOff).toBe(true);
    expect(evaluation.cutOffAt?.toISOString()).toBe('2026-08-04T16:00:00.000Z');
  });
});

describe('estimateArrival', () => {
  it('settles a book transfer immediately', () => {
    const clock = clockAt('2026-08-04T10:00:00.000Z');
    const estimate = estimateArrival('internal', clock.now(), clock);
    expect(estimate.estimatedArrival.toISOString()).toBe('2026-08-04T10:00:00.000Z');
  });

  it('settles a same-day wire before the cut-off', () => {
    const clock = clockAt('2026-08-04T10:00:00.000Z'); // Tuesday 10:00
    expect(estimateArrival('wire', clock.now(), clock).estimatedArrival.toISOString()).toBe(
      '2026-08-04T10:00:00.000Z',
    );
  });

  it('rolls a wire past the Friday cut-off to Monday, not Saturday', () => {
    const clock = clockAt('2026-07-31T16:30:00.000Z'); // Friday 16:30, past 16:00
    const estimate = estimateArrival('wire', clock.now(), clock);
    expect(estimate.pastCutOff).toBe(true);
    expect(estimate.estimatedArrival.toISOString().slice(0, 10)).toBe('2026-08-04'); // Monday is a bank holiday
  });

  it('settles ACH the next business day', () => {
    const clock = clockAt('2026-08-04T10:00:00.000Z'); // Tuesday
    expect(
      estimateArrival('ach', clock.now(), clock).estimatedArrival.toISOString().slice(0, 10),
    ).toBe('2026-08-05');
  });

  it('settles SWIFT two business days out, skipping the weekend', () => {
    const clock = clockAt('2026-07-31T10:00:00.000Z'); // Friday
    expect(
      estimateArrival('swift', clock.now(), clock).estimatedArrival.toISOString().slice(0, 10),
    ).toBe('2026-08-05'); // Mon is a bank holiday: Tue +1, Wed +2
  });
});

describe('scheduledExecutionInstant', () => {
  it('pins the execution hour onto the due date', () => {
    expect(scheduledExecutionInstant('2026-09-01', 9).toISOString()).toBe(
      '2026-09-01T09:00:00.000Z',
    );
  });
});
