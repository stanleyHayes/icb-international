// Must stay first: auto-instrumentations only hook libraries loaded after them.
import './instrumentation.js';
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { createConfiguredApp } from './bootstrap.js';
import { CONFIG, type AppConfiguration } from './config/configuration.js';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await createConfiguredApp({ enableShutdownHooks: true });

  const config = app.get<AppConfiguration>(CONFIG);
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
