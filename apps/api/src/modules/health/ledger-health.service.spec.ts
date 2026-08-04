import { ledgerIntegrityReportSchema, type LedgerIntegrityReport } from '@icb/contracts';
import { describe, expect, it, vi } from 'vitest';

import { MetricsService } from '../../common/observability/metrics.service.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import type { LedgerIntegrityService } from '../ledger/ledger-integrity.service.js';
import { LEDGER_HEALTH_CACHE_TTL_MS, LedgerHealthService } from './ledger-health.service.js';

const FROZEN = new Date('2026-08-02T12:00:00.000Z');

function integrityReport(drifted: string[] = []): LedgerIntegrityReport {
  return {
    balanced: drifted.length === 0,
    checks: [{ name: 'Cached balances match computed balances', passed: drifted.length === 0, detail: '' }],
    currencyTotals: [{ currency: 'USD', netMinorUnits: 0 }],
    transactionsChecked: 12,
    entriesChecked: 24,
    driftDetected: drifted.map((accountRef) => ({ accountRef, cached: 0, computed: 100 })),
    checkedAt: FROZEN.toISOString(),
    durationMs: 42,
  };
}

function setup(report: LedgerIntegrityReport) {
  const integrity = {
    verify: vi.fn<() => Promise<LedgerIntegrityReport>>().mockResolvedValue(report),
  };
  const clock = new ClockService();
  clock.freeze(FROZEN);
  const metrics = new MetricsService();
  const service = new LedgerHealthService(
    integrity as unknown as LedgerIntegrityService,
    clock,
    metrics,
  );
  return { integrity, clock, metrics, service };
}

describe('LedgerHealthService', () => {
  it('returns a report that parses against the ledger integrity contract', async () => {
    const { service } = setup(integrityReport());

    const report = await service.report();

    expect(() => ledgerIntegrityReportSchema.parse(report)).not.toThrow();
  });

  it('serves the cached verdict inside the TTL instead of re-running the aggregation', async () => {
    const { integrity, service } = setup(integrityReport());

    const first = await service.report();
    const second = await service.report();

    expect(second).toBe(first);
    expect(integrity.verify).toHaveBeenCalledTimes(1);
  });

  it('re-runs the check once the cache has expired', async () => {
    const { integrity, clock, service } = setup(integrityReport());

    await service.report();
    clock.freeze(new Date(FROZEN.getTime() + LEDGER_HEALTH_CACHE_TTL_MS + 1));
    await service.report();

    expect(integrity.verify).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight check between concurrent callers', async () => {
    const { integrity, service } = setup(integrityReport());

    const [a, b] = await Promise.all([service.report(), service.report()]);

    expect(a).toBe(b);
    expect(integrity.verify).toHaveBeenCalledTimes(1);
  });

  it('feeds the drift gauge from the same check the endpoint serves', async () => {
    const { metrics, service } = setup(integrityReport(['acct:one|USD', 'acct:two|USD']));

    await service.report();

    expect(await metrics.render()).toContain('icb_ledger_drift_accounts 2');
  });
});
