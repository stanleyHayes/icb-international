import { expect, loginViaUi, test } from '../fixtures/test';
import { env, seedUsers, uniqueEmail } from '../fixtures/env';
import { markEmailVerified } from '../fixtures/db';
import { ApiClient } from '../fixtures/api';

/**
 * QA-06 journey 1 — the full customer lifecycle, driven through the client UI:
 * signup → email verification → KYC (identity, documents, liveness) → account open →
 * transfer → statement.
 *
 * The only step not executed in a browser is the email loop itself: the recording transport
 * never leaves the API process, so the test completes verification the way a mail-capture
 * harness would — by flipping the flag on the row the API wrote (see fixtures/db.ts).
 * The KYC *decision* is a back-office act and is made by seeded operations staff over the API.
 */

const PASSWORD = 'E2e-Password!234';

// A 1×1 PNG stands in for each captured document; the bank validates type and presence,
// not photographic content, in the simulation.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const upload = { name: 'document.png', mimeType: 'image/png', buffer: TINY_PNG };

async function completeOnboarding(page: import('playwright/test').Page): Promise<void> {
  await page.goto('/onboarding?step=identity');
  await page.getByLabel(/date of birth/i).fill('1990-04-12');
  await page.getByLabel(/nationality/i).fill('GH');
  await page.getByLabel(/street address/i).fill('1 Independence Avenue');
  await page.getByLabel(/city/i).fill('Accra');
  await page.getByLabel(/country/i).fill('GH');
  await page.getByRole('button', { name: /continue to documents/i }).click();
  await page.waitForURL(/step=documents/);

  // Uploads are direct-to-provider and asynchronous; each must be confirmed received before
  // navigating, or the next step renders with the document still in flight.
  const identitySection = page.locator('section:has-text("Identity document")').first();
  await identitySection.locator('input[type="file"]').first().setInputFiles(upload);
  await expect(identitySection.getByText(/received/i)).toBeVisible({ timeout: 30_000 });

  const addressSection = page.getByRole('region', { name: 'Proof of address' });
  await addressSection.locator('input[type="file"]').setInputFiles(upload);
  await expect(addressSection.getByText(/received/i)).toBeVisible({ timeout: 30_000 });

  await page.getByRole('link', { name: /continue to face check/i }).click();
  await page.waitForURL(/step=liveness/);

  await page.getByLabel(/take a selfie/i).setInputFiles(upload);
  // "Retake" only renders once the selfie has landed server-side.
  await expect(page.getByRole('button', { name: 'Retake' })).toBeVisible({ timeout: 30_000 });
  await page.getByText(/the documents and details i provided are genuine/i).click();
  await page.getByRole('button', { name: /submit for verification/i }).click();
  await page.waitForURL(/step=account/);

  await page.getByLabel(/nickname/i).fill('E2E Everyday');
  await page.getByRole('button', { name: 'Open account', exact: true }).click();
  await page.waitForURL(/step=done/, { timeout: 30_000 });
}

test.describe('journey 1: signup → KYC → account → transfer → statement', () => {
  test('a new customer completes the full banking lifecycle', async ({ page, staffApi }) => {
    const email = uniqueEmail('j1');

    // ── Signup (UI) ──────────────────────────────────────────────────────────
    await page.goto('/signup');
    await page.getByLabel('First name').fill('Efe');
    await page.getByLabel('Last name').fill('E2ETest');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel(/email address/i).fill(email);
    // PhoneInput composes E.164 from its dial-code dropdown + national digits; typing the
    // '+' ourselves double-prefixes. Plain national digits always produce a valid number.
    await page.getByLabel(/mobile number/i).fill('7700900123');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByLabel(/confirm password/i).fill(PASSWORD);
    // Custom Checkbox: a styled SVG sits over the native input, so click the label text.
    await page.getByText(/i agree to the account terms/i).click();
    await page.getByRole('button', { name: 'Open account', exact: true }).click();
    await expect(page.getByText(/verification code/i).first()).toBeVisible({ timeout: 60_000 });

    // ── Email verification (mail-loop bypass, see file header) ───────────────
    await markEmailVerified(email);

    // ── Login + KYC wizard (UI) ──────────────────────────────────────────────
    await loginViaUi(page, email, PASSWORD);
    await completeOnboarding(page);
    await expect(
      page.getByRole('heading', { name: /you’re all set|you're all set/i }),
    ).toBeVisible();

    // ── KYC approval (operations staff, API) ─────────────────────────────────
    const customer = await ApiClient.login(email, PASSWORD);
    const kycCase = await customer.get<{ id: string; status: string }>('/kyc/case');
    const ops = await staffApi(seedUsers.staff.ops.email, seedUsers.staff.ops.password);
    await ops.post(`/kyc/cases/${kycCase.id}/decision`, {
      outcome: 'approved',
      reason: 'E2E: documents and liveness verified by automation.',
    });

    // ── Second account as transfer destination (fixture setup, API) ──────────
    // Product rules cap one current account per currency, so the destination is whichever
    // seeded product the customer does not yet hold.
    const accounts = await customer.get<{
      items: { id: string; productCode: string; identifiers: { number: string } }[];
    }>('/accounts');
    const source = accounts.items[0];
    expect(source, 'onboarding should have opened one account').toBeTruthy();
    const products = await customer.get<{ code: string; active: boolean }[]>('/products');
    const other = products.find((product) => product.active && product.code !== source.productCode);
    expect(other, 'seed should offer at least two active products').toBeTruthy();
    await customer.post<{ id: string }>('/accounts', {
      productCode: other!.code,
      currency: 'USD',
      nickname: 'E2E Savings',
    });

    // ── Fund the new account (fixture setup, API) ────────────────────────────
    // Onboarding opens an empty account; the demo persona pays in over the real internal
    // rail so the money still moves double-entry through the ledger, never via the database.
    const demo = await ApiClient.login(seedUsers.demo.email, seedUsers.demo.password);
    const demoAccounts = await demo.get<{
      items: { id: string; currency: string; productCode: string }[];
    }>('/accounts');
    const demoSource = demoAccounts.items.find(
      (account) => account.currency === 'USD' && account.productCode === 'ICB-CURRENT',
    );
    expect(demoSource, 'demo persona seeds with a USD current account').toBeTruthy();
    await demo.post('/transfers', {
      fromAccountId: demoSource!.id,
      destination: { kind: 'icb_customer', accountNumber: source.identifiers.number },
      amount: { currency: 'USD', minorUnits: 10000, scale: 2 },
      reference: 'E2E opening deposit',
    });
    await demo.dispose();

    // ── Transfer (UI wizard): details → quote → confirm ──────────────────────
    await page.goto('/transfer/new');
    // Option labels carry a dynamic mask ("E2E Everyday · •••• 5630"), so resolve the value
    // of the option whose text names the account rather than guessing at indices.
    const fromSelect = page.getByLabel(/^from/i);
    await fromSelect.selectOption(
      await fromSelect.locator('option', { hasText: 'Everyday' }).getAttribute('value'),
    );
    const toSelect = page.getByLabel(/^to account/i);
    await toSelect.selectOption(
      await toSelect.locator('option', { hasText: 'Savings' }).getAttribute('value'),
    );
    await page.getByLabel(/amount/i).fill('25.00');
    await page.getByLabel(/reference/i).fill('E2E journey 1');
    await page.getByRole('button', { name: 'Review quote' }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: /confirm transfer|verify and confirm/i }).click();
    await expect(page.getByText(/transfer (sent|scheduled|pending approval)/i).first()).toBeVisible(
      { timeout: 30_000 },
    );

    // ── Statement (API generate, UI verify) ──────────────────────────────────
    // The window is computed from the bank's simulated business date — never a hard-coded
    // date, and never one that reaches past "now" (the API rejects future windows).
    const readyResponse = await fetch(`${env.apiUrl}/health/ready`);
    const { businessDate } = (await readyResponse.json()) as { businessDate: string };
    const windowStart = new Date(`${businessDate}T00:00:00Z`);
    windowStart.setUTCDate(windowStart.getUTCDate() - 30);
    const statement = await customer.post<{ id: string }>('/statements/generate', {
      accountId: source.id,
      from: windowStart.toISOString().slice(0, 10),
      to: businessDate,
    });
    expect(statement.id).toBeTruthy();

    await page.goto('/documents');
    await expect(page.getByText(/statement/i).first()).toBeVisible();
    await customer.dispose();
    await ops.dispose();
  });
});
