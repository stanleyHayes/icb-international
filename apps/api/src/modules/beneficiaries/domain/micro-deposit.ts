import { createHmac, timingSafeEqual } from 'node:crypto';

import { createRandom } from '../../../simulation/seed/random.js';

/**
 * Micro-deposit verification.
 *
 * Two small credits land on the destination and the customer reads them back. The amounts are
 * never stored in the clear — only an HMAC — so a database dump does not hand an attacker the
 * answer, and the comparison is constant-time so a network observer cannot walk the digits.
 *
 * Amounts are drawn from a seeded generator rather than `Math.random()`: the same beneficiary,
 * at the same simulated instant, always gets the same pair, which is what makes a demo
 * reproducible and a bug report replayable.
 */

export const MICRO_DEPOSIT_ATTEMPTS = 3;

const MIN_MINOR_UNITS = 1;
const MAX_MINOR_UNITS = 99;

export interface MicroDepositAmounts {
  readonly first: number;
  readonly second: number;
}

function draw(next: () => number): number {
  const span = MAX_MINOR_UNITS - MIN_MINOR_UNITS + 1;
  return MIN_MINOR_UNITS + Math.floor(next() * span);
}

export function generateMicroDeposits(seed: string): MicroDepositAmounts {
  const next = createRandom(seed);
  return { first: draw(next), second: draw(next) };
}

/** Bound to the beneficiary id so a digest lifted from one row cannot be replayed against another. */
export function hashMicroDeposits(
  key: string,
  beneficiaryId: string,
  amounts: MicroDepositAmounts,
): string {
  return createHmac('sha256', key)
    .update(`${beneficiaryId}:${amounts.first}:${amounts.second}`)
    .digest('hex');
}

export function microDepositsMatch(stored: string | null, candidate: string): boolean {
  if (!stored || stored.length !== candidate.length) {
    return false;
  }
  const left = Buffer.from(stored, 'hex');
  const right = Buffer.from(candidate, 'hex');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}
