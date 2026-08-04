import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { transactionsOperations } from '@icb/contracts/openapi/routes/transactions';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: transactions.
 *
 * The seeder writes 18 months of ledger activity on the demo customer's current account, so
 * every read endpoint has data from boot. Detail and annotate take their id from the list
 * response; the export window is derived from the seeded value dates — nothing is hard-coded.
 * Analytics are scoped to USD, the demo persona's seeded currency (seed.data.ts).
 */
describe('contract: transactions', () => {
  let boot: BootResult;
  let app: ContractApp | undefined;
  let ctx: ContractContext;

  // Boot + seed outlasts the default hook timeout while sibling suites boot in parallel.
  beforeAll(async () => {
    boot = await bootContractApp();
    if (boot.available) {
      app = boot.app;
      ctx = new ContractContext(app);
    }
  }, 900_000);

  afterAll(async () => {
    if (app && ctx) {
      ctx.assertCovered(transactionsOperations);
      await closeContractApp(app);
    }
  });

  it('listTransactions — the seeded ledger pages as declared', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.get('/transactions');
    ctx.expectContract('listTransactions', res);
  });

  it('getTransaction — detail for a seeded transaction parses', async (t) => {
    requireInfra(t, boot);
    const transactionId = await firstTransactionId(ctx);
    const path = fillPath(operationOf('getTransaction').path, { transactionId });
    ctx.expectContract('getTransaction', await ctx.get(path));
  });

  it('annotateTransaction — note, category and tags return the declared detail shape', async (t) => {
    requireInfra(t, boot);
    const transactionId = await firstTransactionId(ctx);
    const path = fillPath(operationOf('annotateTransaction').path, { transactionId });
    const res = await ctx.patch(path, {
      note: 'Contract test note',
      category: 'dining',
      tags: ['contract'],
    });
    ctx.expectContract('annotateTransaction', res);
  });

  it('analytics — spend, cashflow, merchants and recurring parse for the seeded currency', async (t) => {
    requireInfra(t, boot);
    const spendPath = operationOf('getSpendByCategory').path;
    ctx.expectContract('getSpendByCategory', await ctx.get(`${spendPath}?currency=USD`));

    const cashflowPath = operationOf('getCashflow').path;
    ctx.expectContract('getCashflow', await ctx.get(`${cashflowPath}?currency=USD&granularity=month`));

    const merchantsPath = operationOf('getMerchantsAnalytics').path;
    ctx.expectContract('getMerchantsAnalytics', await ctx.get(`${merchantsPath}?currency=USD`));

    const recurringPath = operationOf('getRecurringAnalytics').path;
    ctx.expectContract('getRecurringAnalytics', await ctx.get(`${recurringPath}?currency=USD`));
  });

  it('exportTransactions — a csv export over the seeded window returns the declared link', async (t) => {
    requireInfra(t, boot);
    const accountId = await firstAccountId(ctx);
    const window = await seededWindow(ctx, accountId);
    const res = await ctx.post('/transactions/exports', {
      accountId,
      format: 'csv',
      from: window.from,
      to: window.to,
    });
    ctx.expectContract('exportTransactions', res);
  });
});

/** The first transaction on the first page — an id that exists, whatever the seed produced. */
async function firstTransactionId(ctx: ContractContext): Promise<string> {
  const res = await ctx.get('/transactions');
  const ids = idsFromList(res.body as unknown, 'listTransactions');
  expect(ids.length).toBeGreaterThan(0);
  return ids[0] as string;
}

/** The demo customer's first account, read back over the API rather than from the database. */
async function firstAccountId(ctx: ContractContext): Promise<string> {
  const res = await ctx.get('/accounts');
  const ids = idsFromList(res.body as unknown, 'listAccounts');
  expect(ids.length).toBeGreaterThan(0);
  return ids[0] as string;
}

/** A from/to window wide enough to hold seeded activity, derived from the ledger itself. */
async function seededWindow(
  ctx: ContractContext,
  accountId: string,
): Promise<{ from: string; to: string }> {
  const res = await ctx.get(`/transactions?accountId=${accountId}&limit=100`);
  const items = itemsOf(res.body as unknown, 'listTransactions');
  // ISO dates, so `localeCompare` orders them chronologically — the window must span the ledger.
  const dates = items
    .map((item) => (item as { valueDate: string }).valueDate)
    .sort((left, right) => left.localeCompare(right));
  expect(dates.length).toBeGreaterThan(0);
  return { from: dates[0] as string, to: dates[dates.length - 1] as string };
}

/** List responses are either a bare array or an `{ items }` envelope; read ids from whichever. */
function idsFromList(body: unknown, operationId: string): string[] {
  return itemsOf(body, operationId).map((item) => (item as { id: string }).id);
}

/** The item array behind either list shape; anything else is a test bug, so fail loudly. */
function itemsOf(body: unknown, operationId: string): unknown[] {
  const items = Array.isArray(body)
    ? body
    : (body as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) {
    throw new Error(`${operationId} returned neither an array nor an items envelope.`);
  }
  return items;
}
