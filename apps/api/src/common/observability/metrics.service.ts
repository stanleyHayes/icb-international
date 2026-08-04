import { Injectable } from '@nestjs/common';

import { createMetrics, type IcbMetrics, type QueueDepthState } from './metrics.registry.js';

/**
 * The instrumentation front door.
 *
 * Domain code calls intent-named methods (`fraudDecision`, `transferOutcome`) rather than
 * touching prom-client directly, so the metric a call site feeds can be renamed, rebucketed or
 * relabelled in exactly one file. Instrumentation must also never break the work it measures:
 * every method here is synchronous and allocation-cheap, and the registry only fails on
 * duplicate names, which the factory makes impossible.
 */
@Injectable()
export class MetricsService {
  private readonly metrics: IcbMetrics = createMetrics();

  /** Rendered exposition text for the /metrics scrape. */
  render(): Promise<string> {
    return this.metrics.registry.metrics();
  }

  contentType(): string {
    return this.metrics.registry.contentType;
  }

  httpRequest(durationMs: number, labels: { method: string; route: string; status: number }): void {
    this.metrics.httpRequestDurationMs.observe(
      { method: labels.method, route: labels.route, status: String(labels.status) },
      durationMs,
    );
  }

  /** One committed ledger transaction. `rate(icb_ledger_postings_total[1m])` is postings/sec. */
  ledgerPosting(type: string): void {
    this.metrics.ledgerPostings.inc({ type });
  }

  /** A transfer reached a status on a rail — completed, failed, cancelled, in settlement. */
  transferOutcome(rail: string, status: string): void {
    this.metrics.transferOutcomes.inc({ rail, status });
  }

  fraudDecision(decision: string): void {
    this.metrics.fraudDecisions.inc({ decision });
  }

  endOfDayRun(durationMs: number, balanced: boolean): void {
    this.metrics.eodRunDurationMs.observe({ outcome: balanced ? 'balanced' : 'failed' }, durationMs);
  }

  queueDepth(queue: string, state: QueueDepthState, depth: number): void {
    this.metrics.queueDepth.set({ queue, state }, depth);
  }

  deadLetterQueueSize(size: number): void {
    this.metrics.dlqSize.set(size);
  }

  /** Drifted account count from the most recent (cached) ledger integrity check. */
  ledgerDrift(driftedAccounts: number): void {
    this.metrics.ledgerDriftAccounts.set(driftedAccounts);
  }
}
