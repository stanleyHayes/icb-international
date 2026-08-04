import type { AccountDetail, TransferDetail } from '@icb/contracts';
import type { AuthenticatedAgent } from '@icb/testing';
import { afterAll, beforeAll, expect, it } from 'vitest';

import {
  assertLedgerBalanced,
  bootIntegrationApp,
  describeIntegration,
  probeMongo,
  type IntegrationApp,
} from './harness/integration-suite.js';
import {
  idempotencyKey,
  login,
  openAccount,
  registerCustomer,
} from './harness/flows.js';

/**
 * Internal transfer, full request → DB → response: money moves between two of the customer's
 * own accounts in one transaction, the ledger stays balanced (checked directly against
 * `ledger_entries`, not through the API), and a retried create posts exactly once.
 */
const suite = await probeMongo('xfer01');

describeIntegration(suite, 'internal transfer (integration)', () => {
  let context: IntegrationApp;

  beforeAll(async () => {
    context = await bootIntegrationApp(suite.harness!);
  });

  afterAll(async () => {
    await context?.close();
  });

  async function fundedPair(label: string, depositMinorUnits: number) {
    const { email } = await registerCustomer(context.app, label);
    const session = await login(context.app, email);
    const from = await openAccount(session.agent, {
      initialDepositMinorUnits: depositMinorUnits,
      idempotencyKey: idempotencyKey(label, 'from'),
    });
    const to = await openAccount(session.agent, {
      productCode: 'ICB-SAVINGS',
      idempotencyKey: idempotencyKey(label, 'to'),
    });
    return { session, from, to };
  }

  async function getAccount(
    agent: AuthenticatedAgent,
    accountId: string,
  ): Promise<AccountDetail> {
    const response = await agent.get(`/v1/accounts/${accountId}`).expect(200);
    return response.body as AccountDetail;
  }

  it('moves money between own accounts and leaves a balanced ledger', async () => {
    const { session, from, to } = await fundedPair('xfer-basic', 100_000);

    const response = await session.agent
      .post('/v1/transfers')
      .set('Idempotency-Key', idempotencyKey('xfer-basic', 'send'))
      .send({
        fromAccountId: from.id,
        destination: { kind: 'own_account', accountId: to.id },
        amount: { minorUnits: 40_000, currency: 'USD', scale: 2 },
        reference: 'Integration transfer',
      })
      .expect(201);

    const transfer = response.body as TransferDetail;
    expect(transfer.status).toBe('completed');
    expect(transfer.rail).toBe('internal');
    expect(transfer.debitAmount.minorUnits).toBe(40_000);

    const fromAfter = await getAccount(session.agent, from.id);
    const toAfter = await getAccount(session.agent, to.id);
    expect(fromAfter.balances.ledger.minorUnits).toBe(60_000);
    expect(toAfter.balances.ledger.minorUnits).toBe(40_000);

    const detail = await session.agent.get(`/v1/transfers/${transfer.id}`).expect(200);
    expect((detail.body as TransferDetail).completedAt).not.toBeNull();

    await assertLedgerBalanced(context.harness);
  });

  it('replays a transfer create under the same idempotency key without double-posting', async () => {
    const { session, from, to } = await fundedPair('xfer-idem', 50_000);
    const key = idempotencyKey('xfer-idem', 'send');
    const payload = {
      fromAccountId: from.id,
      destination: { kind: 'own_account', accountId: to.id },
      amount: { minorUnits: 10_000, currency: 'USD', scale: 2 },
    };

    const first = await session.agent
      .post('/v1/transfers')
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    const replayed = await session.agent
      .post('/v1/transfers')
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);

    const firstTransfer = first.body as TransferDetail;
    const replayedTransfer = replayed.body as TransferDetail;
    expect(replayedTransfer.id).toBe(firstTransfer.id);

    // The replay returned the stored response; money moved exactly once.
    const fromAfter = await getAccount(session.agent, from.id);
    const toAfter = await getAccount(session.agent, to.id);
    expect(fromAfter.balances.ledger.minorUnits).toBe(40_000);
    expect(toAfter.balances.ledger.minorUnits).toBe(10_000);

    await assertLedgerBalanced(context.harness);
  });

  it('rejects an overdraft beyond the agreed limit and posts nothing', async () => {
    const { session, from, to } = await fundedPair('xfer-poor', 5_000);

    const response = await session.agent
      .post('/v1/transfers')
      .set('Idempotency-Key', idempotencyKey('xfer-poor', 'send'))
      .send({
        fromAccountId: from.id,
        destination: { kind: 'own_account', accountId: to.id },
        amount: { minorUnits: 500_000, currency: 'USD', scale: 2 },
      });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);

    const fromAfter = await getAccount(session.agent, from.id);
    const toAfter = await getAccount(session.agent, to.id);
    expect(fromAfter.balances.ledger.minorUnits).toBe(5_000);
    expect(toAfter.balances.ledger.minorUnits).toBe(0);

    await assertLedgerBalanced(context.harness);
  });

  it('refuses to move money into an account the sender does not own', async () => {
    const { session, from } = await fundedPair('xfer-idor-a', 20_000);
    const stranger = await registerCustomer(context.app, 'xfer-idor-b');
    const strangerSession = await login(context.app, stranger.email);
    const notMine = await openAccount(strangerSession.agent, {
      idempotencyKey: idempotencyKey('xfer-idor-b', 'acct'),
    });

    const response = await session.agent
      .post('/v1/transfers')
      .set('Idempotency-Key', idempotencyKey('xfer-idor-a', 'send'))
      .send({
        fromAccountId: from.id,
        destination: { kind: 'own_account', accountId: notMine.id },
        amount: { minorUnits: 1_000, currency: 'USD', scale: 2 },
      });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);

    const fromAfter = await getAccount(session.agent, from.id);
    expect(fromAfter.balances.ledger.minorUnits).toBe(20_000);

    await assertLedgerBalanced(context.harness);
  });
});
