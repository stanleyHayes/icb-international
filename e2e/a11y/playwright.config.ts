import path from 'node:path';

import { defineConfig } from 'playwright/test';

import { AUTH_DIR, BASE_URLS } from './support/paths';

// Marks workers spawned by THIS config, so the a11y specs skip cleanly when the QA-06
// root config (testDir ./e2e) sweeps them up — they are only runnable here.
process.env['A11Y_SUITE'] = '1';

/**
 * QA-07 a11y automation: axe-core on every route of all three apps plus keyboard
 * traversal of the key flows. Run from the repo root:
 *
 *   pnpm test:a11y                 # full suite (needs the stack up — see README)
 *   pnpm test:a11y -- --project=marketing
 *
 * The stack is NOT booted by this config: it needs Mongo (replica set), the API on
 * :4100 seeded with demo data, and the three Next apps. Global setup probes everything
 * and skips with a message where infra is genuinely absent.
 */

export default defineConfig({
  testDir: __dirname,
  testMatch: ['*.spec.ts', 'setup/*.setup.ts'],
  globalSetup: path.join(__dirname, 'global-setup.ts'),
  globalTeardown: path.join(__dirname, 'global-teardown.ts'),
  outputDir: path.join(__dirname, 'results', 'artifacts'),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(__dirname, 'results', 'playwright.json') }],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'en-GB',
  },
  projects: [
    {
      name: 'setup-client',
      testMatch: 'setup/client.setup.ts',
      use: { baseURL: BASE_URLS.client },
    },
    {
      name: 'setup-admin',
      testMatch: 'setup/admin.setup.ts',
      use: { baseURL: BASE_URLS.admin },
    },
    {
      name: 'marketing',
      testMatch: 'marketing.spec.ts',
      use: { baseURL: BASE_URLS.marketing },
    },
    {
      name: 'client',
      testMatch: ['client.spec.ts', 'keyboard.client.spec.ts'],
      dependencies: ['setup-client'],
      use: {
        baseURL: BASE_URLS.client,
        storageState: path.join(AUTH_DIR, 'client.json'),
      },
    },
    {
      name: 'admin',
      testMatch: ['admin.spec.ts', 'keyboard.admin.spec.ts'],
      dependencies: ['setup-admin'],
      use: {
        baseURL: BASE_URLS.admin,
        storageState: path.join(AUTH_DIR, 'admin.json'),
      },
    },
    {
      name: 'keyboard-marketing',
      testMatch: 'keyboard.marketing.spec.ts',
      use: { baseURL: BASE_URLS.marketing },
    },
  ],
});
