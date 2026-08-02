import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module.js';
import { LedgerIntegrityService } from '../../modules/ledger/ledger-integrity.service.js';

/** Asserts the six ledger invariants (agent_plan.md §4.4). Exits non-zero on any failure. */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });

  try {
    const report = await app.get(LedgerIntegrityService).verify();

    process.stdout.write('\n  Ledger integrity\n\n');
    for (const check of report.checks) {
      process.stdout.write(`  ${check.passed ? '✓' : '✗'} ${check.name}\n      ${check.detail}\n`);
    }
    process.stdout.write(
      `\n  ${report.transactionsChecked} transactions · ${report.entriesChecked} entries · ${report.durationMs}ms\n` +
        `  ${report.balanced ? 'BALANCED' : 'UNBALANCED'}\n\n`,
    );

    if (!report.balanced) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\nVerification failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
