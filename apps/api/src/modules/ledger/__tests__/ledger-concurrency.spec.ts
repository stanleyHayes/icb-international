import { fromMinorUnits } from '@icb/money';
import { describe, expect, it } from 'vitest';

import { customerRef, glRef } from '../domain/account-ref.js';
import { GL_CASH } from '../domain/chart-of-accounts.js';
import { requireLive, useLiveLedger } from './live-ledger.harness.js';

/**
 * The test that matters.
 *
 * A ledger that balances when one request runs at a time proves nothing — the conditions under
 * which a bank actually loses money are payday, month end, and a burst of card authorisations,
 * all of which mean many writes against one account at the same instant.
 *
 * Requires the local MongoDB replica set (`pnpm infra:up`). It is a real database test on
 * purpose: the behaviour under examination is Mongo's write-conflict handling, which a mock
 * cannot reproduce. When the replica set is not running the whole suite skips with a message —
 * an unavailable Docker daemon is an environment fact, never a false failure.
 */
describe('ledger under concurrency', () => {
  const OPENING_MINOR_UNITS = 1_000_000; // 10,000.00
  const CONCURRENT_POSTINGS = 200;
  const POSTING_MINOR_UNITS = 250; // 2.50 each

  const getLive = useLiveLedger(OPENING_MINOR_UNITS);

  it(`keeps the ledger exact across ${CONCURRENT_POSTINGS} simultaneous postings`, async (context) => {
    const live = requireLive(context, getLive());
    const amount = fromMinorUnits(POSTING_MINOR_UNITS, live.currency);

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_POSTINGS }, (_unused, index) =>
        live.ledger.post({
          type: 'card_purchase',
          description: `Concurrent posting ${index}`,
          actor: { kind: 'system', id: null, label: 'test' },
          lines: [
            { accountRef: customerRef(live.accountId), direction: 'debit', amount },
            { accountRef: glRef(GL_CASH), direction: 'credit', amount },
          ],
        }),
      ),
    );

    // Every posting must land. A dropped write here is a payment a customer made that the bank
    // has no record of — the failure mode this whole test exists to rule out. The first version
    // of this assertion failed 179/200; the reason it passes now is KeyedMutex, which queues
    // postings that share a balance document instead of letting them collide and burn retries.
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(rejected.map((result) => String(result.reason))).toEqual([]);

    const balance = await live.ledger.getBalance(customerRef(live.accountId), live.currency);
    expect(balance.minorUnits).toBe(
      OPENING_MINOR_UNITS - CONCURRENT_POSTINGS * POSTING_MINOR_UNITS,
    );
    // Exactness is the point, but note the floor too: the storm leaves the account positive.
    expect(balance.minorUnits).toBeGreaterThanOrEqual(0);
  }, 180_000);

  it('leaves every invariant intact afterwards', async (context) => {
    const live = requireLive(context, getLive());

    const report = await live.integrity.verify();

    for (const check of report.checks) {
      expect(check.passed, `${check.name}: ${check.detail}`).toBe(true);
    }
    expect(report.balanced).toBe(true);
    expect(report.driftDetected).toHaveLength(0);
  }, 120_000);

  it('refuses an unbalanced transaction rather than writing half of it', async (context) => {
    const live = requireLive(context, getLive());

    const before = await live.ledger.getBalance(customerRef(live.accountId), live.currency);

    await expect(
      live.ledger.post({
        type: 'adjustment',
        description: 'Deliberately unbalanced',
        actor: { kind: 'system', id: null, label: 'test' },
        lines: [
          {
            accountRef: customerRef(live.accountId),
            direction: 'debit',
            amount: fromMinorUnits(500, live.currency),
          },
          {
            accountRef: glRef(GL_CASH),
            direction: 'credit',
            amount: fromMinorUnits(400, live.currency),
          },
        ],
      }),
    ).rejects.toThrow();

    const after = await live.ledger.getBalance(customerRef(live.accountId), live.currency);
    expect(after.minorUnits).toBe(before.minorUnits);
  }, 60_000);

  it('reverses by mirroring, leaving both transactions on the record', async (context) => {
    const live = requireLive(context, getLive());

    const amount = fromMinorUnits(7_500, live.currency);
    const before = await live.ledger.getBalance(customerRef(live.accountId), live.currency);

    const original = await live.ledger.post({
      type: 'card_purchase',
      description: 'To be reversed',
      actor: { kind: 'system', id: null, label: 'test' },
      lines: [
        { accountRef: customerRef(live.accountId), direction: 'debit', amount },
        { accountRef: glRef(GL_CASH), direction: 'credit', amount },
      ],
    });

    const afterPost = await live.ledger.getBalance(customerRef(live.accountId), live.currency);
    expect(afterPost.minorUnits).toBe(before.minorUnits - amount.minorUnits);

    const reversal = await live.ledger.reverse(original.id, 'Duplicate charge', {
      kind: 'staff',
      id: null,
      label: 'test',
    });

    expect(reversal.id).not.toBe(original.id);

    const afterReversal = await live.ledger.getBalance(customerRef(live.accountId), live.currency);
    expect(afterReversal.minorUnits).toBe(before.minorUnits);

    // Reversing twice must be impossible; the second attempt is a conflict, not a second credit.
    await expect(
      live.ledger.reverse(original.id, 'Again', { kind: 'staff', id: null, label: 'test' }),
    ).rejects.toThrow();
  }, 90_000);
});
