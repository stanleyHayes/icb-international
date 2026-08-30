import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import { MAX_UPLOAD_BYTES } from '@icb/media';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter.js';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor.js';
import { CONFIG, type AppConfiguration } from './config/configuration.js';

export interface BootstrapOptions {
  enableShutdownHooks?: boolean;
}

export async function createConfiguredApp(
  options: BootstrapOptions = {},
): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 10 * 1024 * 1024 }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(PinoLogger));

  const config = app.get<AppConfiguration>(CONFIG);
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await fastify.register(fastifyCookie, { secret: config.crypto.cookieSecret });
  await fastify.register(fastifyMultipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

  app.enableCors({
    origin: [...config.http.corsOrigins],
    credentials: true,
    allowedHeaders: ['content-type', 'authorization', 'idempotency-key', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id', 'x-icb-environment'],
  });

  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready', 'health/ledger', 'metrics'] });
  app.useGlobalInterceptors(new CorrelationInterceptor());
  app.useGlobalFilters(new ProblemDetailsFilter());

  if (options.enableShutdownHooks ?? true) {
    app.enableShutdownHooks();
  }

  return app;
}
