import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import type {
  AccountBalanceDoc,
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../infrastructure/ledger.schemas.js';
import { LedgerIntegrityService } from '../ledger-integrity.service.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');

interface AggregateRows {
  netByCurrency: { _id: string; net: number }[];
  unbalanced: { _id: { transactionId: string; currency: string }; net: number }[];
  computed: { _id: { ref: string; currency: string }; net: number }[];
}

const CLEAN: AggregateRows = {
  netByCurrency: [{ _id: 'USD', net: 0 }],
  unbalanced: [],
  computed: [{ _id: { ref: 'acct:A', currency: 'USD' }, net: 5_000 }],
};

function queryChain<T>(result: T) {
  return {
    session: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function setup({
  rows = CLEAN,
  cached = [{ accountRef: 'acct:A', currency: 'USD', ledgerMinorUnits: 5_000 }],
  suspense = [{ accountRef: 'gl:9900', ledgerMinorUnits: 0 }],
  negatives = [] as { accountRef: string }[],
  transactionsChecked = 12,
  entriesChecked = 34,
} = {}) {
  const entries = {
    aggregate: vi
      .fn()
      .mockResolvedValueOnce(rows.netByCurrency)
      .mockResolvedValueOnce(rows.unbalanced)
      .mockResolvedValueOnce(rows.computed),
    estimatedDocumentCount: vi.fn().mockResolvedValue(entriesChecked),
  };
  const balances = {
    // `verify()` fans out via Promise.all, so dispatch on the filter, not call order.
    find: vi.fn().mockImplementation((filter?: Record<string, unknown>) => {
      if (!filter) {
        return queryChain(cached); // findBalanceDrift: every cached balance
      }
      if (filter.accountRef === 'gl:9900') {
        return queryChain(suspense);
      }
      return queryChain(negatives); // findUnauthorisedNegatives
    }),
  };
  const transactions = {
    estimatedDocumentCount: vi.fn().mockResolvedValue(transactionsChecked),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new LedgerIntegrityService(
    transactions as unknown as Model<LedgerTransactionDoc>,
    entries as unknown as Model<LedgerEntryDoc>,
    balances as unknown as Model<AccountBalanceDoc>,
    clock,
  );
  return { service, entries, balances };
}

describe('LedgerIntegrityService.verify', () => {
  it('passes all six invariants on a clean book', async () => {
    const { service } = setup();

    const report = await service.verify();

    expect(report.balanced).toBe(true);
    expect(report.checks).toHaveLength(6);
    expect(report.checks.every((check) => check.passed)).toBe(true);
    expect(report.transactionsChecked).toBe(12);
    expect(report.entriesChecked).toBe(34);
    expect(report.checkedAt).toBe(NOW.toISOString());
    expect(report.durationMs).toBe(0); // frozen clock
    expect(report.currencyTotals).toEqual([{ currency: 'USD', netMinorUnits: 0 }]);
    expect(report.driftDetected).toEqual([]);
  });

  it('fails when a transaction does not balance per currency', async () => {
    const { service } = setup({
      rows: {
        ...CLEAN,
        unbalanced: [{ _id: { transactionId: 'txn-1', currency: 'USD' }, net: 500 }],
      },
    });

    const report = await service.verify();

    expect(report.balanced).toBe(false);
    const check = report.checks.find((c) => c.name === 'Every transaction balances per currency');
    expect(check?.passed).toBe(false);
    expect(check?.detail).toContain('txn-1/USD');
  });

  it('fails when the whole ledger does not net to zero', async () => {
    const { service } = setup({
      rows: { ...CLEAN, netByCurrency: [{ _id: 'USD', net: 42 }] },
    });

    const report = await service.verify();

    const check = report.checks.find((c) => c.name === 'Whole ledger nets to zero per currency');
    expect(check?.passed).toBe(false);
    expect(check?.detail).toBe('USD: 42');
    expect(report.balanced).toBe(false);
  });

  it('detects drift between cached balances and computed entries', async () => {
    const { service } = setup({
      cached: [{ accountRef: 'acct:A', currency: 'USD', ledgerMinorUnits: 4_999 }],
    });

    const report = await service.verify();

    expect(report.balanced).toBe(false);
    expect(report.driftDetected).toEqual([
      { accountRef: 'acct:A|USD', cached: 4_999, computed: 5_000 },
    ]);
    const check = report.checks.find((c) => c.name === 'Cached balances match computed balances');
    expect(check?.passed).toBe(false);
  });

  it('treats a missing balance document as a cached zero', async () => {
    const { service } = setup({ cached: [] });

    const report = await service.verify();

    expect(report.driftDetected).toEqual([
      { accountRef: 'acct:A|USD', cached: 0, computed: 5_000 },
    ]);
  });

  it('fails when the suspense account carries a balance', async () => {
    const { service } = setup({
      suspense: [{ accountRef: 'gl:9900', ledgerMinorUnits: 100 }],
    });

    const report = await service.verify();

    const check = report.checks.find((c) => c.name === 'Suspense account is zero');
    expect(check?.passed).toBe(false);
    expect(report.balanced).toBe(false);
  });

  it('fails when a customer account exceeds its overdraft limit', async () => {
    const { service } = setup({ negatives: [{ accountRef: 'acct:B' }] });

    const report = await service.verify();

    const check = report.checks.find(
      (c) => c.name === 'No account is negative without an overdraft limit',
    );
    expect(check?.passed).toBe(false);
    expect(check?.detail).toContain('1 account(s)');
  });

  it('scopes the negative-balance sweep to customer accounts with a limit of 50', async () => {
    const { service, balances } = setup();

    await service.verify();

    const calls = balances.find.mock.calls as [Record<string, unknown> | undefined][];
    const negativeCall = calls.find(
      ([filter]) => filter !== undefined && filter.accountRef !== 'gl:9900',
    );
    expect(negativeCall?.[0]?.accountRef).toEqual({ $regex: '^acct:' });
  });
});
