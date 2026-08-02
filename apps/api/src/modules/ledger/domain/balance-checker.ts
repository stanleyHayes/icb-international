import type { CurrencyCode } from '@icb/money';

import { LedgerUnbalancedError } from '../../../common/errors/index.js';
import type { PostingLine } from './posting.types.js';

/**
 * Sum of debits minus sum of credits, per currency.
 *
 * A cross-currency transaction (an FX conversion) is balanced *within each currency*, not
 * across them — 100 USD debited and 92 EUR credited is correct and must not be compared. The FX
 * rounding leg is what closes each side.
 */
export function netByCurrency(lines: readonly PostingLine[]): Map<CurrencyCode, number> {
  const net = new Map<CurrencyCode, number>();

  for (const line of lines) {
    const signed = line.direction === 'debit' ? line.amount.minorUnits : -line.amount.minorUnits;
    net.set(line.amount.currency, (net.get(line.amount.currency) ?? 0) + signed);
  }

  return net;
}

/**
 * Invariant 1 of agent_plan.md §4.4. Throws rather than returning false: an unbalanced
 * transaction must never reach the database, and a caller that ignores a boolean would let it.
 */
export function assertBalanced(lines: readonly PostingLine[]): void {
  if (lines.length < 2) {
    throw new LedgerUnbalancedError('n/a', lines.length);
  }

  for (const [currency, net] of netByCurrency(lines)) {
    if (net !== 0) {
      throw new LedgerUnbalancedError(currency, net);
    }
  }
}

/** Every amount must be strictly positive; direction carries the sign, never the amount. */
export function assertPositiveAmounts(lines: readonly PostingLine[]): void {
  for (const line of lines) {
    if (line.amount.minorUnits <= 0) {
      throw new LedgerUnbalancedError(
        line.amount.currency,
        line.amount.minorUnits,
      );
    }
  }
}

/**
 * Whether a posting increases the target account's balance.
 *
 * A debit increases an asset and decreases a liability. Customer accounts are liabilities, so a
 * debit on a current account is money leaving — which is exactly what a customer expects to see
 * as a negative on their statement.
 */
export function isIncrease(direction: 'debit' | 'credit', normalSide: 'debit' | 'credit'): boolean {
  return direction === normalSide;
}

/** Signed delta to apply to a balance, given the posting direction and the account's normal side. */
export function signedDelta(
  minorUnits: number,
  direction: 'debit' | 'credit',
  normalSide: 'debit' | 'credit',
): number {
  return isIncrease(direction, normalSide) ? minorUnits : -minorUnits;
}
