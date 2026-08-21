/**
 * Tracing entry point — imported first from `main.ts`, before any application module.
 *
 * The enable flag is read straight from the environment rather than through AppConfiguration:
 * auto-instrumentations must hook `mongoose` and friends *before* it is first
 * imported, and the configuration module is itself part of the graph that must load second.
 * The values are validated properly later by configuration.schema.ts at application boot; here
 * they only decide whether the SDK loads at all. Default is off — no flag, no SDK, no cost.
 */
if (process.env['OTEL_ENABLED'] === 'true') {
  const { startTracing } = await import('./common/observability/tracing.js');
  await startTracing({
    serviceName: process.env['OTEL_SERVICE_NAME'] ?? 'icb-api',
    exporterEndpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318',
  });
}
