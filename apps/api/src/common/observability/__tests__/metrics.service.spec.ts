import { describe, expect, it } from 'vitest';

import { MetricsService } from '../metrics.service.js';

/** A service under test plus its rendered exposition text. */
async function rendered(act: (metrics: MetricsService) => void): Promise<string> {
  const metrics = new MetricsService();
  act(metrics);
  return metrics.render();
}

describe('MetricsService', () => {
  it('two instances build independent registries without a duplicate-registration clash', () => {
    expect(() => new MetricsService()).not.toThrow();
    expect(() => new MetricsService()).not.toThrow();
  });

  it('exposes the Prometheus text content type', () => {
    expect(new MetricsService().contentType()).toContain('text/plain');
  });

  it('records an HTTP observation under its route template labels', async () => {
    const text = await rendered((m) =>
      m.httpRequest(42, { method: 'POST', route: '/v1/transfers/:id', status: 201 }),
    );
    expect(text).toContain('icb_http_request_duration_ms');
    expect(text).toContain('route="/v1/transfers/:id"');
  });

  it('counts ledger postings by type — the base series for postings/sec', async () => {
    const text = await rendered((m) => {
      m.ledgerPosting('transfer_out');
      m.ledgerPosting('transfer_out');
    });
    expect(text).toContain('icb_ledger_postings_total{type="transfer_out"} 2');
  });

  it('counts transfer outcomes by rail and status', async () => {
    const text = await rendered((m) => m.transferOutcome('ach', 'completed'));
    expect(text).toContain('icb_transfer_outcomes_total{rail="ach",status="completed"} 1');
  });

  it('counts fraud decisions by outcome', async () => {
    const text = await rendered((m) => m.fraudDecision('review'));
    expect(text).toContain('icb_fraud_decisions_total{decision="review"} 1');
  });

  it('observes end-of-day duration with the balance outcome as the label', async () => {
    const text = await rendered((m) => m.endOfDayRun(1_500, true));
    expect(text).toContain('icb_eod_run_duration_ms');
    expect(text).toContain('outcome="balanced"');
  });

  it('sets queue depth, DLQ size and ledger drift gauges', async () => {
    const text = await rendered((m) => {
      m.queueDepth('accruals', 'waiting', 7);
      m.deadLetterQueueSize(2);
      m.ledgerDrift(0);
    });
    expect(text).toContain('icb_queue_depth{queue="accruals",state="waiting"} 7');
    expect(text).toContain('icb_dlq_size 2');
    expect(text).toContain('icb_ledger_drift_accounts 0');
  });
});
