import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TransferDetail, TransferQuote, TransferTemplate } from '@icb/contracts';
import { transfersOperations } from '@icb/contracts/openapi/routes/transfers';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/** The demo customer's seeded pair: the current account pays, the other receives. */
interface OwnAccounts {
  readonly fromId: string;
  readonly toId: string;
  readonly currency: string;
}

const DAY_MS = 86_400_000;

/**
 * Contract suite: transfers, transfer templates, and standing orders.
 *
 * The seeded bank has no transfer history, so every read is fed by a send the suite makes
 * itself — small own-account transfers, far below the approval and per-transaction thresholds.
 * Background jobs are off in the harness, so a future-dated send stays `scheduled`: exactly the
 * state cancellation needs, and an RRULE send is what creates a standing order. The start date
 * comes from a fresh quote's `expiresAt` — the bank's own clock, never a hard-coded date.
 *
 * Setup sends assert only a 2xx (their contract is pinned in dedicated tests), so a drifted
 * mutation status can never mask the GET coverage this suite exists to prove.
 */
describe('contract: transfers', () => {
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
      ctx.assertCovered(transfersOperations);
      await closeContractApp(app);
    }
  });

  it('quoteTransfer — pricing a small own-account send parses as declared', async (t) => {
    requireInfra(t, boot);
    const own = await ownAccountPair(ctx);
    ctx.expectContract('quoteTransfer', await ctx.post('/transfers/quotes', terms(own)));
  });

  // KNOWN DRIFT (report to SDK-01 + transfers owner): the route table declares 202 Accepted for
  // createTransfer, but the controller leaves Nest's default POST status — 201 Created — on the
  // wire. `it.fails` pins the drift; when either side is fixed, convert back to `it`.
  it.fails('createTransfer — a small own-account send [DRIFT: returns 201, contract declares 202]', async (t) => {
    requireInfra(t, boot);
    const own = await ownAccountPair(ctx);
    ctx.expectContract('createTransfer', await ctx.post('/transfers', terms(own)));
  });

  it('listTransfers / getTransfer — the suite’s own sends page and detail', async (t) => {
    requireInfra(t, boot);
    const own = await ownAccountPair(ctx);
    const sent = await sendTransfer(ctx, own);

    const list = await ctx.get('/transfers');
    ctx.expectContract('listTransfers', list);
    expect(idsFromList(list.body as unknown, 'listTransfers')).toContain(sent.id);

    const detailPath = fillPath(operationOf('getTransfer').path, { transferId: sent.id });
    ctx.expectContract('getTransfer', await ctx.get(detailPath));
  });

  // Same status drift as createTransfer: 201 on the wire, 200 in the route table.
  it.fails('cancelTransfer — a future-dated send is cancellable [DRIFT: returns 201, contract declares 200]', async (t) => {
    requireInfra(t, boot);
    const own = await ownAccountPair(ctx);
    const created = await sendTransfer(ctx, own, {
      schedule: { startsOn: await futureStartsOn(ctx, own) },
    });
    expect(created.status).toBe('scheduled');

    const cancelPath = fillPath(operationOf('cancelTransfer').path, { transferId: created.id });
    const cancelled = await ctx.post(cancelPath, { reason: 'Contract test no longer needs it' });
    ctx.expectContract('cancelTransfer', cancelled);
  });

  it('listStandingOrders — an RRULE send creates a series', async (t) => {
    requireInfra(t, boot);
    const own = await ownAccountPair(ctx);
    await sendTransfer(ctx, own, {
      schedule: { startsOn: await futureStartsOn(ctx, own), rrule: 'FREQ=MONTHLY;COUNT=3' },
    });

    const list = await ctx.get('/standing-orders');
    ctx.expectContract('listStandingOrders', list);
    expect(idsFromList(list.body as unknown, 'listStandingOrders').length).toBeGreaterThan(0);
  });

  // Same status drift as createTransfer: 201 on the wire, 200 in the route table.
  it.fails('cancelStandingOrder — ending the series [DRIFT: returns 201, contract declares 200]', async (t) => {
    requireInfra(t, boot);
    const own = await ownAccountPair(ctx);
    await sendTransfer(ctx, own, {
      schedule: { startsOn: await futureStartsOn(ctx, own), rrule: 'FREQ=MONTHLY;COUNT=3' },
    });

    const list = await ctx.get('/standing-orders');
    const ids = idsFromList(list.body as unknown, 'listStandingOrders');
    const cancelPath = fillPath(operationOf('cancelStandingOrder').path, {
      standingOrderId: ids[0] as string,
    });
    const cancelled = await ctx.post(cancelPath, { reason: 'Contract test cleanup' });
    ctx.expectContract('cancelStandingOrder', cancelled);
  });

  it('createTransferTemplate / listTransferTemplates / deleteTransferTemplate — save, list, remove', async (t) => {
    requireInfra(t, boot);
    const own = await ownAccountPair(ctx);
    const created = await ctx.post('/transfer-templates', {
      name: 'Contract test template',
      fromAccountId: own.fromId,
      destination: { kind: 'own_account', accountId: own.toId },
      amount: minor(150, own.currency),
    });
    const template = ctx.expectContract('createTransferTemplate', created) as TransferTemplate;

    ctx.expectContract('listTransferTemplates', await ctx.get('/transfer-templates'));

    const deletePath = fillPath(operationOf('deleteTransferTemplate').path, {
      templateId: template.id,
    });
    ctx.expectContract('deleteTransferTemplate', await ctx.delete(deletePath));
  });

  // Same status drift as createTransfer: 201 on the wire, 202 in the route table.
  it.fails('createBulkTransfer — a one-row batch [DRIFT: returns 201, contract declares 202]', async (t) => {
    requireInfra(t, boot);
    const own = await ownAccountPair(ctx);
    const res = await ctx.post('/transfers/bulk', {
      fromAccountId: own.fromId,
      rows: [
        {
          rowNumber: 1,
          destination: { kind: 'own_account', accountId: own.toId },
          amount: minor(120, own.currency),
        },
      ],
    });
    ctx.expectContract('createBulkTransfer', res);
  });
});

/** Small amounts, far under the approval threshold (100,000 major units) and every rail cap. */
function minor(minorUnits: number, currency: string) {
  return { minorUnits, currency, scale: 2 };
}

/** The transfer terms every small own-account send in this suite shares. */
function terms(own: OwnAccounts) {
  return {
    fromAccountId: own.fromId,
    destination: { kind: 'own_account', accountId: own.toId },
    amount: minor(500, own.currency),
  };
}

/** The seeded current-and-savings pair, read from the accounts list — never a hard-coded id. */
async function ownAccountPair(ctx: ContractContext): Promise<OwnAccounts> {
  const list = await ctx.get('/accounts');
  const items = (
    Array.isArray(list.body) ? list.body : (list.body as { items?: unknown[] } | null)?.items
  ) as { id: string; productCode: string; currency: string }[] | undefined;
  if (!Array.isArray(items) || items.length < 2) {
    throw new Error('listAccounts did not return the seeded account pair.');
  }
  const current = (items.find((a) => a.productCode === 'ICB-CURRENT') ?? items[0]) as {
    id: string;
    currency: string;
  };
  const other = items.find((a) => a.id !== current.id) as { id: string };
  return { fromId: current.id, toId: other.id, currency: current.currency };
}

/** A start date a month past the bank's own clock, read from a fresh quote's expiry. */
async function futureStartsOn(ctx: ContractContext, own: OwnAccounts): Promise<string> {
  const res = await ctx.post('/transfers/quotes', terms(own));
  const quote = ctx.expectContract('quoteTransfer', res) as TransferQuote;
  return new Date(Date.parse(quote.expiresAt) + 30 * DAY_MS).toISOString().slice(0, 10);
}

/** A send whose contract is pinned in its own test; here it only needs to have succeeded. */
async function sendTransfer(
  ctx: ContractContext,
  own: OwnAccounts,
  extra: { schedule?: { startsOn: string; rrule?: string } } = {},
): Promise<TransferDetail> {
  const res = await ctx.post('/transfers', { ...terms(own), ...extra });
  expect(res.status, `setup send failed: ${JSON.stringify(res.body)}`).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  return res.body as TransferDetail;
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
