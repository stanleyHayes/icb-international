import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cardsOperations } from '@icb/contracts/openapi/routes/cards';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: cards.
 *
 * The seed ships no cards, so every test issues its own virtual card against one of the
 * customer's seeded accounts first — detail and authorisation endpoints take their ids from
 * those freshly issued cards, never a hard-coded value. The `it.fails` blocks pin places where
 * the controllers and the route table already disagree.
 */
describe('contract: cards', () => {
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
      ctx.assertCovered(cardsOperations);
      await closeContractApp(app);
    }
  });

  it('issueCard — a virtual card on a seeded account parses as declared', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post('/cards', { accountId: await seededAccountId(ctx, 0), kind: 'virtual' });
    ctx.expectContract('issueCard', res);
  });

  it('listCards / getCard / listCardAuthorisations — read paths for a freshly issued card', async (t) => {
    requireInfra(t, boot);
    const cardId = await issueCard(ctx, 1);

    const list = await ctx.get('/cards');
    ctx.expectContract('listCards', list);
    expect(idsFromList(list.body as unknown, 'listCards')).toContain(cardId);

    const detailPath = fillPath(operationOf('getCard').path, { cardId });
    ctx.expectContract('getCard', await ctx.get(detailPath));

    const authsPath = fillPath(operationOf('listCardAuthorisations').path, { cardId });
    ctx.expectContract('listCardAuthorisations', await ctx.get(authsPath));
  });

  it('updateCard — a nickname change returns the declared card shape', async (t) => {
    requireInfra(t, boot);
    const cardId = await issueCard(ctx, 0);
    const path = fillPath(operationOf('updateCard').path, { cardId });
    ctx.expectContract('updateCard', await ctx.patch(path, { nickname: 'Renamed by contract test' }));
  });

  // KNOWN DRIFT (report to SDK-01 + cards owner): the route table declares 202 for reportCard,
  // but the controller takes Nest's 201 default for POST. `it.fails` keeps the suite green while
  // pinning the drift — when either side is fixed this test goes red and converts back to `it`.
  it.fails('reportCard — a lost-card report parses as declared [DRIFT: declared 202, controller returns 201]', async (t) => {
    requireInfra(t, boot);
    const cardId = await issueCard(ctx, 1);
    const path = fillPath(operationOf('reportCard').path, { cardId });
    ctx.expectContract('reportCard', await ctx.post(path, { reason: 'lost', reissue: false }));
  });

  // KNOWN DRIFT: the route table declares 200 for setTravelNotice; the controller returns 201.
  it.fails('setTravelNotice — a travel window parses as declared [DRIFT: declared 200, controller returns 201]', async (t) => {
    requireInfra(t, boot);
    const cardId = await issueCard(ctx, 0);
    const path = fillPath(operationOf('setTravelNotice').path, { cardId });
    ctx.expectContract('setTravelNotice', await ctx.post(path, { countries: ['GH'], ...travelWindow(ctx) }));
  });

  // KNOWN DRIFT: the route table declares PUT for controls and limits, but the controllers
  // register PATCH, so the contracted call 404s before the body is even validated.
  it.fails('updateCardControls — channel toggles parse as declared [DRIFT: route table PUT vs controller PATCH]', async (t) => {
    requireInfra(t, boot);
    const cardId = await issueCard(ctx, 1);
    const path = fillPath(operationOf('updateCardControls').path, { cardId });
    ctx.expectContract('updateCardControls', await ctx.put(path, { channels: { atm: false } }));
  });

  it.fails('updateCardLimits — spend limits parse as declared [DRIFT: route table PUT vs controller PATCH]', async (t) => {
    requireInfra(t, boot);
    const cardId = await issueCard(ctx, 0);
    const path = fillPath(operationOf('updateCardLimits').path, { cardId });
    const daily = { minorUnits: 500_000, currency: 'GHS', scale: 2 };
    ctx.expectContract('updateCardLimits', await ctx.put(path, { daily }));
  });

  // KNOWN DRIFT: the route table declares 204 with no body for setCardPin; the controller
  // returns the updated card with Nest's 201 default.
  it.fails('setCardPin — setting a PIN returns no content [DRIFT: declared 204, controller returns 201 card body]', async (t) => {
    requireInfra(t, boot);
    const cardId = await issueCard(ctx, 1);
    const path = fillPath(operationOf('setCardPin').path, { cardId });
    ctx.expectContract('setCardPin', await ctx.post(path, { pin: '7391' }));
  });
});

/** The id of one of the customer's seeded accounts, chosen by rotation index. */
async function seededAccountId(ctx: ContractContext, index: number): Promise<string> {
  const res = await ctx.get('/accounts');
  const ids = idsFromList(res.body as unknown, 'listAccounts');
  if (ids.length === 0) {
    throw new Error('The seed shipped no accounts for the demo customer.');
  }
  return ids[index % ids.length] as string;
}

/** Issue a virtual card on a seeded account, pinning the created shape; returns the card id. */
async function issueCard(ctx: ContractContext, accountIndex: number): Promise<string> {
  const body = { accountId: await seededAccountId(ctx, accountIndex), kind: 'virtual' };
  const res = await ctx.post('/cards', body);
  return (ctx.expectContract('issueCard', res) as { id: string }).id;
}

/** A two-week travel window starting today — generated at call time, never hard-coded. */
function travelWindow(ctx: ContractContext): { from: string; to: string } {
  const from = ctx.now();
  const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
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
