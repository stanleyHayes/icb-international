import { describe, expect, it } from 'vitest';

import type { FlowPoint } from '../domain/scenario.types.js';
import {
  detectHighRiskCorridor,
  detectRapidMovement,
  detectRoundAmounts,
  detectStructuring,
} from '../domain/scenarios.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const HOUR = 3_600_000;
const DAY = 86_400_000;

let sequence = 0;

function flow(overrides: Partial<FlowPoint> = {}): FlowPoint {
  sequence += 1;
  return {
    transactionId: `txn-${sequence}`,
    direction: 'credit',
    minorUnits: 100_000,
    currency: 'USD',
    transactionType: 'deposit',
    at: new Date(NOW.getTime() - HOUR),
    destinationCountry: null,
    counterpartyName: null,
    ...overrides,
  };
}

function flows(specs: readonly Partial<FlowPoint>[]): FlowPoint[] {
  return specs.map((spec) => flow(spec));
}

describe('detectStructuring', () => {
  it('fires when several sub-threshold credits sum above the CTR line', () => {
    const history = flows([
      { minorUnits: 800_000 },
      { minorUnits: 900_000, at: new Date(NOW.getTime() - 2 * DAY) },
      { minorUnits: 950_000, at: new Date(NOW.getTime() - 4 * DAY) },
    ]);

    const hit = detectStructuring(history, NOW);

    expect(hit?.kind).toBe('structuring');
    expect(hit?.relatedTransactionIds).toHaveLength(3);
    expect(hit?.aggregateMinorUnits).toBe(2_650_000);
    expect(hit?.currency).toBe('USD');
  });

  it('does not fire below the minimum count', () => {
    const history = flows([{ minorUnits: 800_000 }, { minorUnits: 900_000 }]);
    expect(detectStructuring(history, NOW)).toBeNull();
  });

  it('ignores credits at or above the threshold — those are CTR business, not structuring', () => {
    const history = flows([
      { minorUnits: 1_100_000 },
      { minorUnits: 1_200_000 },
      { minorUnits: 1_300_000 },
    ]);
    expect(detectStructuring(history, NOW)).toBeNull();
  });

  it('ignores small credits — ordinary deposits are not a pattern', () => {
    const history = flows([{ minorUnits: 100_000 }, { minorUnits: 200_000 }, { minorUnits: 300_000 }]);
    expect(detectStructuring(history, NOW)).toBeNull();
  });

  it('does not fire when the credits fall outside the window', () => {
    const old = new Date(NOW.getTime() - 10 * DAY);
    const history = flows([{ minorUnits: 800_000, at: old }, { minorUnits: 900_000, at: old }, { minorUnits: 950_000, at: old }]);
    expect(detectStructuring(history, NOW)).toBeNull();
  });

  it('never sums across currencies', () => {
    const history = flows([
      { minorUnits: 900_000, currency: 'USD' },
      { minorUnits: 900_000, currency: 'GHS' },
      { minorUnits: 900_000, currency: 'EUR' },
    ]);
    expect(detectStructuring(history, NOW)).toBeNull();
  });
});

describe('detectRapidMovement', () => {
  it('fires when most of what arrived leaves again within the window', () => {
    const history = flows([
      { direction: 'credit', minorUnits: 1_000_000, at: new Date(NOW.getTime() - 2 * HOUR) },
      { direction: 'debit', minorUnits: 850_000, at: new Date(NOW.getTime() - HOUR) },
    ]);

    const hit = detectRapidMovement(history, NOW);

    expect(hit?.kind).toBe('rapid_movement');
    expect(hit?.aggregateMinorUnits).toBe(850_000);
    expect(hit?.relatedTransactionIds).toHaveLength(2);
  });

  it('does not fire when the outflow is a small share of the inflow', () => {
    const history = flows([
      { direction: 'credit', minorUnits: 1_000_000 },
      { direction: 'debit', minorUnits: 400_000 },
    ]);
    expect(detectRapidMovement(history, NOW)).toBeNull();
  });

  it('does not fire below the minimum inflow — small balances move fast legitimately', () => {
    const history = flows([
      { direction: 'credit', minorUnits: 400_000 },
      { direction: 'debit', minorUnits: 390_000 },
    ]);
    expect(detectRapidMovement(history, NOW)).toBeNull();
  });

  it('does not fire when the movement is older than the window', () => {
    const old = new Date(NOW.getTime() - 72 * HOUR);
    const history = flows([
      { direction: 'credit', minorUnits: 1_000_000, at: old },
      { direction: 'debit', minorUnits: 950_000, at: old },
    ]);
    expect(detectRapidMovement(history, NOW)).toBeNull();
  });
});

describe('detectRoundAmounts', () => {
  it('fires on a run of exact round-amount outbound transfers', () => {
    const history = flows([
      { direction: 'debit', minorUnits: 100_000 },
      { direction: 'debit', minorUnits: 300_000, at: new Date(NOW.getTime() - 3 * DAY) },
      { direction: 'debit', minorUnits: 1_000_000, at: new Date(NOW.getTime() - 6 * DAY) },
      { direction: 'debit', minorUnits: 200_000, at: new Date(NOW.getTime() - 9 * DAY) },
    ]);

    const hit = detectRoundAmounts(history, NOW);

    expect(hit?.kind).toBe('round_amount_pattern');
    expect(hit?.aggregateMinorUnits).toBe(1_600_000);
  });

  it('does not fire below the minimum count', () => {
    const history = flows([
      { direction: 'debit', minorUnits: 100_000 },
      { direction: 'debit', minorUnits: 200_000 },
      { direction: 'debit', minorUnits: 300_000 },
    ]);
    expect(detectRoundAmounts(history, NOW)).toBeNull();
  });

  it('ignores non-round amounts', () => {
    const history = flows([
      { direction: 'debit', minorUnits: 150_000 },
      { direction: 'debit', minorUnits: 250_500 },
      { direction: 'debit', minorUnits: 999_999 },
      { direction: 'debit', minorUnits: 123_456 },
    ]);
    expect(detectRoundAmounts(history, NOW)).toBeNull();
  });

  it('only counts outbound transfers', () => {
    const history = flows([
      { direction: 'credit', minorUnits: 100_000 },
      { direction: 'credit', minorUnits: 200_000 },
      { direction: 'credit', minorUnits: 300_000 },
      { direction: 'credit', minorUnits: 400_000 },
    ]);
    expect(detectRoundAmounts(history, NOW)).toBeNull();
  });
});

describe('detectHighRiskCorridor', () => {
  it('fires on outbound value to a high-risk country', () => {
    const history = flows([
      { direction: 'debit', minorUnits: 250_000, destinationCountry: 'KP', transactionType: 'transfer_out' },
      { direction: 'debit', minorUnits: 250_000, destinationCountry: 'SY', transactionType: 'transfer_out' },
    ]);

    const hit = detectHighRiskCorridor(history);

    expect(hit?.kind).toBe('high_risk_corridor');
    expect(hit?.matchDetail).toContain('KP');
    expect(hit?.matchDetail).toContain('SY');
    expect(hit?.aggregateMinorUnits).toBe(500_000);
  });

  it('does not fire for ordinary corridors', () => {
    const history = flows([
      { direction: 'debit', minorUnits: 250_000, destinationCountry: 'GB' },
      { direction: 'debit', minorUnits: 250_000, destinationCountry: 'GH' },
    ]);
    expect(detectHighRiskCorridor(history)).toBeNull();
  });

  it('does not fire on inbound value from a high-risk country', () => {
    const history = flows([{ direction: 'credit', minorUnits: 250_000, destinationCountry: 'KP' }]);
    expect(detectHighRiskCorridor(history)).toBeNull();
  });
});
