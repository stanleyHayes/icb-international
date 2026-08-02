import 'reflect-metadata';

import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter.js';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor.js';
import { CONFIG, type AppConfiguration } from './config/configuration.js';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 10 * 1024 * 1024 }),
    { bufferLogs: true },
  );

  // Structured, PII-redacted logging replaces Nest's default from here on.
  app.useLogger(app.get(PinoLogger));

  const config = app.get<AppConfiguration>(CONFIG);

  // Registered on the raw Fastify instance rather than through Nest's wrapper: both plugins
  // declaration-merge members onto FastifyInstance, and the wrapper's signature is typed against
  // the un-augmented type, so they no longer line up despite being the same runtime version.
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false, // The API serves JSON; the apps set their own CSP.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await fastify.register(fastifyCookie, { secret: config.crypto.cookieSecret });

  app.enableCors({
    origin: [...config.http.corsOrigins],
    credentials: true,
    allowedHeaders: ['content-type', 'authorization', 'idempotency-key', 'x-correlation-id', 'x-step-up-token'],
    exposedHeaders: ['x-correlation-id', 'x-icb-environment'],
  });

  // One versioning mechanism, not two: the global prefix *is* the version. Adding
  // enableVersioning on top would produce /v1/v1/... for every route.
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
  app.useGlobalInterceptors(new CorrelationInterceptor());
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();

  await app.listen({ port: config.http.port, host: config.http.host });

  logger.log(`${config.bank.name} API listening on http://${config.http.host}:${config.http.port}`);
  logger.log(`Email: ${config.email.enabled ? 'Resend' : 'recording transport (no key)'}`);
  logger.log(`Media: ${config.media.enabled ? 'Cloudinary' : 'local store (no key)'}`);
}

bootstrap().catch((error: unknown) => {
  // Configuration and connection failures land here. Print the cause plainly — a stack trace
  // buried under a framework wrapper helps nobody at 3am.
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nICB API failed to start:\n${message}\n`);
  process.exit(1);
});
