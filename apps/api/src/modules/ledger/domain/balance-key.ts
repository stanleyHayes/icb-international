import type { PostingLine } from './posting.types.js';

/**
 * The contention key for a posting line.
 *
 * `account_balances` is keyed on (accountRef, currency), so that pair names the one document
 * concurrent postings fight over. Serialising on it is what turns a write-conflict storm into
 * an orderly queue — see KeyedMutex.
 */
export function balanceKey(accountRef: string, currency: string): string {
  return `balance:${accountRef}:${currency}`;
}

/** Every balance document a set of posting lines will touch, deduplicated. */
export function balanceKeysFor(lines: readonly PostingLine[]): string[] {
  return [...new Set(lines.map((line) => balanceKey(line.accountRef, line.amount.currency)))];
}
