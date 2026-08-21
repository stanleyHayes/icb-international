import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

const API_ROOT = resolve(import.meta.dirname, '../..');

/**
 * SEC-02 authn/authz suite — separate config so the heavier live-database boot never slows the
 * unit run. Run from `apps/api`: `pnpm vitest run -c test/security/vitest.config.ts`.
 *
 * Every spec boots the real AppModule against the local MongoDB replica set in a randomised
 * database and skips with a message when that infrastructure is genuinely absent.
 */
export default defineConfig({
  root: API_ROOT,
  test: {
    environment: 'node',
    setupFiles: ['vitest.setup.ts', 'test/security/setup.ts'],
    testTimeout: 240_000,
    hookTimeout: 300_000,
    globals: false,
    include: ['test/security/**/*.spec.ts'],
    // Booting four full Nest applications in parallel starves every one of them past the boot
    // bound; sequential files share one transform pass and boot in turn.
    fileParallelism: false,
    pool: 'forks',
  },
});
