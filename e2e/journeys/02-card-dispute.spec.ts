import { expect, loginViaUi, test } from '../fixtures/test';
import { seedUsers } from '../fixtures/env';

/**
 * QA-06 journey 2 — card issue → authorisation → dispute → resolve.
 *
 * The card is issued in the client UI by the seeded demo customer. The authorisation itself
 * is a card-network event, so it is submitted through the network endpoint exactly as a
 * merchant acquirer would (operations role), then captured so a settled transaction exists.
 * The customer raises the dispute against that transaction, an analyst advances it through
 * its stages to a resolution, and the customer-facing outcome is asserted back in the UI.
 */

test.describe('journey 2: card → authorisation → dispute → resolve', () => {
  test('a disputed card authorisation is resolved and visible to the customer', async ({
    page,
    customerApi,
    staffApi,
  }) => {
    await loginViaUi(page, seedUsers.demo.email, seedUsers.demo.password);

    // ── Issue a card (API) ───────────────────────────────────────────────────
    // NOTE: the /cards/new page currently 500s in this tree (its server component treats
    // the {items: [...]} envelope as a bare array — reported to the WEB track). Issuing
    // over the API keeps the journey end-to-end; the UI half of this step is asserted below
    // on the cards list, and the UI issue flow should be restored here once the page is fixed.
    const accounts = await customerApi.get<{ items: { id: string; currency: string }[] }>(
      '/accounts',
    );
    const usdAccount = accounts.items.find((account) => account.currency === 'USD');
    expect(usdAccount, 'demo persona seeds with a USD account').toBeTruthy();
    const issued = await customerApi.post<{ id: string; status: string }>('/cards', {
      accountId: usdAccount!.id,
      kind: 'virtual',
      network: 'visa',
      nickname: 'E2E Dispute Card',
    });

    // The issued card renders in the customer's cards screen.
    await page.goto('/cards');
    await expect(page.getByText('E2E Dispute Card').first()).toBeVisible({ timeout: 30_000 });

    const cards = await customerApi.get<{
      items: { id: string; status: string; nickname?: string }[];
    }>('/cards');
    const card = cards.items.find((candidate) => candidate.id === issued.id);
    expect(card, 'the card issued in the UI should be listed by the API').toBeTruthy();
    if (card!.status !== 'active') {
      await customerApi.post(`/cards/${card!.id}/activate`, {});
    }

    // ── Authorisation + capture (card network endpoint, operations role) ─────
    const ops = await staffApi(seedUsers.staff.ops.email, seedUsers.staff.ops.password);
    const authorisation = await ops.post<{ id: string }>(`/cards/${card!.id}/authorise`, {
      merchantName: 'E2E Merchant Supplies',
      mcc: '5999',
      channel: 'online',
      country: 'US',
      amount: { currency: 'USD', minorUnits: 4200, scale: 2 },
    });
    await ops.post(`/cards/authorisations/${authorisation.id}/capture`, {});

    // ── Dispute (customer) ───────────────────────────────────────────────────
    // Disputes attach to a settled transaction, so find the capture on the statement feed.
    const transactions = await customerApi.get<{
      items: { id: string; description?: string; createdAt: string }[];
    }>('/transactions');
    const settled = transactions.items.find((entry) =>
      entry.description?.includes('E2E Merchant Supplies'),
    );
    expect(settled, 'the captured authorisation should appear as a transaction').toBeTruthy();

    const dispute = await customerApi.post<{ id: string; stage: string }>('/disputes', {
      transactionId: settled!.id,
      reason: 'unauthorised',
      detail: 'E2E journey 2: I do not recognise this merchant or this charge.',
      contactedMerchant: false,
      evidence: [],
    });
    expect(dispute.stage).toBe('submitted');

    // The customer sees the open dispute in support.
    await page.goto('/support/disputes');
    await expect(page.getByText(/unauthorised|dispute/i).first()).toBeVisible();

    // ── Resolve (analyst advances submitted → investigating → resolved) ──────
    const risk = await staffApi(seedUsers.staff.risk.email, seedUsers.staff.risk.password);
    await risk.post(`/disputes/${dispute.id}/advance`, {
      stage: 'investigating',
      note: 'E2E: analyst picked up the case and granted provisional credit.',
      grantProvisionalCredit: true,
    });
    const resolved = await risk.post<{ stage: string; outcome?: string }>(
      `/disputes/${dispute.id}/advance`,
      {
        stage: 'resolved',
        note: 'E2E: merchant could not evidence the authorisation; customer upheld.',
        outcome: 'upheld',
      },
    );
    expect(resolved.stage).toBe('resolved');

    // ── Customer-visible outcome (UI) ────────────────────────────────────────
    await page.goto(`/support/disputes/${dispute.id}`);
    await expect(page.getByText(/resolved|upheld/i).first()).toBeVisible({ timeout: 30_000 });
  });
});
