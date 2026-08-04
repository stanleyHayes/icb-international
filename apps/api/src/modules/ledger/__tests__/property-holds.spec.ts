import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

/**
 * Property tests for the hold lifecycle's core invariant: available never exceeds ledger.
 *
 * Available balance is `ledger − holds`, so the invariant holds exactly while the hold total is
 * non-negative and equals the sum of the holds still open. This suite drives a pure model —
 * the same arithmetic `HoldService` applies through `$inc` on `holdMinorUnits` — through random
 * place / release / expire sequences, including double releases and sweeps that only expire
 * what is due. The concurrency counterpart (`ledger-races.spec.ts`) runs the real service
 * against MongoDB; here the point is that *no sequence of valid operations* can break the
 * arithmetic, which a handful of hand-picked cases cannot show.
 */
const RUNS = { numRuns: 10_000 };

const LEDGER_MINOR_UNITS = 5_000_000;

/** Mirrors the rules HoldService enforces: positive placements, no double release. */
class HoldModel {
  private readonly open = new Map<number, { amount: number; expiresAt: number }>();
  total = 0;

  place(id: number, amount: number, expiresAt: number): void {
    if (amount <= 0) {
      throw new Error('A hold must be for a positive amount');
    }
    this.open.set(id, { amount, expiresAt });
    this.total += amount;
  }

  release(id: number): void {
    const hold = this.open.get(id);
    if (!hold) {
      throw new Error('This hold has already been released');
    }
    this.open.delete(id);
    this.total -= hold.amount;
  }

  /** The end-of-day sweep: only holds whose expiry has passed are released. */
  expireDue(now: number): number {
    let expired = 0;
    for (const [id, hold] of [...this.open]) {
      if (hold.expiresAt <= now) {
        this.release(id);
        expired += 1;
      }
    }
    return expired;
  }

  get openCount(): number {
    return this.open.size;
  }

  sumOpen(): number {
    return [...this.open.values()].reduce((acc, hold) => acc + hold.amount, 0);
  }
}

/** Every hold a script will place: amount and time-to-expiry. */
const arbHoldSpec = fc.tuple(
  fc.integer({ min: 1, max: 500_000 }),
  fc.integer({ min: 0, max: 10_000 }),
);

/** Assert the invariant after every single operation, not just at the end. */
function expectInvariant(model: HoldModel): void {
  expect(model.total).toBe(model.sumOpen());
  expect(model.total).toBeGreaterThanOrEqual(0);
  expect(LEDGER_MINOR_UNITS - model.total).toBeLessThanOrEqual(LEDGER_MINOR_UNITS);
}

describe('hold place/release/expire invariants', () => {
  it('never lets available exceed ledger across any random lifecycle', () => {
    fc.assert(
      fc.property(
        fc.array(arbHoldSpec, { minLength: 1, maxLength: 30 }),
        fc.array(fc.nat(), { minLength: 1, maxLength: 40 }),
        fc.array(fc.integer({ min: 1, max: 5_000 }), { minLength: 1, maxLength: 5 }),
        (specs, releaseOrder, sweepAdvances) => {
          const model = new HoldModel();
          let now = 0;

          for (const [id, [amount, ttlMs]] of specs.entries()) {
            model.place(id, amount, now + ttlMs);
            expectInvariant(model);
          }

          // Interleave explicit releases (duplicates become double-release attempts, which must
          // throw) with sweeps that advance simulated time.
          const sweeps = [...sweepAdvances];
          for (const rawTarget of releaseOrder) {
            const target = rawTarget % specs.length;
            try {
              model.release(target);
            } catch (error) {
              expect((error as Error).message).toContain('already been released');
            }
            expectInvariant(model);

            if (sweeps.length > 0 && rawTarget % 3 === 0) {
              now += sweeps.shift() as number;
              model.expireDue(now);
              expectInvariant(model);
            }
          }

          // A final sweep beyond every expiry must drain the account's holds to exactly zero.
          model.expireDue(now + 10_001);
          expect(model.total).toBe(0);
          expect(model.openCount).toBe(0);
          expect(LEDGER_MINOR_UNITS - model.total).toBe(LEDGER_MINOR_UNITS);
        },
      ),
      RUNS,
    );
  });

  it('rejects a non-positive hold amount, always', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: 0 }), (amount) => {
        const model = new HoldModel();
        expect(() => model.place(0, amount, 1_000)).toThrow('positive amount');
        expect(model.total).toBe(0);
      }),
      RUNS,
    );
  });

  it('a sweep releases exactly the due holds and no more', () => {
    fc.assert(
      fc.property(
        fc.array(arbHoldSpec, { minLength: 1, maxLength: 30 }),
        fc.integer({ min: 0, max: 10_000 }),
        (specs, now) => {
          const model = new HoldModel();
          for (const [id, [amount, ttlMs]] of specs.entries()) {
            model.place(id, amount, ttlMs);
          }

          const dueTotal = specs
            .filter(([, ttlMs]) => ttlMs <= now)
            .reduce((acc, [amount]) => acc + amount, 0);
          const dueCount = specs.filter(([, ttlMs]) => ttlMs <= now).length;

          const placed = model.total;
          expect(model.expireDue(now)).toBe(dueCount);
          expect(model.total).toBe(placed - dueTotal);
          expectInvariant(model);
        },
      ),
      RUNS,
    );
  });

  it('a double release never takes the total negative', () => {
    fc.assert(
      fc.property(arbHoldSpec, ([amount, ttlMs]) => {
        const model = new HoldModel();
        model.place(0, amount, ttlMs);
        model.release(0);
        expect(model.total).toBe(0);
        expect(() => model.release(0)).toThrow('already been released');
        expect(model.total).toBe(0);
        expect(LEDGER_MINOR_UNITS - model.total).toBeLessThanOrEqual(LEDGER_MINOR_UNITS);
      }),
      RUNS,
    );
  });
});
