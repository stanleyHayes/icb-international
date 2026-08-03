import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

// A CLI lives for one job. Periodic sweeps would fire mid-run and then race the shutdown that
// follows, which is how this announced itself: "Dispute watch sweep failed" during a seed.
process.env['BACKGROUND_JOBS_ENABLED'] = 'false';

import { AppModule } from '../../app.module.js';
import { isDomainError } from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { LedgerIntegrityService } from '../../modules/ledger/ledger-integrity.service.js';
import { SeedService } from './seed.service.js';

/**
 * Builds the demo bank, then immediately proves the ledger balances.
 *
 * The verification step is not optional: a seed that produces an unbalanced ledger is worse than
 * no seed at all, because every subsequent test would be measuring against a broken baseline.
 */
async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const config = app.get<AppConfiguration>(CONFIG);
    const seed = app.get(SeedService);
    const integrity = app.get(LedgerIntegrityService);

    process.stdout.write(`\nSeeding ${config.bank.name}${reset ? ' (reset first)' : ''}…\n\n`);
    // Wall-clock elapsed time for the operator, deliberately not the simulated clock: a time
    // jump during seeding must not make the duration nonsensical.
    // eslint-disable-next-line no-restricted-syntax -- see above
    const started = Date.now();
    const result = await seed.run({ reset, seed: config.simulation.seed });
    // eslint-disable-next-line no-restricted-syntax -- wall-clock duration, see above
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);

    process.stdout.write(
      `  customers      ${result.customers}\n` +
        `  accounts       ${result.accounts}\n` +
        `  transactions   ${result.transactions}\n` +
        `  elapsed        ${elapsed}s\n\n`,
    );

    const report = await integrity.verify();
    for (const check of report.checks) {
      process.stdout.write(`  ${check.passed ? '✓' : '✗'} ${check.name} — ${check.detail}\n`);
    }
    process.stdout.write(`\n  Ledger ${report.balanced ? 'BALANCED' : 'UNBALANCED'}\n\n`);

    process.stdout.write('  Sign in with:\n');
    for (const login of result.logins) {
      process.stdout.write(`    ${login.email.padEnd(22)} ${login.password.padEnd(16)} ${login.role}\n`);
    }
    process.stdout.write('\n');

    if (!report.balanced) {
      process.exitCode = 1;
    }
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
  process.stderr.write(`\nSeed failed: ${describe(error)}\n\n`);
  process.exit(1);
});
