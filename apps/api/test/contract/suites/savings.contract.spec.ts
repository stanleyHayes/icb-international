import { afterAll, beforeAll, describe, it } from 'vitest';

import type { SavingsGoal, TermDeposit } from '@icb/contracts';
import { savingsOperations } from '@icb/contracts/openapi/routes/savings';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: savings goals and term deposits.
 *
 * Neither exists in the seed, so the suite opens them through the API against the demo persona's
 * seeded USD accounts (seed.data.ts) and pins every response to the route table. Goal ids and
 * deposit ids always come from the response that created them — never a hard-coded id.
 */
describe('contract: savings', () => {
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
      ctx.assertCovered(savingsOperations);
      await closeContractApp(app);
    }
  });

  it('listDepositRates — the published rate card parses as declared', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('listDepositRates', await ctx.get('/savings/rates?currency=USD'));
  });

  it('createSavingsGoal / listSavingsGoals / getSavingsGoal — a goal on the savings account', async (t) => {
    requireInfra(t, boot);
    const goal = await createGoal(ctx, 'Contract test goal');

    ctx.expectContract('listSavingsGoals', await ctx.get('/savings/goals'));

    const detailPath = fillPath(operationOf('getSavingsGoal').path, { goalId: goal.id });
    ctx.expectContract('getSavingsGoal', await ctx.get(detailPath));
  });

  it('updateSavingsGoal — renaming a goal returns the declared goal shape', async (t) => {
    requireInfra(t, boot);
    const goal = await createGoal(ctx, 'Goal before rename');
    const detailPath = fillPath(operationOf('updateSavingsGoal').path, { goalId: goal.id });
    const res = await ctx.patch(detailPath, { name: 'Renamed by contract test' });
    ctx.expectContract('updateSavingsGoal', res);
  });

  // KNOWN DRIFT (report to SDK-01 + savings owner): the route table declares 200 for
  // contributeToGoal, but a Nest @Post without @HttpCode answers 201. `it.fails` pins the drift.
  it.fails('contributeToGoal — a contribution returns the goal [DRIFT: 201 vs declared 200]', async (t) => {
    requireInfra(t, boot);
    const goal = await createGoal(ctx, 'Contribution goal');
    const contributePath = fillPath(operationOf('contributeToGoal').path, { goalId: goal.id });
    const res = await ctx.post(contributePath, {
      fromAccountId: await accountIdFor(ctx, 'ICB-CURRENT'),
      amount: usd(5_000),
    });
    ctx.expectContract('contributeToGoal', res);
  });

  it('deleteSavingsGoal — removing an untouched goal returns no content', async (t) => {
    requireInfra(t, boot);
    const goal = await createGoal(ctx, 'Disposable goal');
    const detailPath = fillPath(operationOf('deleteSavingsGoal').path, { goalId: goal.id });
    ctx.expectContract('deleteSavingsGoal', await ctx.delete(detailPath));
  });

  it('openTermDeposit / listTermDeposits / getTermDeposit / updateTermDeposit', async (t) => {
    requireInfra(t, boot);
    const deposit = await openDeposit(ctx);

    ctx.expectContract('listTermDeposits', await ctx.get('/savings/deposits'));

    const detailPath = fillPath(operationOf('getTermDeposit').path, { depositId: deposit.id });
    ctx.expectContract('getTermDeposit', await ctx.get(detailPath));

    const updated = await ctx.patch(detailPath, { maturityInstruction: 'rollover_principal' });
    ctx.expectContract('updateTermDeposit', updated);
  });

  it('quoteDepositBreak / breakTermDeposit — early withdrawal on the quoted terms', async (t) => {
    requireInfra(t, boot);
    const deposit = await openDeposit(ctx);

    const quotePath = fillPath(operationOf('quoteDepositBreak').path, { depositId: deposit.id });
    ctx.expectContract('quoteDepositBreak', await ctx.get(quotePath));

    const breakPath = fillPath(operationOf('breakTermDeposit').path, { depositId: deposit.id });
    ctx.expectContract('breakTermDeposit', await ctx.post(breakPath, {}));
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

/** Create a goal against the seeded savings account and pin the creation response. */
async function createGoal(ctx: ContractContext, name: string): Promise<SavingsGoal> {
  const res = await ctx.post('/savings/goals', {
    accountId: await accountIdFor(ctx, 'ICB-SAVINGS'),
    name,
    target: usd(100_000),
  });
  return ctx.expectContract('createSavingsGoal', res) as SavingsGoal;
}

/** Open a deposit over the band minimum from the seeded savings account, pinning the response. */
async function openDeposit(ctx: ContractContext): Promise<TermDeposit> {
  const res = await ctx.post('/savings/deposits', {
    fromAccountId: await accountIdFor(ctx, 'ICB-SAVINGS'),
    principal: usd(100_000),
    termMonths: 6,
    maturityInstruction: 'transfer_out',
  });
  return ctx.expectContract('openTermDeposit', res) as TermDeposit;
}
