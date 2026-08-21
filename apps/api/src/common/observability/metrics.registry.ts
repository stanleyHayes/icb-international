import promClient from 'prom-client';

/**
 * Every metric the API exports, defined in one place.
 *
 * Names follow the Prometheus conventions (snake_case, unit suffix, `icb_` namespace) so a
 * dashboard query reads the same way as the code. Label sets are kept deliberately small and
 * bounded — route templates and enum values, never ids — because an unbounded label is a
 * time-series bomb that detonates the metrics store, not the app.
 *
 * Each `createMetrics` call builds its own `Registry` rather than using the global one, so a
 * test creating two application containers does not die on duplicate registration.
 */

const HTTP_DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500];
const EOD_DURATION_BUCKETS_MS = [100, 500, 1_000, 5_000, 15_000, 60_000, 300_000];

export interface IcbMetrics {
  readonly registry: promClient.Registry;
  readonly httpRequestDurationMs: promClient.Histogram<'method' | 'route' | 'status'>;
  readonly ledgerPostings: promClient.Counter<'type'>;
  readonly transferOutcomes: promClient.Counter<'rail' | 'status'>;
  readonly fraudDecisions: promClient.Counter<'decision'>;
  readonly eodRunDurationMs: promClient.Histogram<'outcome'>;
  readonly ledgerDriftAccounts: promClient.Gauge<string>;
}

export function createMetrics(): IcbMetrics {
  const registry = new promClient.Registry();
  promClient.collectDefaultMetrics({ register: registry });
  return { registry, ...seriesMetrics(registry), ...gaugeMetrics(registry) };
}

/** Counters and histograms — the series that accumulate. */
function seriesMetrics(registry: promClient.Registry) {
  const httpRequestDurationMs = new promClient.Histogram({
    name: 'icb_http_request_duration_ms',
    help: 'HTTP handler execution time by route template',
    labelNames: ['method', 'route', 'status'],
    buckets: HTTP_DURATION_BUCKETS_MS,
    registers: [registry],
  });

  const ledgerPostings = new promClient.Counter({
    name: 'icb_ledger_postings_total',
    help: 'Ledger transactions posted; rate() gives postings per second',
    labelNames: ['type'],
    registers: [registry],
  });

  const transferOutcomes = new promClient.Counter({
    name: 'icb_transfer_outcomes_total',
    help: 'Transfers reaching an outcome, by payment rail and resulting status',
    labelNames: ['rail', 'status'],
    registers: [registry],
  });

  const fraudDecisions = new promClient.Counter({
    name: 'icb_fraud_decisions_total',
    help: 'Risk engine decisions by outcome (allow, challenge, review, block)',
    labelNames: ['decision'],
    registers: [registry],
  });

  const eodRunDurationMs = new promClient.Histogram({
    name: 'icb_eod_run_duration_ms',
    help: 'End-of-day pipeline duration by outcome',
    labelNames: ['outcome'],
    buckets: EOD_DURATION_BUCKETS_MS,
    registers: [registry],
  });

  return { httpRequestDurationMs, ledgerPostings, transferOutcomes, fraudDecisions, eodRunDurationMs };
}

/** Gauges — point-in-time values fed by the cached integrity check. */
function gaugeMetrics(registry: promClient.Registry) {
  const ledgerDriftAccounts = new promClient.Gauge({
    name: 'icb_ledger_drift_accounts',
    help: 'Accounts whose cached balance disagrees with the ledger, from the cached integrity check',
    registers: [registry],
  });

  return { ledgerDriftAccounts };
}
