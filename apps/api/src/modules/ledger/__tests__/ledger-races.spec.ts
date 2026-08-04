import { fromMinorUnits } from '@icb/money';
import { describe, expect, it } from 'vitest';

import { newId } from '../../../infrastructure/database/identifier.js';
import { customerRef, glRef, type AccountRef } from '../domain/account-ref.js';
import { GL_CASH } from '../domain/chart-of-accounts.js';
import { requireLive, useLiveLedger, type LiveLedger } from './live-ledger.harness.js';

/**
 * Hold and idempotency races — the gaps the posting storm does not cover.
 *
 * A card authorisation burst is holds landing on one account at the same instant, often while
 * postings are hitting the same balance document. And a customer mashing "send" (or a client
 * retrying through a flaky network) is the same idempotency key arriving fifty times at once.
 * Both must end exact: holds back to zero, the ledger untouched by holds, one canonical
 * response per key.
 *
 * Mongo-gated like the posting storm: the behaviour under test is the database's atomic `$inc`
 * and unique-index behaviour, which a mock cannot reproduce. Assertions are per-account on
 * purpose — the database is shared dev state, so a whole-database integrity scan would race
 * with whatever else is running against it.
 */
describe('ledger hold and idempotency races', () => {
  const OPENING_MINOR_UNITS = 1_000_000;
  const HOLD_MINOR_UNITS = 150;
  const HOLD_COUNT = 60;

  const getLive = useLiveLedger(OPENING_MINOR_UNITS);

  const account = (live: LiveLedger): AccountRef => customerRef(live.accountId);

  const placeHold = (live: LiveLedger, index: number): Promise<{ id: string }> =>
    live.holds.place({
      accountRef: account(live),
      amount: fromMinorUnits(HOLD_MINOR_UNITS, live.currency),
      reason: `Card authorisation ${index}`,
      expiresInMs: 60_000,
    });

  it('places a burst of holds in parallel and totals them exactly', async (context) => {
    const live = requireLive(context, getLive());

    const before = await live.ledger.getBalance(account(live), live.currency);
    const results = await Promise.allSettled(
      Array.from({ length: HOLD_COUNT }, (_unused, index) => placeHold(live, index)),
    );

    const rejected = results.filter((result) => result.status === 'rejected');
    expect(rejected.map((result) => String(result.reason))).toEqual([]);

    const total = await live.holds.totalFor(account(live), live.currency);
    expect(total.minorUnits).toBe(HOLD_COUNT * HOLD_MINOR_UNITS);

    // Holds speak for available balance; they must never move the ledger itself.
    const after = await live.ledger.getBalance(account(live), live.currency);
    expect(after.minorUnits).toBe(before.minorUnits);

    // Available (ledger − holds) never exceeds ledger while holds are non-negative.
    expect(total.minorUnits).toBeGreaterThanOrEqual(0);

    const releases = await Promise.allSettled(
      results.map((result) =>
        result.status === 'fulfilled'
          ? live.holds.release(result.value.id, 'Test complete')
          : Promise.resolve(),
      ),
    );
    expect(releases.filter((result) => result.status === 'rejected')).toEqual([]);
    expect((await live.holds.totalFor(account(live), live.currency)).minorUnits).toBe(0);
  }, 120_000);

  it('releases the same hold twice in parallel exactly once', async (context) => {
    const live = requireLive(context, getLive());

    const hold = await placeHold(live, 0);
    const results = await Promise.allSettled([
      live.holds.release(hold.id, 'First'),
      live.holds.release(hold.id, 'Second'),
    ]);

    // One wins, one is told the hold is already gone. Two successes would return money to
    // available balance that was never released; two failures would strand it forever.
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await live.holds.totalFor(account(live), live.currency)).minorUnits).toBe(0);
  }, 60_000);

  it('stays exact when places and releases interleave on one account', async (context) => {
    const live = requireLive(context, getLive());

    const first = await Promise.all(
      Array.from({ length: 40 }, (_unused, index) => placeHold(live, index)),
    );

    // Twenty releases and twenty fresh placements, all at once, on one balance document.
    const results = await Promise.allSettled([
      ...first.slice(0, 20).map((hold) => live.holds.release(hold.id, 'Captured')),
      ...Array.from({ length: 20 }, (_unused, index) => placeHold(live, 100 + index)),
    ]);
    expect(results.filter((result) => result.status === 'rejected')).toEqual([]);

    const total = await live.holds.totalFor(account(live), live.currency);
    expect(total.minorUnits).toBe(40 * HOLD_MINOR_UNITS);

    await Promise.all(
      (await live.holds.listOpen(account(live))).map((hold) =>
        live.holds.release(hold.id, 'Test complete'),
      ),
    );
    expect((await live.holds.totalFor(account(live), live.currency)).minorUnits).toBe(0);
  }, 120_000);

  it('keeps holds and postings exact while both storm the same account', async (context) => {
    const live = requireLive(context, getLive());

    const amount = fromMinorUnits(250, live.currency);
    const before = await live.ledger.getBalance(account(live), live.currency);

    const results = await Promise.allSettled([
      ...Array.from({ length: 50 }, (_unused, index) => placeHold(live, index)),
      ...Array.from({ length: 50 }, (_unused, index) =>
        live.ledger.post({
          type: 'card_purchase',
          description: `Storm posting ${index}`,
          actor: { kind: 'system', id: null, label: 'test' },
          lines: [
            { accountRef: account(live), direction: 'debit', amount },
            { accountRef: glRef(GL_CASH), direction: 'credit', amount },
          ],
        }),
      ),
    ]);
    expect(results.filter((result) => result.status === 'rejected')).toEqual([]);

    const balance = await live.ledger.getBalance(account(live), live.currency);
    expect(balance.minorUnits).toBe(before.minorUnits - 50 * 250);
    expect(balance.minorUnits).toBeGreaterThanOrEqual(0);
    expect((await live.holds.totalFor(account(live), live.currency)).minorUnits).toBe(
      50 * HOLD_MINOR_UNITS,
    );

    await Promise.all(
      (await live.holds.listOpen(account(live))).map((hold) =>
        live.holds.release(hold.id, 'Test complete'),
      ),
    );
    expect((await live.holds.totalFor(account(live), live.currency)).minorUnits).toBe(0);
  }, 120_000);

  it('an idempotency replay storm stores exactly one canonical response', async (context) => {
    const live = requireLive(context, getLive());

    const scope = `test:${newId()}`;
    const key = 'replay-storm';
    const ATTEMPTS = 100;

    // The interceptor's pattern, stormed: look up, execute-and-save if absent, then read back
    // what any caller would be served.
    const bodies = await Promise.all(
      Array.from({ length: ATTEMPTS }, async (_unused, attempt) => {
        const existing = await live.idempotency.find(scope, key);
        if (!existing) {
          await live.idempotency.save({
            scope,
            key,
            statusCode: 201,
            body: { winner: attempt },
          });
        }
        return (await live.idempotency.find(scope, key))?.body;
      }),
    );

    // Every caller — winner or replay — must converge on one and the same stored response.
    const canonical = bodies[0];
    expect(canonical).toBeDefined();
    for (const body of bodies) {
      expect(body).toEqual(canonical);
    }

    // A second storm against the stored key changes nothing: first write wins, always.
    await Promise.all(
      Array.from({ length: ATTEMPTS }, (_unused, attempt) =>
        live.idempotency.save({ scope, key, statusCode: 200, body: { winner: 1000 + attempt } }),
      ),
    );
    expect((await live.idempotency.find(scope, key))?.body).toEqual(canonical);
  }, 120_000);
});
