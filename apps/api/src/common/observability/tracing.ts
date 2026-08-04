/**
 * OpenTelemetry tracing bootstrap.
 *
 * Everything in this module is imported dynamically, on purpose: the SDK, the auto
 * instrumentations and the exporter are only loaded when `OTEL_ENABLED=true` reaches the
 * process, so the default deployment never pays the module-load or memory cost of a feature it
 * does not use. The entry point (`instrumentation.ts`, imported first from `main.ts`) calls
 * `startTracing` before the application modules load, because an auto-instrumentation can only
 * hook a library it beats to `require`.
 */
export interface TracingOptions {
  readonly serviceName: string;
  /** Base OTLP/HTTP endpoint, e.g. `http://localhost:4318`; `/v1/traces` is appended here. */
  readonly exporterEndpoint: string;
}

export interface TracingHandle {
  shutdown(): Promise<void>;
}

export async function startTracing(options: TracingOptions): Promise<TracingHandle> {
  const [{ NodeSDK }, { getNodeAutoInstrumentations }, { OTLPTraceExporter }] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/auto-instrumentations-node'),
    import('@opentelemetry/exporter-trace-otlp-http'),
  ]);

  // The SDK builds its default resource from the environment; naming the service this way
  // keeps the option in one vocabulary (our config) instead of two.
  process.env['OTEL_SERVICE_NAME'] ??= options.serviceName;

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: `${options.exporterEndpoint}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs instrumentation traces every file read — enormous volume, zero diagnostic value.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  return { shutdown: () => sdk.shutdown() };
}
