import fs from 'node:fs';

import { expect, test } from 'playwright/test';

import { CUSTOMER } from '../support/credentials';
import { AUTH_DIR, STORAGE_STATE } from '../support/paths';
import { readAvailability } from '../support/state';

/**
 * Sign the demo customer in through the real login UI and stash the session.
 * The scan project reuses it via storageState — one login per run, not per route.
 */

const availability = readAvailability();
const canRun = availability.api && availability.apps['client'] === true;

test.skip(!canRun, 'client app or API not reachable; skipping client auth setup');

test('customer login persists session', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(CUSTOMER.email);
  await page.getByLabel('Password', { exact: true }).fill(CUSTOMER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Server action signs in and redirects into the dashboard shell.
  try {
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  } catch (error) {
    // The login endpoint is throttled per IP; a 429 under repeated runs is transient.
    const alert = page.getByRole('alert').first();
    const text = (await alert.textContent().catch(() => '')) ?? '';
    test.skip(
      /too many requests|rate.?limit/i.test(text),
      'login throttled by the API (429); retry after the throttle window resets',
    );
    throw error;
  }
  await page.goto('/');
  await expect(page).not.toHaveURL(/\/login/);

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE.client });
});
