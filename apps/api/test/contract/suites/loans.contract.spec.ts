import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { LoanApplication } from '@icb/contracts';
import { loansOperations } from '@icb/contracts/openapi/routes/loans';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: lending.
 *
 * Nothing is seeded beyond accounts, so the suite drives the whole journey — application,
 * scorecard approval, acceptance, staff drawdown — and pins every response to the route table.
 * The demo persona (premier, KYC tier 3, USD salary; seed.data.ts) scores an automatic approval
 * for a modest personal loan, which is what makes the journey drivable end to end.
 *
 * The seeded accounts come from GET /accounts — read here as set-up, never re-asserted; the
 * accounts suite owns that contract.
 */
describe('contract: loans', () => {
  let boot: BootResult;
  let app: ContractApp | undefined;
  let ctx: ContractContext;

  beforeAll(async () => {
    boot = await bootContractApp();
    if (boot.available) {
      app = boot.app;
      ctx = new ContractContext(app);
    }
  });

  afterAll(async () => {
    if (app && ctx) {
      ctx.assertCovered(loansOperations);
      await closeContractApp(app);
    }
  });

  it('listLoanProducts — the catalogue parses as declared', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('listLoanProducts', await ctx.get('/loans/products'));
  });

  // KNOWN DRIFT (report to SDK-01 + lending owner): the route table declares 200 for quoteLoan,
  // but a Nest @Post without @HttpCode answers 201. `it.fails` pins the drift — see accounts.
  it.fails('quoteLoan — an indicative quote parses as declared [DRIFT: 201 vs declared 200]', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post('/loans/quote', {
      productCode: 'PERSONAL_STANDARD',
      amount: usd(500_000),
      termMonths: 24,
      frequency: 'monthly',
    });
    ctx.expectContract('quoteLoan', res);
  });

  it('applyForLoan / listLoanApplications / getLoanApplication — an approved application', async (t) => {
    requireInfra(t, boot);
    const applicationId = await applyForApprovableLoan(ctx);

    ctx.expectContract('listLoanApplications', await ctx.get('/loans/applications'));

    const detailPath = fillPath(operationOf('getLoanApplication').path, { applicationId });
    ctx.expectContract('getLoanApplication', await ctx.get(detailPath));
  });

  it('listLoans / getLoan / getPayoffQuote — detail endpoints for a disbursed loan', async (t) => {
    requireInfra(t, boot);
    const applicationId = await applyForApprovableLoan(ctx);

    // Acceptance and drawdown are set-up for the GETs; accept's own drift is pinned below.
    const acceptPath = fillPath(operationOf('acceptLoanOffer').path, { applicationId });
    expect((await ctx.post(acceptPath, {})).status).toBe(201);
    const loanId = await firstLoanId(ctx);
    expect((await ctx.post(`/loans/admin/${loanId}/disburse`, {}, 'staff')).status).toBe(201);

    ctx.expectContract('listLoans', await ctx.get('/loans'));

    const detailPath = fillPath(operationOf('getLoan').path, { loanId });
    ctx.expectContract('getLoan', await ctx.get(detailPath));

    const payoffPath = fillPath(operationOf('getPayoffQuote').path, { loanId });
    ctx.expectContract('getPayoffQuote', await ctx.get(payoffPath));
  });

  // KNOWN DRIFT: the route table declares 200 for acceptLoanOffer; the controller answers 201.
  it.fails('acceptLoanOffer — accepting an offer returns the application [DRIFT: 201 vs declared 200]', async (t) => {
    requireInfra(t, boot);
    const applicationId = await applyForApprovableLoan(ctx);
    const acceptPath = fillPath(operationOf('acceptLoanOffer').path, { applicationId });
    ctx.expectContract('acceptLoanOffer', await ctx.post(acceptPath, {}));
  });

  // KNOWN DRIFT: the route table declares 202 for makeRepayment; the controller answers 201.
  it.fails('makeRepayment — an extra payment returns the loan [DRIFT: 201 vs declared 202]', async (t) => {
    requireInfra(t, boot);
    const loanId = await firstLoanId(ctx, 'active');
    const repayPath = fillPath(operationOf('makeRepayment').path, { loanId });
    const res = await ctx.post(repayPath, {
      fromAccountId: await accountIdFor(ctx, 'ICB-CURRENT'),
      amount: usd(1_000),
      kind: 'extra',
    });
    ctx.expectContract('makeRepayment', res);
  });

  // KNOWN DRIFT: the route table posts the upload-grant request to /documents (201, signature),
  // but the controller mints signatures at /documents/upload-signature (200) and attaches the
  // uploaded asset at /documents — the contracted call fails validation with a 422.
  it.fails('uploadLoanDocument — a direct-upload grant [DRIFT: 422; contract path/shape vs controller’s upload-signature + attach pair]', async (t) => {
    requireInfra(t, boot);
    const applicationId = await applyForApprovableLoan(ctx);
    const documentsPath = fillPath(operationOf('uploadLoanDocument').path, { applicationId });
    const res = await ctx.post(documentsPath, {
      label: 'Payslip',
      filename: 'payslip.pdf',
      contentType: 'application/pdf',
      sizeBytes: 102_400,
    });
    ctx.expectContract('uploadLoanDocument', res);
  });
});

/** Money dto in the demo persona's currency — Amara banks in USD (seed.data.ts). */
function usd(minorUnits: number): { minorUnits: number; currency: 'USD'; scale: 2 } {
  return { minorUnits, currency: 'USD', scale: 2 };
}

/** The seeded account with this product code, straight from the live list response. */
async function accountIdFor(ctx: ContractContext, productCode: string): Promise<string> {
  const res = await ctx.get('/accounts');
  const body = res.body as { items?: { id: string; productCode: string }[] };
  const match = body.items?.find((account) => account.productCode === productCode);
  if (!match) {
    throw new Error(`No seeded ${productCode} account for the demo persona.`);
  }
  return match.id;
}

/**
 * Submit an application the scorecard approves outright: a modest amount against the demo
 * persona's declared salary keeps every factor comfortably over the automatic-approval floor.
 */
async function applyForApprovableLoan(ctx: ContractContext): Promise<string> {
  const accountId = await accountIdFor(ctx, 'ICB-CURRENT');
  const res = await ctx.post('/loans/applications', {
    productCode: 'PERSONAL_STANDARD',
    amount: usd(500_000),
    termMonths: 24,
    frequency: 'monthly',
    purpose: 'home_improvement',
    disbursementAccountId: accountId,
    repaymentAccountId: accountId,
    declaredMonthlyIncome: usd(840_000),
    declaredMonthlyExpenses: usd(200_000),
    existingCommitments: usd(0),
  });
  const application = ctx.expectContract('applyForLoan', res) as LoanApplication;
  expect(
    application.decision?.outcome,
    'the demo persona should score an automatic approval',
  ).toBe('approved');
  return application.id;
}

/** List responses are either a bare array or an `{ items }` envelope; read ids from whichever. */
async function firstLoanId(ctx: ContractContext, status?: string): Promise<string> {
  const res = await ctx.get('/loans');
  const body = res.body as unknown;
  const items = Array.isArray(body) ? body : (body as { items?: unknown[] } | null)?.items;
  const loans = (Array.isArray(items) ? items : []) as { id: string; status: string }[];
  const match = status === undefined ? loans[0] : loans.find((loan) => loan.status === status);
  if (!match) {
    const scope = status ? ` with status ${status}` : '';
    throw new Error(`listLoans has no loan${scope} — set-up failed.`);
  }
  return match.id;
}
