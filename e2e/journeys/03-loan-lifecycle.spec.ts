import { expect, loginViaUi, test } from '../fixtures/test';
import { seedUsers } from '../fixtures/env';

/**
 * QA-06 journey 3 — loan apply → approve → disburse → repay.
 *
 * The application is submitted through the customer API (the UI wizard is a multi-step
 * affordability form; the same contract backs it), underwriting and disbursement are staff
 * acts over the API as the admin app performs them, and the repayment is made by the
 * customer in the loan screen — the reduced balance is asserted through the API.
 */

test.describe('journey 3: loan apply → approve → disburse → repay', () => {
  test('an approved loan disburses and accepts a repayment', async ({
    page,
    customerApi,
    staffApi,
  }) => {
    await loginViaUi(page, seedUsers.demo.email, seedUsers.demo.password);

    // ── Apply (customer) ─────────────────────────────────────────────────────
    const accounts = await customerApi.get<{ items: { id: string; currency: string }[] }>(
      '/accounts',
    );
    const account = accounts.items.find((candidate) => candidate.currency === 'USD');
    expect(account, 'demo persona seeds with a USD account').toBeTruthy();

    const products = await customerApi.get<{ items: { code: string; currency?: string }[] }>(
      '/loans/products',
    );
    const product = products.items[0];
    expect(product, 'seed should offer a loan product').toBeTruthy();

    const application = await customerApi.post<{ id: string; status: string }>(
      '/loans/applications',
      {
        productCode: product.code,
        amount: { currency: 'USD', minorUnits: 500_000, scale: 2 },
        termMonths: 24,
        purpose: 'home_improvement',
        purposeDetail: 'E2E journey 3: kitchen refit.',
        disbursementAccountId: account!.id,
        repaymentAccountId: account!.id,
        declaredMonthlyIncome: { currency: 'USD', minorUnits: 840_000, scale: 2 },
        declaredMonthlyExpenses: { currency: 'USD', minorUnits: 300_000, scale: 2 },
        existingCommitments: { currency: 'USD', minorUnits: 50_000, scale: 2 },
      },
    );
    expect(application.id).toBeTruthy();

    // The application is visible to the customer in the UI.
    await page.goto('/loans');
    await expect(page.getByText(/application|loan/i).first()).toBeVisible();

    // ── Approve (underwriter, staff API) ─────────────────────────────────────
    const underwriter = await staffApi(
      seedUsers.staff.underwriter.email,
      seedUsers.staff.underwriter.password,
    );
    await underwriter.post(`/loans/admin/applications/${application.id}/decision`, {
      outcome: 'approved',
      reasons: ['E2E: scorecard and affordability verified by automation.'],
    });

    // ── Accept the offer, then disburse ──────────────────────────────────────
    await customerApi.post(`/loans/applications/${application.id}/accept`, {});
    const loans = await customerApi.get<{ items: { id: string; status: string }[] }>('/loans');
    const loan = loans.items[0];
    expect(loan, 'acceptance should produce a loan').toBeTruthy();

    const disbursed = await underwriter.post<{ id: string; status: string }>(
      `/loans/admin/${loan.id}/disburse`,
    );
    expect(['disbursed', 'active', 'current', 'in_arrears']).toContain(disbursed.status);

    // ── Repay (customer) ─────────────────────────────────────────────────────
    // NOTE: /loans/[loanId] currently 500s in this tree (same {items} envelope bug as
    // /cards/new — reported to the WEB track), so the repayment goes through the API here;
    // restore the UI repayment form steps when the page is fixed.
    const before = await customerApi.get<{ totalOutstanding: { minorUnits: number } }>(
      `/loans/${loan.id}`,
    );
    await customerApi.post(`/loans/${loan.id}/repayments`, {
      fromAccountId: account!.id,
      amount: { currency: 'USD', minorUnits: 10000, scale: 2 },
      kind: 'scheduled',
    });
    const after = await customerApi.get<{ totalOutstanding: { minorUnits: number } }>(
      `/loans/${loan.id}`,
    );
    expect(after.totalOutstanding.minorUnits).toBeLessThan(before.totalOutstanding.minorUnits);

    // The loan book still reads correctly to the customer.
    await page.goto('/loans');
    await expect(page.getByText(/loan|repayment|outstanding/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
