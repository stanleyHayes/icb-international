import fs from 'node:fs';

import { expect, test, type Page } from 'playwright/test';

import { AUTH_DIR, STORAGE_STATE } from '../support/paths';
import { STAFF } from '../support/credentials';
import { readAvailability } from '../support/state';

/**
 * Staff session for the admin console: signs STAFF in through the login UI and persists
 * the storage state the console scans run against.
 */

const availability = readAvailability();
const canRun = availability.api && availability.apps['admin'] === true;

test.skip(!canRun, 'admin app or API not reachable; skipping admin auth setup');

async function fillCredentials(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** The login endpoint is throttled per IP; under repeated suite runs a 429 is transient. */
async function skipIfThrottled(page: Page): Promise<void> {
  const alert = page.getByRole('alert').first();
  if (await alert.isVisible().catch(() => false)) {
    const text = (await alert.textContent()) ?? '';
    test.skip(
      /too many requests|rate.?limit/i.test(text),
      `login throttled by the API (429); retry after the throttle window resets`,
    );
  }
}

test('staff login persists console session', async ({ page }) => {
  await fillCredentials(page, STAFF.email, STAFF.password);

  try {
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  } catch (error) {
    await skipIfThrottled(page);
    throw error;
  }
  await page.goto('/');
  await expect(page).not.toHaveURL(/\/login/);

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE.admin });
});
