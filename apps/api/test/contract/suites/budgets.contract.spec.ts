import { afterAll, beforeAll, describe, it } from 'vitest';

import { budgetsOperations } from '@icb/contracts/openapi/routes/budgets';
import { ContractContext, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: budgets.
 *
 * Budgets are the one domain with nothing seeded — the set starts empty, which is itself a
 * contracted shape the GET must honour. The PUT then replaces the set (idempotent by HTTP
 * semantics) and the follow-up GET proves the stored limits evaluate against the ledger.
 * Limits use USD, the demo persona's seeded currency (seed.data.ts).
 */
describe('contract: budgets', () => {
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
      ctx.assertCovered(budgetsOperations);
      await closeContractApp(app);
    }
  });

  it('getBudgets — an empty budget set still matches the overview schema', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('getBudgets', await ctx.get('/budgets'));
  });

  it('replaceBudgets — PUT replaces the set and the overview reflects it', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.put('/budgets', {
      budgets: [
        { category: 'groceries', limit: { minorUnits: 40000, currency: 'USD', scale: 2 } },
        { category: 'dining', limit: { minorUnits: 15000, currency: 'USD', scale: 2 } },
      ],
    });
    ctx.expectContract('replaceBudgets', res);

    // The read-back exercises getBudgets with stored limits and live spend folded in.
    ctx.expectContract('getBudgets', await ctx.get('/budgets'));
  });
});
