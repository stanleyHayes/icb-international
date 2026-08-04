import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

const contractsOpenapi = resolve(import.meta.dirname, '../../packages/contracts/scripts/openapi');

/**
 * Contract-test runner (QA-04): every controller response parsed against its @icb/contracts
 * route-table schema.
 *
 * Kept out of the unit config (`include: src/**`) on purpose: each suite boots the whole
 * application and seeds a full bank against the dev replica set, so the layer runs on demand
 * (`pnpm test:contract`) and in CI, not on every unit-test invocation. Suites skip with a
 * message when MongoDB is genuinely absent.
 */
export default defineConfig({
  resolve: {
    alias: [
      // Suites import the OpenAPI route tables straight from the contracts package source; the
      // package only publishes dist/, so alias the specifiers.
      {
        find: /^@icb\/contracts\/openapi\/routes\/(.+)$/,
        replacement: `${contractsOpenapi}/routes/$1.ts`,
      },
      { find: '@icb/contracts/openapi/spec', replacement: `${contractsOpenapi}/spec.ts` },
      { find: '@icb/contracts/openapi', replacement: `${contractsOpenapi}/routes/index.ts` },
    ],
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
    include: ['test/contract/**/*.spec.ts'],
    // Every suite boots the full Nest app and seeds a whole bank against the dev replica set.
    // Uncapped workers (one per CPU) saturate a laptop Mongo — probes time out, pools get
    // cleared, and suites then skip vacuously. Two workers with a 10-socket pool per boot (see
    // harness retargetDatabase) is the measured ceiling for real assertions on the Docker-
    // proxied dev Mongo; raise only on beefier CI hardware.
    maxWorkers: 2,
    // A boot + full-bank seed per suite file has been measured past 180s under CI load.
    testTimeout: 180_000,
    hookTimeout: 600_000,
  },
});
