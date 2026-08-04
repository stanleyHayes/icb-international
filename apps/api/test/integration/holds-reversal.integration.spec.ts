import type { AccountDetail, Hold, TransferDetail } from '@icb/contracts';
import { fromMinorUnits } from '@icb/money';
import { afterAll, beforeAll, expect, it } from 'vitest';

import {
  assertLedgerBalanced,
  bootIntegrationApp,
  describeIntegration,
  probeMongo,
  type IntegrationApp,
} from './harness/integration-suite.js';
import {
  expectAvailableEqualsLedgerMinusHoldsPlusOverdraft,
  idempotencyKey,
  login,
  openAccount,
  registerCustomer,
} from './harness/flows.js';
import { customerRef } from '../../src/modules/ledger/domain/account-ref.js';
import { HoldService } from '../../src/modules/ledger/hold.service.js';
import { LedgerService } from '../../src/modules/ledger/ledger.service.js';

const HOLD_MS = 60_000;

/**
 * Holds and reversals, request → DB → response.
 *
 * No customer-facing route places a hold directly (the card network does, behind staff auth),
 * so the suite drives HoldService through the booted application — real service, real Mongo
 * transaction — and reads the effects back over HTTP: `GET /accounts/:id/holds` and balances.
 * The reversal half moves money over HTTP first, then reverses the posted transaction through
 * LedgerService and verifies restoration over HTTP and in the journal.
 */
const suite = await probeMongo('hold01');

describeIntegration(suite, 'holds and reversal (integration)', () => {
  let context: IntegrationApp;

  beforeAll(async () => {
    context = await bootIntegrationApp(suite.harness!);
  });

  afterAll(async () => {
    await context?.close();
  });

  it('places a hold that reduces availability, then releases it', async () => {
    const { email } = await registerCustomer(context.app, 'hold-basic');
    const session = await login(context.app, email);
    const account = await openAccount(session.agent, {
      initialDepositMinorUnits: 100_000,
      idempotencyKey: idempotencyKey('hold-basic', 'open'),
    });

    const holds = context.app.get(HoldService);
    const placed = await holds.place({
      accountRef: customerRef(account.id),
      amount: fromMinorUnits(30_000, 'USD'),
      reason: 'integration card authorisation',
      expiresInMs: HOLD_MS,
      sourceType: 'integration-test',
      sourceId: 'qa03-hold-basic',
    });

    const holdsList = await session.agent
      .get(`/v1/accounts/${account.id}/holds`)
      .expect(200);
    const openHolds = holdsList.body as Hold[];
    expect(openHolds).toHaveLength(1);
    expect(openHolds[0]?.amount.minorUnits).toBe(30_000);
    expect(openHolds[0]?.releasedAt).toBeNull();

    const during = await session.agent.get(`/v1/accounts/${account.id}`).expect(200);
    const duringBalances = (during.body as AccountDetail).balances;
    expect(duringBalances.ledger.minorUnits).toBe(100_000);
    expect(duringBalances.holds.minorUnits).toBe(30_000);
    expectAvailableEqualsLedgerMinusHoldsPlusOverdraft(duringBalances);

    await holds.release(placed.id, 'authorisation reversed');

    const afterList = await session.agent
      .get(`/v1/accounts/${account.id}/holds`)
      .expect(200);
    expect(afterList.body as Hold[]).toHaveLength(0);

    const after = await session.agent.get(`/v1/accounts/${account.id}`).expect(200);
    const afterBalances = (after.body as AccountDetail).balances;
    expect(afterBalances.holds.minorUnits).toBe(0);
    expectAvailableEqualsLedgerMinusHoldsPlusOverdraft(afterBalances);
  });

  it('stacks independent holds on one account and releases them independently', async () => {
    const { email } = await registerCustomer(context.app, 'hold-stack');
    const session = await login(context.app, email);
    // Savings carries no overdraft, so available moves one-for-one with the holds total.
    const account = await openAccount(session.agent, {
      productCode: 'ICB-SAVINGS',
      initialDepositMinorUnits: 100_000,
      idempotencyKey: idempotencyKey('hold-stack', 'open'),
    });

    const holds = context.app.get(HoldService);
    const place = (minorUnits: number, sourceId: string) =>
      holds.place({
        accountRef: customerRef(account.id),
        amount: fromMinorUnits(minorUnits, 'USD'),
        reason: 'integration stacked hold',
        expiresInMs: HOLD_MS,
        sourceType: 'integration-test',
        sourceId,
      });
    const first = await place(20_000, 'qa03-hold-stack-1');
    await place(30_000, 'qa03-hold-stack-2');

    const during = await session.agent.get(`/v1/accounts/${account.id}`).expect(200);
    const duringBalances = (during.body as AccountDetail).balances;
    expect(duringBalances.holds.minorUnits).toBe(50_000);
    expect(duringBalances.available.minorUnits).toBe(50_000);

    await holds.release(first.id, 'first authorisation reversed');

    const after = await session.agent.get(`/v1/accounts/${account.id}`).expect(200);
    const afterBalances = (after.body as AccountDetail).balances;
    expect(afterBalances.holds.minorUnits).toBe(30_000);
    expect(afterBalances.available.minorUnits).toBe(70_000);

    const openHolds = await session.agent
      .get(`/v1/accounts/${account.id}/holds`)
      .expect(200);
    expect(openHolds.body as Hold[]).toHaveLength(1);
  });

  it('reverses a completed transfer and restores both balances', async () => {
    const { email } = await registerCustomer(context.app, 'hold-reversal');
    const session = await login(context.app, email);
    const from = await openAccount(session.agent, {
      initialDepositMinorUnits: 80_000,
      idempotencyKey: idempotencyKey('hold-reversal', 'from'),
    });
    const to = await openAccount(session.agent, {
      productCode: 'ICB-SAVINGS',
      idempotencyKey: idempotencyKey('hold-reversal', 'to'),
    });

    const sent = await session.agent
      .post('/v1/transfers')
      .set('Idempotency-Key', idempotencyKey('hold-reversal', 'send'))
      .send({
        fromAccountId: from.id,
        destination: { kind: 'own_account', accountId: to.id },
        amount: { minorUnits: 25_000, currency: 'USD', scale: 2 },
        reference: 'Reversal target',
      })
      .expect(201);
    const transfer = sent.body as TransferDetail;
    expect(transfer.transactionId).not.toBeNull();

    const ledger = context.app.get(LedgerService);
    const reversal = await ledger.reverse(
      transfer.transactionId as string,
      'Integration reversal of an erroneous send',
      { kind: 'system', id: null, label: 'qa03 integration suite' },
    );
    expect(reversal.id).not.toBe(transfer.transactionId);

    const fromAfter = await session.agent.get(`/v1/accounts/${from.id}`).expect(200);
    const toAfter = await session.agent.get(`/v1/accounts/${to.id}`).expect(200);
    expect((fromAfter.body as AccountDetail).balances.ledger.minorUnits).toBe(80_000);
    expect((toAfter.body as AccountDetail).balances.ledger.minorUnits).toBe(0);

    // The journal records the link both ways: original marked reversed, reversal pointing back.
    const journal = context.harness.client
      .db(context.harness.dbName)
      .collection<{ _id: string; reversedByTransactionId: string | null }>('ledger_transactions');
    const original = await journal.findOne({ _id: transfer.transactionId as string });
    expect(original?.reversedByTransactionId).toBe(reversal.id);

    // Reversing an already-reversed transaction must refuse, not double-restore the money.
    await expect(
      ledger.reverse(transfer.transactionId as string, 'second attempt', {
        kind: 'system',
        id: null,
        label: 'qa03 integration suite',
      }),
    ).rejects.toThrow();

    // Original + reversal are both balanced pairs; the ledger as a whole still sums to zero.
    await assertLedgerBalanced(context.harness);
  });
});
