import type { Params } from 'nestjs-pino';

import type { AppConfiguration } from '../../config/configuration.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { CORRELATION_ID_HEADER } from './correlation.constants.js';
import { currentCorrelationId } from './correlation.context.js';
import { REDACT_PATHS, REDACTED, scrubText } from './redaction.js';

/**
 * Structured logging.
 *
 * JSON in every environment except local development, where it is pretty-printed — a machine
 * reads the former and a person reads the latter, and pretending one format serves both makes
 * both worse.
 *
 * Health checks are silenced: a liveness probe every second would otherwise be most of the log
 * volume and would bury the lines that matter.
 */
/** Only the fields worth keeping. A whole request object in every line is noise, not context. */
const SERIALIZERS = {
  req: (request: { id: unknown; method: string; url: string; remoteAddress?: string }) => ({
    id: request.id,
    method: request.method,
    url: request.url,
    ip: request.remoteAddress,
  }),
  res: (response: { statusCode: number }) => ({ statusCode: response.statusCode }),
};

/** Pretty output locally, JSON everywhere else. */
function transportFor(config: AppConfiguration) {
  return config.isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, singleLine: true, translateTime: 'HH:MM:ss.l' },
        },
      };
}

export function buildLoggerConfig(config: AppConfiguration): Params {
  return {
    pinoHttp: {
      level: config.logLevel,
      // The correlation id is the thread that ties an HTTP request to its queue jobs, its outbox
      // events, and its audit entries.
      genReqId: (request) => {
        const header = request.headers[CORRELATION_ID_HEADER];
        // pino requires an id; the interceptor stamps one on every request, so this is the
        // fallback for the narrow window before it runs.
        return typeof header === 'string' && header.length > 0 ? header : newId();
      },
      redact: { paths: [...REDACT_PATHS], censor: REDACTED },
      // Every line written inside a correlation scope — request, outbox delivery, queue job —
      // carries the id, so one thread of work reads as one thread in the logs.
      mixin: () => {
        const correlationId = currentCorrelationId();
        return correlationId === null ? {} : { correlationId };
      },
      autoLogging: {
        ignore: (request) => (request.url ?? '').startsWith('/health'),
      },
      customLogLevel: (_request, response, error) => {
        if (error || response.statusCode >= 500) return 'error';
        if (response.statusCode >= 400) return 'warn';
        return 'info';
      },
      // Free-text messages can carry a PAN or a token that no redaction path can address.
      hooks: {
        logMethod(args, method) {
          const scrubbed = args.map((arg) => (typeof arg === 'string' ? scrubText(arg) : arg));
          method.apply(this, scrubbed as Parameters<typeof method>);
        },
      },
      serializers: SERIALIZERS,
      ...transportFor(config),
    },
  };
}
