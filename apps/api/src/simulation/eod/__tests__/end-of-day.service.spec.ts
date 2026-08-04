import type { LedgerIntegrityReport } from '@icb/contracts';
import { fromMinorUnits } from '@icb/money';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { AccountBalanceDoc } from '../../../modules/ledger/infrastructure/ledger.schemas.js';
import type { LedgerIntegrityService } from '../../../modules/ledger/ledger-integrity.service.js';
import { ClockService } from '../../clock/clock.service.js';
import { EndOfDayService } from '../end-of-day.service.js';
import { CurrencyTotals } from '../eod.context.js';
import type { RecordSteps, ValueSteps } from '../eod.steps.js';
import type { EodReportStore } from '../infrastructure/eod-report.store.js';
import { BUSINESS_DATE, NOW, leanQuery } from './fixtures.js';
import { metricsStub } from '../../../common/observability/__tests__/metrics.stub.js';

function integrityReport(overrides: Partial<LedgerIntegrityReport> = {}): LedgerIntegrityReport {
  return {
    balanced: true,
    checks: [{ name: 'double-entry', passed: true, detail: 'ok' }],
    currencyTotals: [],
    transactionsChecked: 12,
    entriesChecked: 24,
    driftDetected: [],
    checkedAt: NOW.toISOString(),
    durationMs: 1,
    ...overrides,
  };
}

function setup(suspenseRows: Array<{ ledgerMinorUnits: number }> = [{ ledgerMinorUnits: 0 }]) {
  const interest = new CurrencyTotals();
  interest.add(fromMinorUnits(658, 'USD'));
  const fees = new CurrencyTotals();
  fees.add(fromMinorUnits(500, 'USD'));

  const value = {
    holds: { run: vi.fn().mockResolvedValue(2) },
    settlement: { run: vi.fn().mockResolvedValue(1) },
    interest: { run: vi.fn().mockResolvedValue(interest) },
    fees: { run: vi.fn().mockResolvedValue(fees) },
  };
  const records = {
    arrears: { run: vi.fn().mockResolvedValue(3) },
    aml: { run: vi.fn().mockResolvedValue(1) },
    statements: { run: vi.fn().mockResolvedValue(4) },
  };
  const integrity = { verify: vi.fn().mockResolvedValue(integrityReport()) };
  const balances = { find: vi.fn().mockReturnValue(leanQuery(suspenseRows)) };
  const store = {
    currency: 'USD',
    save: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new EndOfDayService(
    value as unknown as ValueSteps,
    records as unknown as RecordSteps,
    integrity as unknown as LedgerIntegrityService,
    balances as unknown as Model<AccountBalanceDoc>,
    store as unknown as EodReportStore,
    clock,
    metricsStub(),
  );
  return { service, value, records, integrity, balances, store };
}

describe('EndOfDayService.run', () => {
  it('runs every step in pipeline order against the requested business date', async () => {
    const deps = setup();

    const outcome = await deps.service.run(BUSINESS_DATE);

    const context = { businessDate: BUSINESS_DATE, asOf: NOW };
    const ordered = [
      deps.value.holds.run,
      deps.value.settlement.run,
      deps.value.interest.run,
      deps.value.fees.run,
      deps.records.arrears.run,
      deps.records.aml.run,
      deps.records.statements.run,
    ];
    for (const step of ordered) {
      expect(step).toHaveBeenCalledWith(context);
    }
    const callOrder = ordered.map((step) => step.mock.invocationCallOrder[0]);
    expect(callOrder).toEqual([...callOrder].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(outcome.exitCode).toBe(0);
  });

  it('builds, stores and returns the report from the step totals', async () => {
    const deps = setup();

    const { report, integrity } = await deps.service.run(BUSINESS_DATE);

    expect(report).toEqual({
      businessDate: BUSINESS_DATE,
      holdsExpired: 2,
      transfersSettled: 1,
      interestAccrued: expect.objectContaining({ minorUnits: 658, currency: 'USD' }),
      feesCharged: expect.objectContaining({ minorUnits: 500, currency: 'USD' }),
      loansAged: 3,
      amlAlertsRaised: 1,
      statementsGenerated: 4,
      ledgerBalanced: true,
      suspenseZeroed: true,
      durationMs: 0,
      completedAt: NOW.toISOString(),
    });
    expect(deps.store.save).toHaveBeenCalledWith(report);
    expect(integrity.balanced).toBe(true);
  });

  it('closes the clock’s business date when none is passed', async () => {
    const deps = setup();

    const { report } = await deps.service.run();

    expect(report.businessDate).toBe('2026-08-04');
    expect(deps.value.holds.run).toHaveBeenCalledWith({ businessDate: '2026-08-04', asOf: NOW });
  });

  it('exits non-zero when the ledger does not balance, still returning the report', async () => {
    const deps = setup();
    deps.integrity.verify.mockResolvedValue(
      integrityReport({
        balanced: false,
        checks: [{ name: 'double-entry', passed: false, detail: 'drift of 42' }],
      }),
    );

    const outcome = await deps.service.run(BUSINESS_DATE);

    expect(outcome.exitCode).toBe(1);
    expect(outcome.report.ledgerBalanced).toBe(false);
    expect(outcome.report.suspenseZeroed).toBe(true);
    expect(deps.store.save).toHaveBeenCalledWith(outcome.report);
  });

  it('exits non-zero when suspense still holds value in any currency', async () => {
    const deps = setup([{ ledgerMinorUnits: 0 }, { ledgerMinorUnits: 9_999 }]);

    const outcome = await deps.service.run(BUSINESS_DATE);

    expect(outcome.exitCode).toBe(1);
    expect(outcome.report.suspenseZeroed).toBe(false);
    expect(deps.balances.find).toHaveBeenCalledWith({ accountRef: 'gl:9900' });
  });

  it('treats an empty suspense ledger as flat', async () => {
    const deps = setup([]);

    const outcome = await deps.service.run(BUSINESS_DATE);

    expect(outcome.report.suspenseZeroed).toBe(true);
    expect(outcome.exitCode).toBe(0);
  });
});

describe('EndOfDayService report access', () => {
  it('reads a previously closed date from the store', async () => {
    const deps = setup();

    await deps.service.reportFor('2026-08-01');

    expect(deps.store.find).toHaveBeenCalledWith('2026-08-01');
  });

  it('lists history through the store, passing the limit along', async () => {
    const deps = setup();

    await deps.service.history(7);

    expect(deps.store.list).toHaveBeenCalledWith(7);
  });
});
