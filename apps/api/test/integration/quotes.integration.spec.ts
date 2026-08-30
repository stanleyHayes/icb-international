import type { AccountDetail, TransferDetail, TransferQuote } from '@icb/contracts';
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
 * Quote → confirm, full request → DB → response: a quote fixes the terms, the confirm redeems
 * it exactly once (single-use under a double confirm), and a confirmed quote transfer settles
 * like any other book transfer.
 */
const suite = await probeMongo('quot01');

describeIntegration(suite, 'quote to confirm (integration)', () => {
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

  it('issues a quote, confirms it, and settles the transfer at the quoted terms', async () => {
    const { session, from, to } = await fundedPair('quot-basic', 90_000);

    const quoteResponse = await session.agent
      .post('/v1/transfers/quotes')
      .set('Idempotency-Key', idempotencyKey('quot-basic', 'quote'))
      .send({
        fromAccountId: from.id,
        destination: { kind: 'own_account', accountId: to.id },
        amount: { minorUnits: 15_000, currency: 'USD', scale: 2 },
        amountSide: 'debit',
      })
      .expect(201);

    const quote = quoteResponse.body as TransferQuote;
    expect(quote.quoteId).toBeTruthy();
    expect(quote.rail).toBe('internal');
    expect(quote.debitAmount.minorUnits).toBe(15_000);
    expect(quote.totalDebit.minorUnits).toBe(15_000);
    expect(quote.requiresApproval).toBe(false);

    const confirmResponse = await session.agent
      .post('/v1/transfers')
      .set('Idempotency-Key', idempotencyKey('quot-basic', 'confirm'))
      .send({
        quoteId: quote.quoteId,
        fromAccountId: from.id,
        destination: { kind: 'own_account', accountId: to.id },
        amount: { minorUnits: 15_000, currency: 'USD', scale: 2 },
      })
      .expect(201);

    const transfer = confirmResponse.body as TransferDetail;
    expect(transfer.status).toBe('completed');
    expect(transfer.debitAmount.minorUnits).toBe(15_000);

    const fromAfter = await session.agent.get(`/v1/accounts/${from.id}`).expect(200);
    const toAfter = await session.agent.get(`/v1/accounts/${to.id}`).expect(200);
    expect((fromAfter.body as AccountDetail).balances.ledger.minorUnits).toBe(75_000);
    expect((toAfter.body as AccountDetail).balances.ledger.minorUnits).toBe(15_000);

    await assertLedgerBalanced(context.harness);
  });

  it('replays a quote request under the same idempotency key with the original quoteId', async () => {
    const { session, from, to } = await fundedPair('quot-idem', 90_000);
    const key = idempotencyKey('quot-idem', 'quote');
    const payload = {
      fromAccountId: from.id,
      destination: { kind: 'own_account', accountId: to.id },
      amount: { minorUnits: 12_000, currency: 'USD', scale: 2 },
      amountSide: 'debit',
    };

    const first = (
      await session.agent
        .post('/v1/transfers/quotes')
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201)
    ).body as TransferQuote;

    // A retried request (network flap, double tap) must replay the stored response: a quote is
    // single-use, so minting a second quoteId under the same key would strand the first one
    // and let a client burn through quote inventory by accident.
    const replayed = (
      await session.agent
        .post('/v1/transfers/quotes')
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201)
    ).body as TransferQuote;

    expect(replayed.quoteId).toBe(first.quoteId);
  });

  it('makes a quote single-use: a second confirm with the same quote is refused', async () => {
    const { session, from, to } = await fundedPair('quot-once', 90_000);

    const quote = (
      await session.agent
        .post('/v1/transfers/quotes')
        .set('Idempotency-Key', idempotencyKey('quot-once', 'quote'))
        .send({
          fromAccountId: from.id,
          destination: { kind: 'own_account', accountId: to.id },
          amount: { minorUnits: 10_000, currency: 'USD', scale: 2 },
          amountSide: 'debit',
        })
        .expect(201)
    ).body as TransferQuote;

    const confirm = (key: string) =>
      session.agent
        .post('/v1/transfers')
        .set('Idempotency-Key', key)
        .send({
          quoteId: quote.quoteId,
          fromAccountId: from.id,
          destination: { kind: 'own_account', accountId: to.id },
          amount: { minorUnits: 10_000, currency: 'USD', scale: 2 },
        });

    await confirm(idempotencyKey('quot-once', 'confirm-1')).expect(201);

    // A fresh idempotency key, so this is a genuinely new request redeeming a spent quote.
    const second = await confirm(idempotencyKey('quot-once', 'confirm-2'));
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.status).toBeLessThan(500);

    const fromAfter = await session.agent.get(`/v1/accounts/${from.id}`).expect(200);
    expect((fromAfter.body as AccountDetail).balances.ledger.minorUnits).toBe(80_000);

    await assertLedgerBalanced(context.harness);
  });

  it('refuses to quote a transfer that pays an account the sender does not own', async () => {
    const { session, from } = await fundedPair('quot-idor-a', 50_000);
    const stranger = await registerCustomer(context.app, 'quot-idor-b');
    const strangerSession = await login(context.app, stranger.email);
    const notMine = await openAccount(strangerSession.agent, {
      idempotencyKey: idempotencyKey('quot-idor-b', 'acct'),
    });

    // Ownership is enforced where terms are fixed, not just where money moves: a quote naming
    // a stranger's account as the `own_account` destination is refused like the confirm would.
    const quote = await session.agent
      .post('/v1/transfers/quotes')
      .set('Idempotency-Key', idempotencyKey('quot-idor-a', 'quote'))
      .send({
        fromAccountId: from.id,
        destination: { kind: 'own_account', accountId: notMine.id },
        amount: { minorUnits: 1_000, currency: 'USD', scale: 2 },
        amountSide: 'debit',
      });
    expect(quote.status).toBeGreaterThanOrEqual(400);
    expect(quote.status).toBeLessThan(500);

    const fromAfter = await session.agent.get(`/v1/accounts/${from.id}`).expect(200);
    expect((fromAfter.body as AccountDetail).balances.ledger.minorUnits).toBe(50_000);
    const strangerAfter = await strangerSession.agent
      .get(`/v1/accounts/${notMine.id}`)
      .expect(200);
    expect((strangerAfter.body as AccountDetail).balances.ledger.minorUnits).toBe(0);

    await assertLedgerBalanced(context.harness);
  });

  // QA-03 regression pin: the interceptor claims `(scope, key)` atomically before executing,
  // so a parallel burst with one key runs the handler exactly once — the losers wait for the
  // winner's stored response and replay it. Sequential replay is covered above.
  it('returns one quoteId when the same key races in parallel', async () => {
    const { session, from, to } = await fundedPair('quot-race', 90_000);
    const payload = {
      fromAccountId: from.id,
      destination: { kind: 'own_account', accountId: to.id },
      amount: { minorUnits: 5_000, currency: 'USD', scale: 2 },
      amountSide: 'debit',
    };

    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        session.agent
          .post('/v1/transfers/quotes')
          .set('Idempotency-Key', idempotencyKey('quot-race', 'quote'))
          .send(payload),
      ),
    );

    for (const attempt of attempts) {
      expect(attempt.status).toBe(201);
    }
    const quoteIds = new Set(
      attempts.map((attempt) => (attempt.body as TransferQuote).quoteId),
    );
    expect(quoteIds.size).toBe(1);
  });
});
