import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CardDetail } from '@icb/contracts';
import { adminOperations } from '@icb/contracts/openapi/routes/admin';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: the staff back-office (`/admin/*`).
 *
 * Same pattern as the accounts reference: boot the real bank, drive each endpoint over HTTP as
 * the all-roles staff principal, and pin every 2xx body to its route-table schema. Cards are
 * not seeded, so the staff issuing flow creates what the card reads and lifecycle mutations
 * then consume.
 */
describe('contract: admin', () => {
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
      ctx.assertCovered(adminOperations);
      await closeContractApp(app);
    }
  });

  it('listAdminKpis / monitorTransactions / verifyLedgerIntegrity / getTrialBalance / getSystemHealth — staff reads on the seeded bank', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('listAdminKpis', await ctx.get('/admin/kpis', 'staff'));
    ctx.expectContract('monitorTransactions', await ctx.get('/admin/monitor', 'staff'));
    ctx.expectContract('verifyLedgerIntegrity', await ctx.get('/admin/ledger-integrity', 'staff'));
    ctx.expectContract('getTrialBalance', await ctx.get('/admin/trial-balance', 'staff'));
    ctx.expectContract('getSystemHealth', await ctx.get('/admin/health', 'staff'));
  });

  it('issueCardForStaff — then the card reads: listCardsForStaff / getCardForStaff / listCardAuthorisationsForStaff', async (t) => {
    requireInfra(t, boot);
    const card = await issueCard(ctx, await firstAccountId(ctx));

    ctx.expectContract('listCardsForStaff', await ctx.get('/admin/cards', 'staff'));

    const detailPath = fillPath(operationOf('getCardForStaff').path, { cardId: card.id });
    ctx.expectContract('getCardForStaff', await ctx.get(detailPath, 'staff'));

    const authsPath = fillPath(operationOf('listCardAuthorisationsForStaff').path, { cardId: card.id });
    ctx.expectContract('listCardAuthorisationsForStaff', await ctx.get(authsPath, 'staff'));
  });

  it('updateCardLimitsForStaff — a limits raise returns the declared card shape', async (t) => {
    requireInfra(t, boot);
    const card = await issueCard(ctx, await firstAccountId(ctx));
    const monthly = { ...card.limits.monthly, minorUnits: card.limits.monthly.minorUnits + 100_000 };

    const path = fillPath(operationOf('updateCardLimitsForStaff').path, { cardId: card.id });
    ctx.expectContract('updateCardLimitsForStaff', await ctx.patch(path, { monthly }, 'staff'));
  });

  // KNOWN DRIFT (report to SDK-01 + cards owner): the route table declares 200 for every staff
  // card action, but cards-staff.controller.ts puts no @HttpCode on its @Post handlers, so Nest
  // answers 201. `it.fails` pins each one — when either side is fixed the test goes red and must
  // be converted back to `it`.
  it.fails('resetCardPin — the PIN-less card parses as declared [DRIFT: declared 200, controller returns 201]', async (t) => {
    requireInfra(t, boot);
    const card = await issueCard(ctx, await firstAccountId(ctx));
    const path = fillPath(operationOf('resetCardPin').path, { cardId: card.id });
    ctx.expectContract('resetCardPin', await ctx.post(path, {}, 'staff'));
  });

  it.fails('blockCard — the blocked card parses as declared [DRIFT: declared 200, controller returns 201]', async (t) => {
    requireInfra(t, boot);
    const card = await issueCard(ctx, await firstAccountId(ctx));
    const path = fillPath(operationOf('blockCard').path, { cardId: card.id });
    ctx.expectContract('blockCard', await ctx.post(path, { reason: 'Contract test staff block' }, 'staff'));
  });

  it.fails('reissueCard — the replacement card parses as declared [DRIFT: declared 200, controller returns 201]', async (t) => {
    requireInfra(t, boot);
    const card = await issueCard(ctx, await firstAccountId(ctx));
    const path = fillPath(operationOf('reissueCard').path, { cardId: card.id });
    ctx.expectContract('reissueCard', await ctx.post(path, {
      reason: 'damaged',
      detail: 'Contract test staff reissue',
    }, 'staff'));
  });

  it('createManualPosting — a valid request raises the declared approval-request shape', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post('/admin/postings', {
      accountId: await firstAccountId(ctx),
      direction: 'credit',
      amount: { minorUnits: 25_000, currency: 'GHS', scale: 2 },
      contraAccountCode: '4000',
      description: 'Contract test adjustment',
      reason: 'Contract test manual posting',
    }, 'staff');
    ctx.expectContract('createManualPosting', res);
  });
});

/** A seeded account of the demo customer — never a hard-coded id. */
async function firstAccountId(ctx: ContractContext): Promise<string> {
  const list = await ctx.get('/accounts');
  const accounts = idsFromList(list.body as unknown, 'listAccounts');
  expect(accounts.length).toBeGreaterThan(0);
  return accounts[0] as string;
}

/** Issue a debit card as staff and return its parsed detail; covers the success schema. */
async function issueCard(ctx: ContractContext, accountId: string): Promise<CardDetail> {
  const res = await ctx.post('/admin/cards', {
    accountId,
    kind: 'debit',
    network: 'visa',
    nickname: 'Contract test card',
  }, 'staff');
  return ctx.expectContract('issueCardForStaff', res) as CardDetail;
}

/** List responses are either a bare array or an `{ items }` envelope; read ids from whichever. */
function idsFromList(body: unknown, operationId: string): string[] {
  const items = Array.isArray(body)
    ? body
    : (body as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) {
    throw new Error(`${operationId} returned neither an array nor an items envelope.`);
  }
  return items.map((item) => (item as { id: string }).id);
}
