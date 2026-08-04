import type { LedgerIntegrityReport } from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { MetricsService } from '../../common/observability/metrics.service.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { LedgerIntegrityService } from '../ledger/ledger-integrity.service.js';

/** The integrity check is an expensive aggregation; a probe may ask far more often than that. */
export const LEDGER_HEALTH_CACHE_TTL_MS = 60_000;

interface CacheEntry {
  readonly report: LedgerIntegrityReport;
  readonly expiresAtMs: number;
}

/**
 * The ledger integrity check, cached for probes.
 *
 * `LedgerIntegrityService.verify()` aggregates the whole ledger — the right answer to "are the
 * books balanced", the wrong thing to run on every health poll. This caches the verdict for a
 * minute and feeds the drift gauge from the same refresh, so `/health/ledger` and
 * `icb_ledger_drift_accounts` can never disagree.
 *
 * Concurrent callers share one in-flight check rather than stampeding the aggregations.
 */
@Injectable()
export class LedgerHealthService {
  private cached: CacheEntry | null = null;
  private inflight: Promise<LedgerIntegrityReport> | null = null;

  constructor(
    private readonly integrity: LedgerIntegrityService,
    private readonly clock: ClockService,
    private readonly metrics: MetricsService,
  ) {}

  async report(): Promise<LedgerIntegrityReport> {
    if (this.cached !== null && this.clock.epochMs() < this.cached.expiresAtMs) {
      return this.cached.report;
    }
    this.inflight ??= this.refresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async refresh(): Promise<LedgerIntegrityReport> {
    const report = await this.integrity.verify();
    this.metrics.ledgerDrift(report.driftDetected.length);
    this.cached = {
      report,
      expiresAtMs: this.clock.epochMs() + LEDGER_HEALTH_CACHE_TTL_MS,
    };
    return report;
  }
}
