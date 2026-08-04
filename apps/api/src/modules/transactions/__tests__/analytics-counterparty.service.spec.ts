import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { LedgerEntryDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { TransactionAnalyticsService } from '../analytics.service.js';
import type { TransactionAnnotationsService } from '../annotations.service.js';

const CLOCK_TODAY = '2026-08-03';

function entry(overrides: Partial<LedgerEntryDoc> = {}): LedgerEntryDoc {
  return {
    _id: '01JENTRY000000000000001',
    transactionId: 'txn-1',
    accountRef: 'customer:acct-1',
    direction: 'debit',
    minorUnits: 1_299,
    currency: 'USD',
    signedMinorUnits: -1_299,
    valueDate: '2026-07-01',
    bookedAt: new Date('2026-07-01T08:00:00.000Z'),
    sequence: 1,
    narrative: 'Netflix',
    transactionType: 'card_purchase',
    transactionStatus: 'settled',
    ...overrides,
  };
}

function modelsDouble() {
  return {
    entries: { find: vi.fn() },
    accounts: { find: vi.fn() },
  };
}

function annotationsDouble() {
  return { getForTransactions: vi.fn().mockResolvedValue(new Map()) };
}

function clockDouble(): ClockService {
  return { today: () => CLOCK_TODAY } as unknown as ClockService;
}

/** The customer's single account id, as the accounts model answers it. */
function withOneAccount(models: ReturnType<typeof modelsDouble>): void {
  models.accounts.find.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve([{ _id: 'acct-1' }]) }),
  });
}

describe('TransactionAnalyticsService — merchants & recurring', () => {
  let models: ReturnType<typeof modelsDouble>;
  let annotations: ReturnType<typeof annotationsDouble>;
  let service: TransactionAnalyticsService;

  beforeEach(() => {
    models = modelsDouble();
    withOneAccount(models);
    annotations = annotationsDouble();
    service = new TransactionAnalyticsService(
      models.entries as unknown as Model<LedgerEntryDoc>,
      models.accounts as unknown as Model<AccountDoc>,
      annotations as unknown as TransactionAnnotationsService,
      clockDouble(),
    );
  });

  it('returns an empty leaderboard without touching entries when the customer has no accounts', async () => {
    models.accounts.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });

    const result = await service.merchants('cust-1', { currency: 'USD' });

    expect(result.merchants).toEqual([]);
    expect(models.entries.find).not.toHaveBeenCalled();
  });

  it('queries settled debits inside the default 30-day window', async () => {
    models.entries.find.mockReturnValue({ lean: () => Promise.resolve([]) });

    const result = await service.merchants('cust-1', { currency: 'USD' });

    expect(result.period).toEqual({ from: '2026-07-05', to: CLOCK_TODAY });
    expect(models.entries.find).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'debit',
        currency: 'USD',
        valueDate: { $gte: '2026-07-05', $lte: CLOCK_TODAY },
      }),
    );
  });

  it('ranks merchants by total spend with the annotation category winning', async () => {
    const rows = [
      entry({ transactionId: 'txn-1', narrative: 'Corner Cafe', minorUnits: 520 }),
      entry({ transactionId: 'txn-2', narrative: 'Corner Cafe', minorUnits: 450 }),
      entry({ transactionId: 'txn-3', narrative: 'Netflix', minorUnits: 1_299 }),
    ];
    models.entries.find.mockReturnValue({ lean: () => Promise.resolve(rows) });
    annotations.getForTransactions.mockResolvedValue(
      new Map([['txn-1', { category: 'dining' }]]),
    );

    const result = await service.merchants('cust-1', { currency: 'USD' });

    expect(result.merchants.map((merchant) => merchant.name)).toEqual(['Netflix', 'Corner Cafe']);
    expect(result.merchants[0]).toMatchObject({
      total: { minorUnits: 1_299, currency: 'USD' },
      transactionCount: 1,
    });
    expect(result.merchants[1]).toMatchObject({
      category: 'dining',
      total: { minorUnits: 970 },
      transactionCount: 2,
    });
  });

  it('detects recurring charges over the trailing 180 days', async () => {
    const rows = ['2026-05-01', '2026-06-01', '2026-07-01'].map((day, index) =>
      entry({
        transactionId: `txn-${String(index)}`,
        valueDate: day,
        bookedAt: new Date(`${day}T08:00:00.000Z`),
      }),
    );
    models.entries.find.mockReturnValue({ lean: () => Promise.resolve(rows) });

    const result = await service.recurring('cust-1', { currency: 'USD' });

    expect(result.window).toEqual({ from: '2026-02-05', to: CLOCK_TODAY });
    expect(result.recurring).toHaveLength(1);
    expect(result.recurring[0]).toMatchObject({
      name: 'Netflix',
      amount: { minorUnits: 1_299, currency: 'USD' },
      occurrences: 3,
      lastChargedAt: '2026-07-01T08:00:00.000Z',
    });
  });
});
