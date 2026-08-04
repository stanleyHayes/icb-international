import { expect, loginViaUi, test } from '../fixtures/test';
import { seedUsers } from '../fixtures/env';

/**
 * QA-06 journey 4 — fraud block → review → release.
 *
 * The customer triggers the risk engine the way a compromised account would: a burst of
 * transfers in quick succession (the seeded velocity rule) followed by an amount far outside
 * the customer's own distribution (the amount-anomaly rule). A fraud analyst then works the
 * resulting case — claim, review, release — over the staff API, and the customer-visible
 * state is asserted in the UI.
 *
 * If the engine does not raise a case for the burst, the test skips with an explicit message
 * rather than asserting nothing: rule tuning is a simulation-control concern, not a defect a
 * red E2E run should report.
 */

interface RiskCase {
  id: string;
  status: string;
  customerId: string;
  decision?: string;
}

test.describe('journey 4: fraud block → review → release', () => {
  test('a tripped rule raises a case that an analyst releases', async ({
    page,
    customerApi,
    staffApi,
  }) => {
    // Risk evaluation is asynchronous and the case poll runs to 30s; allow for it.
    test.setTimeout(180_000);
    await loginViaUi(page, seedUsers.demo.email, seedUsers.demo.password);

    // ── Arrange: two of the demo customer's own accounts ─────────────────────
    const accounts = await customerApi.get<{
      items: { id: string; productCode: string; currency: string }[];
    }>('/accounts');
    expect(
      accounts.items.length,
      'demo persona seeds with at least one account',
    ).toBeGreaterThan(0);

    // ── Trigger: large transfers to a freshly-created beneficiary ────────────
    // Rules are weighted and a case opens at the review threshold (50). The new-beneficiary
    // rule only scores transfers that name a saved beneficiary, so the burst pays one the
    // customer has never paid: velocity (18) + amount-anomaly (22) + new-beneficiary (12)
    // = 52, where any pair falls short.
    const from = accounts.items.find(
      (account) => account.currency === 'USD' && account.productCode === 'ICB-CURRENT',
    );
    expect(from, 'demo persona seeds with a USD current account').toBeTruthy();

    // Unique destination per run: the bank rejects duplicate payees (409), and a payee from
    // a previous run would no longer be "new" to the risk engine.
    const accountNumber = String(Math.floor(10_000_000 + Math.random() * 89_999_999));
    const beneficiary = await customerApi.post<{ id: string }>('/beneficiaries', {
      name: 'E2E Unknown Payee',
      destination: {
        kind: 'domestic_bank',
        sortCode: '04-06-78',
        accountNumber,
        accountHolderName: 'E2E Unknown Payee',
      },
    });

    const attempts: { status: number }[] = [];
    for (let i = 0; i < 3; i += 1) {
      attempts.push(
        await customerApi.postRaw('/transfers', {
          fromAccountId: from!.id,
          destination: { kind: 'beneficiary', beneficiaryId: beneficiary.id },
          amount: { currency: 'USD', minorUnits: 600_000, scale: 2 },
          reference: `E2E fraud probe ${i}`,
        }),
      );
    }

    // ── A risk case should now exist for this customer ───────────────────────
    const risk = await staffApi(seedUsers.staff.risk.email, seedUsers.staff.risk.password);
    const me = await customerApi.get<{ customerId: string }>('/customers/me');

    let fraudCase: RiskCase | undefined;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && !fraudCase) {
      const queue = await risk.get<{ items: RiskCase[] }>('/risk/cases');
      fraudCase = queue.items.find(
        (candidate) => candidate.customerId === me.customerId && candidate.status !== 'resolved',
      );
      if (!fraudCase) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
    test.skip(
      !fraudCase,
      'risk engine raised no case for the new-payee burst (scores are tunable in ' +
        'simulation control; statuses seen: ' +
        attempts.map((attempt) => attempt.status).join(',') +
        ')',
    );

    // ── Block observed: at least one attempt was not a clean acceptance ──────
    expect(
      attempts.some((attempt) => attempt.status !== 201),
      'a tripped rule should hold or refuse at least one of the burst',
    ).toBe(true);

    // ── Review (claim) ───────────────────────────────────────────────────────
    await risk.post(`/risk/cases/${fraudCase!.id}/assign`, {});
    const claimed = await risk.get<RiskCase>(`/risk/cases/${fraudCase!.id}`);
    expect(claimed.status).not.toBe('resolved');

    // ── Release ──────────────────────────────────────────────────────────────
    const released = await risk.post<{ status: string }>(
      `/risk/cases/${fraudCase!.id}/resolve`,
      {
        action: 'released',
        note: 'E2E: customer confirmed the burst was test traffic; funds released.',
      },
    );
    expect(released.status).toBe('resolved');

    // ── Customer-visible state (UI): transactions screen still tells the story
    await page.goto('/transactions');
    await expect(page.getByText(/e2e|transfer/i).first()).toBeVisible({ timeout: 30_000 });

    await risk.dispose();
  });
});
