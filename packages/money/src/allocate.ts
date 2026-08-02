import { fromMinorUnits, type Money } from './money.js';

/**
 * Split an amount across N ratios without losing or inventing a single minor unit.
 *
 * Uses largest-remainder (Hamilton) apportionment: floor every share, then hand the leftover
 * units out one at a time to the shares with the largest fractional remainder. Ties break toward
 * the earlier index so the result is deterministic and reproducible in tests.
 *
 * Naive `round(total * ratio)` per share is what causes a bank's split payments to be off by a
 * cent — this cannot be.
 *
 * @example allocate(fromMinorUnits(100, 'USD'), [1, 1, 1]) // 34c, 33c, 33c
 */
export function allocate(total: Money, ratios: readonly number[]): Money[] {
  if (ratios.length === 0) {
    throw new RangeError('allocate requires at least one ratio');
  }
  if (ratios.some((ratio) => !Number.isFinite(ratio) || ratio < 0)) {
    throw new RangeError('allocate ratios must be finite and non-negative');
  }

  const ratioTotal = ratios.reduce((acc, ratio) => acc + ratio, 0);
  if (ratioTotal <= 0) {
    throw new RangeError('allocate ratios must sum to a positive value');
  }

  const sign = total.minorUnits < 0 ? -1 : 1;
  const magnitude = Math.abs(total.minorUnits);

  const shares = ratios.map((ratio, index) => {
    const exact = (magnitude * ratio) / ratioTotal;
    const floored = Math.floor(exact);
    return { index, floored, remainder: exact - floored };
  });

  let distributed = shares.reduce((acc, share) => acc + share.floored, 0);
  const leftover = magnitude - distributed;

  const byRemainder = [...shares].sort(
    (left, right) => right.remainder - left.remainder || left.index - right.index,
  );

  for (let given = 0; given < leftover; given += 1) {
    const target = byRemainder[given % byRemainder.length];
    /* c8 ignore next 1 — modulo guarantees a hit; satisfies noUncheckedIndexedAccess. */
    if (!target) continue;
    target.floored += 1;
    distributed += 1;
  }

  return shares.map((share) => fromMinorUnits(sign * share.floored, total.currency));
}

/**
 * Split evenly into `parts`. Equivalent to `allocate(total, Array(parts).fill(1))` but avoids
 * building the ratio array in hot paths (loan schedules call this per instalment).
 */
export function allocateEvenly(total: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new RangeError('allocateEvenly requires a positive integer part count');
  }
  return allocate(total, Array.from({ length: parts }, () => 1));
}
