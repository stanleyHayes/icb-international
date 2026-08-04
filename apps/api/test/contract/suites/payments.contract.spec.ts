import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Biller, BillPayment, LinkedBill } from '@icb/contracts';
import { paymentsOperations } from '@icb/contracts/openapi/routes/payments';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/** The directory entry used for linking: supports balance enquiry, no minimum, no fee. */
const LINKABLE_BILLER_NAME = 'FibreLink';
/** References must satisfy the biller's shipped pattern (`^FL\d{8}$`); vary them per test. */
const REFERENCE_PREFIX = 'FL';

/**
 * Contract suite: billers, linked bills and bill payments.
 *
 * The seeded bank ships no bills or payments, so every detail endpoint takes its id from an
 * entity the suite has just created through the API — link first, then read, schedule and
 * cancel. The biller directory itself is seeded on boot, so `listBillers` has real data.
 */
describe('contract: payments', () => {
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
      ctx.assertCovered(paymentsOperations);
      await closeContractApp(app);
    }
  });

  it('listBillers — the seeded directory page parses as declared', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.get('/billers');
    ctx.expectContract('listBillers', res);
  });

  it('linkBill / listLinkedBills / getLinkedBill — a bill linked end to end', async (t) => {
    requireInfra(t, boot);
    const created = await linkBill(ctx, `${REFERENCE_PREFIX}12345678`);

    const list = await ctx.get('/bills');
    ctx.expectContract('listLinkedBills', list);
    expect(idsFromList(list.body as unknown, 'listLinkedBills')).toContain(created.id);

    const detailPath = fillPath(operationOf('getLinkedBill').path, { billId: created.id });
    ctx.expectContract('getLinkedBill', await ctx.get(detailPath));
  });

  it('configureAutopay — a full-balance rule returns the updated bill', async (t) => {
    requireInfra(t, boot);
    const bill = await linkBill(ctx, `${REFERENCE_PREFIX}23456789`);
    const funding = await currentAccount(ctx);

    const path = fillPath(operationOf('configureAutopay').path, { billId: bill.id });
    const res = await ctx.patch(path, {
      enabled: true,
      fromAccountId: funding.id,
      strategy: 'full_balance',
      daysBeforeDue: 2,
    });
    const updated = ctx.expectContract('configureAutopay', res) as LinkedBill;
    expect(updated.autopay?.enabled).toBe(true);
  });

  it('payBill / listBillPayments / getBillPayment — a scheduled payment appears in history', async (t) => {
    requireInfra(t, boot);
    const payment = await schedulePayment(ctx, `${REFERENCE_PREFIX}34567890`);

    const list = await ctx.get('/bill-payments');
    ctx.expectContract('listBillPayments', list);
    expect(idsFromList(list.body as unknown, 'listBillPayments')).toContain(payment.id);

    const detailPath = fillPath(operationOf('getBillPayment').path, { paymentId: payment.id });
    ctx.expectContract('getBillPayment', await ctx.get(detailPath));
  });

  // KNOWN DRIFT (report to payments owner): the route table declares 200 for cancelBillPayment,
  // but the controller is a plain @Post with no @HttpCode, so Nest answers 201. `it.fails` pins
  // the drift; when either side is fixed this goes red and must be converted back to `it`.
  it.fails('cancelBillPayment — a scheduled payment is cancelled [DRIFT: 201 returned, 200 declared]', async (t) => {
    requireInfra(t, boot);
    const payment = await schedulePayment(ctx, `${REFERENCE_PREFIX}45678901`);

    const path = fillPath(operationOf('cancelBillPayment').path, { paymentId: payment.id });
    ctx.expectContract('cancelBillPayment', await ctx.post(path, {}));
  });

  it('unlinkBill — a linked bill is removed with the declared 204', async (t) => {
    requireInfra(t, boot);
    const bill = await linkBill(ctx, `${REFERENCE_PREFIX}56789012`);

    const path = fillPath(operationOf('unlinkBill').path, { billId: bill.id });
    ctx.expectContract('unlinkBill', await ctx.delete(path));
  });
});

/** Link the directory's enquiry-capable biller under a fresh reference, contract-checked. */
async function linkBill(ctx: ContractContext, customerReference: string): Promise<LinkedBill> {
  const biller = await findBiller(ctx, LINKABLE_BILLER_NAME);
  const res = await ctx.post('/bills', {
    billerId: biller.id,
    customerReference,
    nickname: 'Contract test bill',
  });
  return ctx.expectContract('linkBill', res) as LinkedBill;
}

/** Schedule a payment against a freshly linked bill; scheduling moves no money today. */
async function schedulePayment(ctx: ContractContext, reference: string): Promise<BillPayment> {
  const bill = await linkBill(ctx, reference);
  if (!bill.dueOn) {
    throw new Error('Linked bill has no due date to schedule against.');
  }
  const funding = await currentAccount(ctx);
  const path = fillPath(operationOf('payBill').path, { billId: bill.id });
  const res = await ctx.post(path, {
    billId: bill.id,
    fromAccountId: funding.id,
    amount: { minorUnits: 5000, currency: funding.currency, scale: 2 },
    scheduledFor: daysAfter(bill.dueOn, 14),
  });
  const payment = ctx.expectContract('payBill', res) as BillPayment;
  expect(payment.status).toBe('scheduled');
  return payment;
}

/** A biller from the live directory, searched by name so no id is ever hard-coded. */
async function findBiller(ctx: ContractContext, nameFragment: string): Promise<Biller> {
  const res = await ctx.get(`/billers?q=${encodeURIComponent(nameFragment)}`);
  const page = ctx.expectContract('listBillers', res) as { items: Biller[] };
  const biller = page.items.find((item) => item.name.includes(nameFragment));
  if (!biller) {
    throw new Error(`No biller matching '${nameFragment}' in the seeded directory.`);
  }
  return biller;
}

/** The demo customer's current account — the funding source every payment path expects. */
async function currentAccount(ctx: ContractContext): Promise<{ id: string; currency: string }> {
  const res = await ctx.get('/accounts');
  const items = itemsFromList(res.body as unknown, 'listAccounts');
  const accounts = items as { id: string; productCode: string; currency: string }[];
  const current = accounts.find((account) => account.productCode === 'ICB-CURRENT') ?? accounts[0];
  if (!current) {
    throw new Error('The seeded demo customer has no accounts.');
  }
  return current;
}

/** An ISO date `days` after another — scheduling must land in the bank's future, not ours. */
function daysAfter(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** List responses are either a bare array or an `{ items }` envelope; read whichever arrived. */
function itemsFromList(body: unknown, operationId: string): unknown[] {
  const items = Array.isArray(body)
    ? body
    : (body as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) {
    throw new Error(`${operationId} returned neither an array nor an items envelope.`);
  }
  return items;
}

function idsFromList(body: unknown, operationId: string): string[] {
  return itemsFromList(body, operationId).map((item) => (item as { id: string }).id);
}
