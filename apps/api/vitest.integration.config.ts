import { defineConfig } from 'vitest/config';

/**
 * Integration suite (agent_plan.md §10): full request → real Mongo replica set → response.
 *
 * Kept out of the unit config (`include: src/**`) on purpose: these specs boot the entire
 * Nest application per file against a randomised database, which is far too slow and too
 * stateful to mix into the unit run. Each spec file skips with a message when MongoDB is
 * genuinely unreachable — an absent database must never read as a product failure.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // Reuses the unit setup, which loads the repository .env before anything reads config.
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    globals: false,
    include: ['test/integration/**/*.spec.ts'],
    // Each suite boots the whole app against the dev replica set. Uncapped workers (one per
    // CPU) put five boots on one Mongo and the suite goes intermittently red — the same
    // contention vitest.contract.config.ts caps at two. Matched here for the same reason.
    maxWorkers: 2,
    // One app boot per file already isolates state; a fork per file keeps process.env
    // overrides (MONGO_URI) from leaking between suites.
    pool: 'forks',
  },
});
