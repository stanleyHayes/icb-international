import fs from 'node:fs';

import { expect, test, type Page } from 'playwright/test';

import { ADMIN_TOTP_FILE, AUTH_DIR, STORAGE_STATE } from '../support/paths';
import { STAFF_ENROLLED, STAFF_UNENROLLED } from '../support/credentials';
import { readAvailability } from '../support/state';
import { totpCodes } from '../support/totp';

/**
 * Staff sessions for the admin console.
 *
 * Console layout refuses staff without an enrolled second factor, so the console state
 * uses STAFF_ENROLLED (TOTP enrolled by global setup; secret in .auth/admin-totp.json)
 * and signs in through the two-step login UI. A second state keeps STAFF_UNENROLLED
 * signed in at the /mfa-enrol gate so that page can be scanned too.
 */

const availability = readAvailability();
const canRun = availability.api && availability.apps['admin'] === true;

test.skip(!canRun, 'admin app or API not reachable; skipping admin auth setup');
test.describe.configure({ mode: 'serial' });

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

test('enrolled staff login persists console session', async ({ page }) => {
  test.skip(!availability.adminTotp, 'staff TOTP not enrolled (see global setup notes)');

  const { secret } = JSON.parse(fs.readFileSync(ADMIN_TOTP_FILE, 'utf8')) as { secret: string };
  await fillCredentials(page, STAFF_ENROLLED.email, STAFF_ENROLLED.password);

  const codeInput = page.getByLabel('Verification code');
  try {
    await expect(codeInput).toBeVisible({ timeout: 20_000 });
  } catch (error) {
    await skipIfThrottled(page);
    throw error;
  }
  await codeInput.fill(totpCodes(secret)[0]);
  await page.getByRole('button', { name: 'Verify and sign in' }).click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.goto('/');
  await expect(page).not.toHaveURL(/\/login|\/mfa-enrol/);

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE.admin });
});

test('unenrolled staff session parks at the MFA gate', async ({ page }) => {
  await fillCredentials(page, STAFF_UNENROLLED.email, STAFF_UNENROLLED.password);
  try {
    await page.waitForURL('**/mfa-enrol', { timeout: 30_000 });
  } catch (error) {
    await skipIfThrottled(page);
    throw error;
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE.adminUnenrolled });
});
