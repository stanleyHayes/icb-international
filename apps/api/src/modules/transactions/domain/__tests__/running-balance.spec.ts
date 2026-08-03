import { describe, expect, it } from 'vitest';

import {
  balanceKey,
  baselinesFromSums,
  computeRunningBalances,
  type RunningBalanceEntry,
} from '../running-balance.js';

function entry(
  accountRef: string,
  signedMinorUnits: number,
  settled = true,
  currency = 'USD',
): RunningBalanceEntry {
  return { accountRef, currency, signedMinorUnits, settled };
}

describe('computeRunningBalances', () => {
  it('walks backwards from the baseline, newest first', () => {
    // Page is newest-first: balance after the newest entry is the baseline itself.
    const entries = [entry('acct:a', -500), entry('acct:a', 2_000), entry('acct:a', -300)];
    const balances = computeRunningBalances(entries, new Map([[balanceKey('acct:a', 'USD'), 1_200]]));

    expect(balances).toEqual([1_200, 1_700, -300]);
  });

  it('tracks accounts independently within one page', () => {
    const entries = [entry('acct:a', 100), entry('acct:b', -50), entry('acct:a', -20)];
    const baselines = new Map([
      [balanceKey('acct:a', 'USD'), 1_000],
      [balanceKey('acct:b', 'USD'), 500],
    ]);

    expect(computeRunningBalances(entries, baselines)).toEqual([1_000, 500, 900]);
  });

  it('tracks currencies independently within one account', () => {
    const entries = [entry('acct:a', 100, true, 'USD'), entry('acct:a', -40, true, 'GHS')];
    const baselines = new Map([
      [balanceKey('acct:a', 'USD'), 250],
      [balanceKey('acct:a', 'GHS'), 960],
    ]);

    expect(computeRunningBalances(entries, baselines)).toEqual([250, 960]);
  });

  it('reports null for pending entries and does not subtract them', () => {
    const entries = [entry('acct:a', -999, false), entry('acct:a', 2_000)];
    const balances = computeRunningBalances(entries, new Map([[balanceKey('acct:a', 'USD'), 1_000]]));

    // The pending debit is invisible to the balance; the credit below it sees the full 1_000.
    expect(balances).toEqual([null, 1_000]);
  });

  it('treats a missing baseline as zero (no settled history beyond the page)', () => {
    const entries = [entry('acct:a', 500), entry('acct:a', 500)];
    expect(computeRunningBalances(entries, new Map())).toEqual([0, -500]);
  });

  it('handles an empty page', () => {
    expect(computeRunningBalances([], new Map())).toEqual([]);
  });
});

describe('baselinesFromSums', () => {
  it('subtracts the newer-than-page activity from the settled total', () => {
    const baselines = baselinesFromSums(
      [{ accountRef: 'acct:a', currency: 'USD', sum: 5_000 }],
      [{ accountRef: 'acct:a', currency: 'USD', sum: 1_200 }],
    );

    expect(baselines.get(balanceKey('acct:a', 'USD'))).toBe(3_800);
  });

  it('keeps accounts absent from the newer aggregation at their full total', () => {
    const baselines = baselinesFromSums(
      [{ accountRef: 'acct:a', currency: 'USD', sum: 5_000 }],
      [],
    );

    expect(baselines.get(balanceKey('acct:a', 'USD'))).toBe(5_000);
  });
});
