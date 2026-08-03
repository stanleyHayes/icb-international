import { describe, expect, it } from 'vitest';

import { aggregateCashByDay, detectThresholdAggregation } from '../domain/ctr-aggregation.js';
import type { FlowPoint } from '../domain/scenario.types.js';

const DAY_ONE = '2026-07-30';
const DAY_TWO = '2026-07-31';

let sequence = 0;

function cashIn(minorUnits: number, iso: string, currency = 'USD'): FlowPoint {
  sequence += 1;
  return {
    transactionId: `cash-${sequence}`,
    direction: 'credit',
    minorUnits,
    currency,
    transactionType: 'deposit',
    at: new Date(iso),
    destinationCountry: null,
    counterpartyName: null,
  };
}

describe('aggregateCashByDay', () => {
  it('sums cash-in per currency per UTC day', () => {
    const aggregates = aggregateCashByDay([
      cashIn(400_000, `${DAY_ONE}T09:00:00.000Z`),
      cashIn(300_000, `${DAY_ONE}T15:00:00.000Z`),
      cashIn(500_000, `${DAY_TWO}T10:00:00.000Z`),
    ]);

    expect(aggregates).toHaveLength(2);
    const dayOne = aggregates.find((aggregate) => aggregate.day === DAY_ONE);
    expect(dayOne?.totalMinorUnits).toBe(700_000);
    expect(dayOne?.transactionIds).toHaveLength(2);
  });

  it('keeps currencies in separate aggregates', () => {
    const aggregates = aggregateCashByDay([
      cashIn(600_000, `${DAY_ONE}T09:00:00.000Z`, 'USD'),
      cashIn(600_000, `${DAY_ONE}T09:30:00.000Z`, 'GHS'),
    ]);

    expect(aggregates).toHaveLength(2);
    expect(aggregates.map((aggregate) => aggregate.currency).sort((a, b) => a.localeCompare(b))).toEqual(['GHS', 'USD']);
  });

  it('ignores non-cash transaction types and outbound flows', () => {
    const inboundTransfer: FlowPoint = { ...cashIn(900_000, `${DAY_ONE}T09:00:00.000Z`), transactionType: 'transfer_in' };
    const outbound: FlowPoint = { ...cashIn(900_000, `${DAY_ONE}T10:00:00.000Z`), direction: 'debit' };

    expect(aggregateCashByDay([inboundTransfer, outbound])).toHaveLength(0);
  });
});

describe('detectThresholdAggregation', () => {
  it('fires when same-day cash-in reaches the CTR threshold across several transactions', () => {
    const hit = detectThresholdAggregation([
      cashIn(400_000, `${DAY_ONE}T09:00:00.000Z`),
      cashIn(350_000, `${DAY_ONE}T12:00:00.000Z`),
      cashIn(300_000, `${DAY_ONE}T16:00:00.000Z`),
    ]);

    expect(hit?.kind).toBe('threshold_aggregation');
    expect(hit?.aggregateMinorUnits).toBe(1_050_000);
    expect(hit?.relatedTransactionIds).toHaveLength(3);
    expect(hit?.matchDetail).toContain(DAY_ONE);
  });

  it('does not fire when each day stays under the line, however big the week', () => {
    const hit = detectThresholdAggregation([
      cashIn(900_000, `${DAY_ONE}T09:00:00.000Z`),
      cashIn(900_000, `${DAY_TWO}T09:00:00.000Z`),
    ]);

    expect(hit).toBeNull();
  });

  it('does not fire when each currency stays under the line on the day', () => {
    const hit = detectThresholdAggregation([
      cashIn(700_000, `${DAY_ONE}T09:00:00.000Z`, 'USD'),
      cashIn(700_000, `${DAY_ONE}T10:00:00.000Z`, 'GHS'),
    ]);

    expect(hit).toBeNull();
  });

  it('reports the largest day when more than one crosses', () => {
    const hit = detectThresholdAggregation([
      cashIn(1_100_000, `${DAY_ONE}T09:00:00.000Z`),
      cashIn(1_500_000, `${DAY_TWO}T09:00:00.000Z`),
    ]);

    expect(hit?.aggregateMinorUnits).toBe(1_500_000);
    expect(hit?.matchDetail).toContain(DAY_TWO);
  });
});
