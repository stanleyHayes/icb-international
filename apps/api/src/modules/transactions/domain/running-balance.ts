/**
 * Running-balance math for a page of ledger entries.
 *
 * A statement line shows the balance *immediately after* that entry posted. The list is
 * rendered newest-first, so the balance after entry `i` is the balance after the newest
 * entry in the page minus every settled entry in between:
 *
 *   running[i] = baseline[account] − Σ settled signedMinorUnits of entries j < i (same account)
 *
 * The baseline per account+currency is supplied by the caller — it is the account's settled
 * total minus everything newer than the page, both computed with one aggregation each, so a
 * page costs O(1) queries regardless of size (no N+1). Entries still in flight contribute
 * nothing and report null, matching the contract ("null while pending").
 */

export interface RunningBalanceEntry {
  readonly accountRef: string;
  readonly currency: string;
  readonly signedMinorUnits: number;
  /** True when the entry's status counts towards the balance (posted/settled). */
  readonly settled: boolean;
}

/** Balance map key. One account can hold entries in more than one currency in principle. */
export function balanceKey(accountRef: string, currency: string): string {
  return `${accountRef}|${currency}`;
}

/**
 * Running balances aligned with `entries` by index. `baselines` holds the balance after the
 * newest entry in the page, per `balanceKey`; a missing key means the account has no settled
 * history beyond the page, so its baseline is zero.
 */
export function computeRunningBalances(
  entries: readonly RunningBalanceEntry[],
  baselines: ReadonlyMap<string, number>,
): (number | null)[] {
  const after = new Map<string, number>();

  return entries.map((entry) => {
    const key = balanceKey(entry.accountRef, entry.currency);
    const current = after.get(key) ?? baselines.get(key) ?? 0;

    if (!entry.settled) {
      after.set(key, current);
      return null;
    }

    after.set(key, current - entry.signedMinorUnits);
    return current;
  });
}

/**
 * Fold a `Σ signedMinorUnits` aggregation into a baseline map: `total − newer` per key,
 * where `newer` is the sum of everything after the page's newest entry.
 */
export function baselinesFromSums(
  totals: readonly { accountRef: string; currency: string; sum: number }[],
  newer: readonly { accountRef: string; currency: string; sum: number }[],
): Map<string, number> {
  const newerByKey = new Map(newer.map((row) => [balanceKey(row.accountRef, row.currency), row.sum]));
  const baselines = new Map<string, number>();

  for (const row of totals) {
    const key = balanceKey(row.accountRef, row.currency);
    baselines.set(key, row.sum - (newerByKey.get(key) ?? 0));
  }

  return baselines;
}
