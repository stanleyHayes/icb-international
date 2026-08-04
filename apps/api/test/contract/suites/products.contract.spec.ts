import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { FxRate, Product } from '@icb/contracts';
import { productsOperations } from '@icb/contracts/openapi/routes/products';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: the product catalogue, the published rate table and the FX board.
 *
 * The catalogue endpoints are public marketing material and are called with no token, exactly
 * as the marketing site calls them; the FX endpoints are authenticated because both the board
 * and a quote are priced at the caller's own tier. The catalogue is seeded on boot, so the
 * product code under test always comes from the list response, never a literal.
 */
describe('contract: products', () => {
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
      ctx.assertCovered(productsOperations);
      await closeContractApp(app);
    }
  });

  it('listProducts — the public catalogue parses as declared', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.get('/products', 'none');
    ctx.expectContract('listProducts', res);
  });

  it('getProduct — one product by a code taken from the catalogue', async (t) => {
    requireInfra(t, boot);
    const list = await ctx.get('/products', 'none');
    const products = ctx.expectContract('listProducts', list) as Product[];
    expect(products.length).toBeGreaterThan(0);

    const path = fillPath(operationOf('getProduct').path, { productCode: products[0]!.code });
    ctx.expectContract('getProduct', await ctx.get(path, 'none'));
  });

  it('getRateTable — the published rates parse as declared', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.get('/products/rates', 'none');
    ctx.expectContract('getRateTable', res);
  });

  it('listFxRates — the board parses at the caller’s own tier', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.get('/fx/rates');
    ctx.expectContract('listFxRates', res);
  });

  it('quoteFx — a quote on the board’s first pair returns the declared shape', async (t) => {
    requireInfra(t, boot);
    const board = await ctx.get('/fx/rates');
    const rates = ctx.expectContract('listFxRates', board) as FxRate[];
    expect(rates.length).toBeGreaterThan(0);
    const pair = rates[0]!;

    const res = await ctx.post('/fx/quotes', {
      from: pair.base,
      to: pair.quote,
      amountMinorUnits: 100_000,
      amountSide: 'sell',
    });
    ctx.expectContract('quoteFx', res);
  });
});
