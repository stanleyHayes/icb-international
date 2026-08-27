import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

// A CLI lives for one job. Periodic sweeps would fire mid-run and then race the shutdown that
// follows, so they stay off for the duration.
process.env['BACKGROUND_JOBS_ENABLED'] = 'false';

import { AppModule } from '../../app.module.js';
import { isDomainError } from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';

import { ConsoleProvisioningService } from './console-provisioning.service.js';

/**
 * Creates or refreshes the standing operations-console sign-ins.
 *
 * Safe to run against an environment that already has them: every write is an upsert keyed on the
 * address, so a second run rotates the password and re-applies the roles rather than failing. That
 * makes this the rotation path as well as the provisioning path.
 *
 * The password is never printed. It came from the environment, so echoing it would only move a
 * secret from a place that holds it deliberately into shell history and CI logs.
 */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const config = app.get<AppConfiguration>(CONFIG);
    const password = config.seed.consoleAccountPassword;

    if (!password) {
      process.stderr.write(
        '\nCONSOLE_ACCOUNT_PASSWORD is not set.\n\n' +
          '  This is the password applied to the operations-console sign-ins. It is read from the\n' +
          '  environment rather than stored in the repository, so set it where the other secrets\n' +
          '  live — the Render dashboard in production, apps/api/.env.production locally — and run\n' +
          '  this again.\n\n',
      );
      process.exitCode = 1;
      return;
    }

    const provisioning = app.get(ConsoleProvisioningService);
    const results = await provisioning.provisionAll(password);

    process.stdout.write('\n  Operations console accounts\n\n');
    for (const account of results) {
      const state = account.credentialCreated ? 'created' : 'updated';
      process.stdout.write(
        `    ${account.email.padEnd(44)} ${String(account.roles.length).padStart(2)} roles  ${state}\n`,
      );
    }
    process.stdout.write(
      '\n  Password: as set in CONSOLE_ACCOUNT_PASSWORD (not printed).\n' +
        '  Each account must enrol a second factor on first sign-in before the console opens.\n\n',
    );
  } finally {
    await app.close();
  }
}

/**
 * A refusal the operator can act on gets the sentence; anything unexpected gets the stack,
 * because that is the case where the trace is the only thing that helps.
 */
function describe(error: unknown): string {
  if (isDomainError(error)) {
    return error.message;
  }
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

main().catch((error: unknown) => {
  process.stderr.write(`\nConsole provisioning failed: ${describe(error)}\n\n`);
  process.exit(1);
});
