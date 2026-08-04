import type { AccountDetail, AccountSummary } from '@icb/contracts';
import { afterAll, beforeAll, expect, it } from 'vitest';

import {
  bootIntegrationApp,
  describeIntegration,
  probeMongo,
  type IntegrationApp,
} from './harness/integration-suite.js';
import {
  anonymous,
  expectAvailableEqualsLedgerMinusHoldsPlusOverdraft,
  idempotencyKey,
  login,
  openAccount,
  registerCustomer,
} from './harness/flows.js';

/**
 * Account opening, full request → DB → response: the opening deposit posts through the ledger,
 * balances read back over HTTP, and a retried open replays the original response (N6).
 */
const suite = await probeMongo('acct01');

describeIntegration(suite, 'accounts (integration)', () => {
  let context: IntegrationApp;

  beforeAll(async () => {
    context = await bootIntegrationApp(suite.harness!);
  });

  afterAll(async () => {
    await context?.close();
  });

  it('opens an account with an opening deposit and reads the balance back', async () => {
    const { email } = await registerCustomer(context.app, 'acct-open');
    const session = await login(context.app, email);

    const account = await openAccount(session.agent, {
      initialDepositMinorUnits: 250_000,
      idempotencyKey: idempotencyKey('acct-open', 'open'),
    });

    expect(account.currency).toBe('USD');
    expect(account.identifiers.number).toMatch(/^\d{10}$/);
    expect(account.balances.ledger.minorUnits).toBe(250_000);
    expect(account.balances.holds.minorUnits).toBe(0);
    // available = ledger − holds + agreed overdraft; ICB-CURRENT carries 50_000 of overdraft.
    expectAvailableEqualsLedgerMinusHoldsPlusOverdraft(account.balances);

    const balances = await session.agent
      .get(`/v1/accounts/${account.id}/balances`)
      .expect(200);
    expect((balances.body as AccountDetail['balances']).ledger.minorUnits).toBe(250_000);

    const list = await session.agent.get('/v1/accounts').expect(200);
    const items = (list.body as { items: AccountSummary[] }).items;
    expect(items.map((item) => item.id)).toContain(account.id);
  });

  it('replays an account open under the same idempotency key instead of opening twice', async () => {
    const { email } = await registerCustomer(context.app, 'acct-idem');
    const session = await login(context.app, email);
    const key = idempotencyKey('acct-idem', 'open');

    const first = await openAccount(session.agent, { idempotencyKey: key });
    const replayed = await openAccount(session.agent, { idempotencyKey: key });

    expect(replayed.id).toBe(first.id);
    expect(replayed.identifiers.number).toBe(first.identifiers.number);

    const list = await session.agent.get('/v1/accounts').expect(200);
    expect((list.body as { items: AccountSummary[] }).items).toHaveLength(1);

    // A different key is a different request and must open a second account. The catalogue
    // caps one account per product per currency, so the second open is a different product.
    const second = await openAccount(session.agent, {
      productCode: 'ICB-SAVINGS',
      idempotencyKey: idempotencyKey('acct-idem', 'open-again'),
    });
    expect(second.id).not.toBe(first.id);
  });

  it('refuses an unknown product and an unauthenticated open', async () => {
    const { email } = await registerCustomer(context.app, 'acct-guard');
    const session = await login(context.app, email);

    await session.agent
      .post('/v1/accounts')
      .set('Idempotency-Key', idempotencyKey('acct-guard', 'bad-product'))
      .send({ productCode: 'NO-SUCH-PRODUCT', currency: 'USD' })
      .expect(404);

    await anonymous(context.app)
      .post('/v1/accounts')
      .set('Idempotency-Key', idempotencyKey('acct-guard', 'no-token'))
      .send({ productCode: 'ICB-CURRENT', currency: 'USD' })
      .expect(401);
  });

  it('keeps one customer from reading another customer’s account', async () => {
    const owner = await registerCustomer(context.app, 'acct-owner');
    const ownerSession = await login(context.app, owner.email);
    const account = await openAccount(ownerSession.agent, {
      idempotencyKey: idempotencyKey('acct-owner', 'open'),
    });

    const intruder = await registerCustomer(context.app, 'acct-intruder');
    const intruderSession = await login(context.app, intruder.email);

    // Ownership is scoped by the query: another customer's id reads as absent, not forbidden —
    // the response must not confirm the account exists.
    await intruderSession.agent.get(`/v1/accounts/${account.id}`).expect(404);
    await intruderSession.agent.get(`/v1/accounts/${account.id}/balances`).expect(404);
  });
});
