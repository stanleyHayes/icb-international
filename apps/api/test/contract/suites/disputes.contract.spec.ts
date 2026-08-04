import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { disputesOperations } from '@icb/contracts/openapi/routes/disputes';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: disputes.
 *
 * The seed ships no disputes, so every test raises its own against a seeded debit transaction —
 * only debits are disputable (you cannot charge back money that came in) and a transaction
 * carries at most one open dispute, so a suite-level set tracks the transactions already used.
 * Staff endpoints act on the dispute the test just raised, never a hard-coded id.
 */
describe('contract: disputes', () => {
  let boot: BootResult;
  let app: ContractApp | undefined;
  let ctx: ContractContext;
  const disputedTransactions = new Set<string>();

  beforeAll(async () => {
    boot = await bootContractApp();
    if (boot.available) {
      app = boot.app;
      ctx = new ContractContext(app);
    }
  });

  afterAll(async () => {
    if (app && ctx) {
      ctx.assertCovered(disputesOperations);
      await closeContractApp(app);
    }
  });

  it('createDispute — a dispute against a seeded debit parses as declared', async (t) => {
    requireInfra(t, boot);
    await raiseDispute(ctx, disputedTransactions);
  });

  it('listDisputes / getDispute — the customer view parses as declared', async (t) => {
    requireInfra(t, boot);
    const disputeId = await raiseDispute(ctx, disputedTransactions);

    const list = await ctx.get('/disputes');
    ctx.expectContract('listDisputes', list);
    expect(idsFromList(list.body as unknown, 'listDisputes')).toContain(disputeId);

    const detailPath = fillPath(operationOf('getDispute').path, { disputeId });
    ctx.expectContract('getDispute', await ctx.get(detailPath));
  });

  it('attachDisputeEvidence — new evidence returns the updated dispute shape', async (t) => {
    requireInfra(t, boot);
    const disputeId = await raiseDispute(ctx, disputedTransactions);
    const path = fillPath(operationOf('attachDisputeEvidence').path, { disputeId });
    const body = { evidence: [{ label: 'Merchant correspondence', asset: evidenceAsset(ctx) }] };
    ctx.expectContract('attachDisputeEvidence', await ctx.post(path, body));
  });

  it('listDisputeQueue / getDisputeForStaff — the staff view parses as declared', async (t) => {
    requireInfra(t, boot);
    const disputeId = await raiseDispute(ctx, disputedTransactions);

    const queue = await ctx.get('/disputes/admin/queue', 'staff');
    ctx.expectContract('listDisputeQueue', queue);
    expect(idsFromList(queue.body as unknown, 'listDisputeQueue')).toContain(disputeId);

    const detailPath = fillPath(operationOf('getDisputeForStaff').path, { disputeId });
    ctx.expectContract('getDisputeForStaff', await ctx.get(detailPath, 'staff'));
  });

  it('advanceDispute — staff moves a submitted dispute to investigating', async (t) => {
    requireInfra(t, boot);
    const disputeId = await raiseDispute(ctx, disputedTransactions);
    const path = fillPath(operationOf('advanceDispute').path, { disputeId });
    const body = { stage: 'investigating', note: 'Picked up by the contract suite.' };
    ctx.expectContract('advanceDispute', await ctx.post(path, body, 'staff'));
  });
});

/**
 * Raise a dispute against a seeded debit transaction that has none yet, pinning the created
 * shape; returns the dispute id. Debit-only keeps the subject resolver's chargeback rule happy.
 */
async function raiseDispute(ctx: ContractContext, used: Set<string>): Promise<string> {
  const list = await ctx.get('/transactions?direction=debit');
  const free = idsFromList(list.body as unknown, 'listTransactions').filter((id) => !used.has(id));
  const transactionId = free[0];
  if (transactionId === undefined) {
    throw new Error('The seed shipped no undisputed debit transactions.');
  }
  used.add(transactionId);

  const body = {
    transactionId,
    reason: 'unauthorised',
    detail: 'The cardholder does not recognise this charge at all.',
    contactedMerchant: false,
    evidence: [{ label: 'Receipt screenshot', asset: evidenceAsset(ctx) }],
  };
  const res = await ctx.post('/disputes', body);
  return (ctx.expectContract('createDispute', res) as { id: string }).id;
}

/** An asset reference for dispute evidence; `uploadedAt` is generated at call time. */
function evidenceAsset(ctx: ContractContext): Record<string, unknown> {
  return {
    provider: 'cloudinary',
    publicId: 'contract-tests/dispute-evidence',
    resourceType: 'image',
    uploadedAt: ctx.now().toISOString(),
  };
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
