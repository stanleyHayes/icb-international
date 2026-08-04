import { defineConfig, devices } from 'playwright/test';

/**
 * QA-06 — Playwright E2E for the four §10 journeys.
 *
 * The suite drives the client app (Next.js RSC, sealed server-side session cookie) in a real
 * browser for every customer-facing step. Staff-side steps (KYC decision, dispute advance,
 * loan approval, fraud release) are executed against the API with a seeded staff token — the
 * admin UI is covered by the same endpoints, and driving two apps in one test doubles the
 * flake surface without adding coverage.
 *
 * Ports come from the root `.env` (API 4100, client 3101). `webServer` boots the client dev
 * server when it is not already running and reuses anything already up. The API and Mongo are
 * prerequisites (see e2e/README.md); specs skip with an explicit message when the stack is
 * genuinely absent rather than false-failing.
 *
 * §10 asks for Chromium + WebKit, desktop + mobile viewport. All four projects are declared;
 * CI runs the full matrix, local runs default to whatever is installed.
 */

const CLIENT_URL = process.env.E2E_CLIENT_URL ?? 'http://localhost:3101';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4100';

export default defineConfig({
  testDir: './e2e',
  // QA-07's axe suite also lives under e2e/ (e2e/a11y); this config owns only the journeys.
  testMatch: 'journeys/**/*.spec.ts',
  outputDir: './e2e/.artifacts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: CLIENT_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @icb/client dev',
      url: `${CLIENT_URL}/login`,
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @icb/api dev',
      url: `${API_URL}/health`,
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
