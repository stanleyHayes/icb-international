import { describe, expect, it } from 'vitest';

import { DISPUTE_EVENT_TYPES } from '../disputes.constants.js';
import {
  detectChanges,
  type DisputeSnapshot,
  type WatchWatermark,
} from '../domain/dispute-watch.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const EARLIER = new Date('2026-08-01T09:00:00.000Z');
const OVERDUE = new Date('2026-08-01T00:00:00.000Z');
const FUTURE = new Date('2026-08-20T00:00:00.000Z');

function dispute(overrides: Partial<DisputeSnapshot> = {}): DisputeSnapshot {
  return {
    id: 'dsp-1',
    reference: 'DSP-ABC123XY',
    customerId: 'cus-1',
    stage: 'investigating',
    amountMinorUnits: 12_345,
    currency: 'GBP',
    timeline: [{ at: EARLIER, stage: 'submitted', note: 'Dispute raised' }],
    slaDueAt: FUTURE,
    resolvedAt: null,
    ...overrides,
  };
}

describe('detectChanges — first sight', () => {
  it('announces only the current stage, adopting the rest of the history silently', () => {
    const doc = dispute({
      timeline: [
        { at: EARLIER, stage: 'submitted', note: 'Dispute raised' },
        { at: NOW, stage: 'investigating', note: 'Picked up by an analyst' },
      ],
    });

    const decision = detectChanges(doc, null, NOW);

    expect(decision.events).toHaveLength(1);
    expect(decision.events[0]).toMatchObject({
      type: DISPUTE_EVENT_TYPES.StageChanged,
      payload: { stage: 'investigating', note: 'Picked up by an analyst' },
    });
    expect(decision.next).toEqual({ seenTimelineEntries: 2, slaAlerted: false });
  });

  it('announces the submission itself for a brand-new dispute', () => {
    const decision = detectChanges(dispute(), null, NOW);

    expect(decision.events).toHaveLength(1);
    expect(decision.events[0]?.payload).toMatchObject({
      disputeId: 'dsp-1',
      reference: 'DSP-ABC123XY',
      customerId: 'cus-1',
      stage: 'submitted',
      occurredAt: EARLIER.toISOString(),
    });
  });

  it('carries the disputed amount as a wire-ready money DTO', () => {
    const decision = detectChanges(dispute(), null, NOW);

    expect(decision.events[0]?.payload).toMatchObject({
      amount: { minorUnits: 12_345, currency: 'GBP', scale: 2 },
    });
  });

  it('omits the amount rather than guessing when the currency is unknown', () => {
    const decision = detectChanges(dispute({ currency: 'XXX-not-a-currency' }), null, NOW);

    expect(decision.events[0]?.payload).not.toHaveProperty('amount');
  });
});

describe('detectChanges — subsequent sweeps', () => {
  const watermark: WatchWatermark = { seenTimelineEntries: 1, slaAlerted: false };

  it('emits one event per new timeline entry, in order', () => {
    const doc = dispute({
      timeline: [
        { at: EARLIER, stage: 'submitted', note: 'Dispute raised' },
        { at: NOW, stage: 'provisional_credit', note: 'Credit granted' },
        { at: NOW, stage: 'representment', note: 'Merchant responded' },
      ],
    });

    const decision = detectChanges(doc, watermark, NOW);

    expect(decision.events.map((event) => event.payload['stage'])).toEqual([
      'provisional_credit',
      'representment',
    ]);
    expect(decision.next.seenTimelineEntries).toBe(3);
  });

  it('stays silent when nothing moved', () => {
    const decision = detectChanges(dispute(), watermark, NOW);

    expect(decision.events).toHaveLength(0);
    expect(decision.next).toEqual(watermark);
  });
});

describe('detectChanges — SLA timer', () => {
  it('raises the breach once the deadline passes on an open dispute', () => {
    const decision = detectChanges(dispute({ slaDueAt: OVERDUE }), null, NOW);

    const sla = decision.events.find((event) => event.type === DISPUTE_EVENT_TYPES.SlaBreached);
    expect(sla?.payload).toMatchObject({
      disputeId: 'dsp-1',
      customerId: 'cus-1',
      slaDueAt: OVERDUE.toISOString(),
    });
    expect(decision.next.slaAlerted).toBe(true);
  });

  it('never raises the same breach twice', () => {
    const alerted: WatchWatermark = { seenTimelineEntries: 1, slaAlerted: true };

    const decision = detectChanges(dispute({ slaDueAt: OVERDUE }), alerted, NOW);

    expect(decision.events).toHaveLength(0);
    expect(decision.next.slaAlerted).toBe(true);
  });

  it('does not fire ahead of the deadline', () => {
    const decision = detectChanges(dispute({ slaDueAt: FUTURE }), null, NOW);

    expect(decision.events.every((event) => event.type === DISPUTE_EVENT_TYPES.StageChanged)).toBe(
      true,
    );
    expect(decision.next.slaAlerted).toBe(false);
  });

  it('does not fire on a resolved dispute — there is no deadline left to miss', () => {
    const decision = detectChanges(
      dispute({ slaDueAt: OVERDUE, resolvedAt: EARLIER, stage: 'resolved' }),
      null,
      NOW,
    );

    expect(decision.events.every((event) => event.type === DISPUTE_EVENT_TYPES.StageChanged)).toBe(
      true,
    );
    expect(decision.next.slaAlerted).toBe(false);
  });
});
