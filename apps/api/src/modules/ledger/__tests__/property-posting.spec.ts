import fc from 'fast-check';
import { fromMinorUnits, type CurrencyCode } from '@icb/money';
import { describe, expect, it } from 'vitest';

import { LedgerUnbalancedError } from '../../../common/errors/index.js';
import { customerRef, glRef, normalSideForRef, type AccountRef } from '../domain/account-ref.js';
import {
  assertBalanced,
  assertPositiveAmounts,
  netByCurrency,
  signedDelta,
} from '../domain/balance-checker.js';
import { listGlAccounts } from '../domain/chart-of-accounts.js';
import type { PostingLine } from '../domain/posting.types.js';

/**
 * Property tests for the ledger's pure domain — no database, no Nest context.
 *
 * The invariants under test are the ones agent_plan.md §4.4 makes non-negotiable: a balanced
 * posting is accepted, an unbalanced one is always refused, and a reversal returns every account
 * to exactly where it started. The live-database counterparts (atomicity, contention) live in
 * `ledger-concurrency.spec.ts`; here the balance store is a Map so 10k random commands cost
 * milliseconds. Balance deltas are computed by the real `signedDelta`/`normalSideForRef`, the
 * same functions `LedgerService` applies through `$inc`.
 */
const RUNS = { numRuns: 10_000 };

const CURRENCIES = ['USD', 'EUR', 'JPY'] as const;
const arbCurrency = fc.constantFrom<CurrencyCode>(...CURRENCIES);

const arbHexDigit = fc.constantFrom(...'0123456789abcdef');

const arbAccountRef: fc.Arbitrary<AccountRef> = fc.oneof(
  fc.string({ unit: arbHexDigit, minLength: 8, maxLength: 12 }).map((id) => customerRef(id)),
  fc.constantFrom(...listGlAccounts().map((account) => account.code)).map((code) => glRef(code)),
);

const line = (
  accountRef: AccountRef,
  direction: 'debit' | 'credit',
  minorUnits: number,
  currency: CurrencyCode,
): PostingLine => ({ accountRef, direction, amount: fromMinorUnits(minorUnits, currency) });

/** Lines balanced per currency by construction: every debit amount reappears as a credit. */
const arbBalancedLines: fc.Arbitrary<PostingLine[]> = arbCurrency.chain((currency) =>
  fc
    .array(fc.integer({ min: 1, max: 1_000_000_000 }), { minLength: 1, maxLength: 6 })
    .chain((amounts) =>
      fc
        .tuple(
          fc.array(arbAccountRef, { minLength: amounts.length, maxLength: amounts.length }),
          fc.array(arbAccountRef, { minLength: amounts.length, maxLength: amounts.length }),
        )
        .map(([debitRefs, creditRefs]) => [
          ...amounts.map((n, i) => line(debitRefs[i] as AccountRef, 'debit', n, currency)),
          ...amounts.map((n, i) => line(creditRefs[i] as AccountRef, 'credit', n, currency)),
        ]),
    ),
);

/** An FX-style command: two currencies, each balanced internally, never netted across. */
const arbCrossCurrencyLines: fc.Arbitrary<PostingLine[]> = fc
  .tuple(arbBalancedLines, arbBalancedLines)
  .filter(([left, right]) => left[0]?.amount.currency !== right[0]?.amount.currency)
  .map(([left, right]) => [...left, ...right]);

const balanceKeyOf = (commandLine: PostingLine): string =>
  `${commandLine.accountRef}|${commandLine.amount.currency}`;

/** Balance equality where an untouched account and a zeroed-out one are the same thing. */
function expectSameBalances(actual: Map<string, number>, expected: Map<string, number>): void {
  for (const key of new Set([...actual.keys(), ...expected.keys()])) {
    expect(actual.get(key) ?? 0, key).toBe(expected.get(key) ?? 0);
  }
}

/** Apply lines to a plain balance store, exactly as `applyBalances` computes the delta. */
function applyLines(store: Map<string, number>, lines: readonly PostingLine[]): void {
  for (const commandLine of lines) {
    const normalSide = normalSideForRef(commandLine.accountRef, commandLine.normalSide);
    const delta = signedDelta(commandLine.amount.minorUnits, commandLine.direction, normalSide);
    store.set(balanceKeyOf(commandLine), (store.get(balanceKeyOf(commandLine)) ?? 0) + delta);
  }
}

/** The mirror image `LedgerService.reverse` writes: same legs, direction flipped. */
function mirror(lines: readonly PostingLine[]): PostingLine[] {
  return lines.map((commandLine) => ({
    ...commandLine,
    direction: commandLine.direction === 'debit' ? 'credit' : 'debit',
  }));
}

describe('posting balance invariants', () => {
  it('accepts every balanced command and nets to zero per currency', () => {
    fc.assert(
      fc.property(arbBalancedLines, (lines) => {
        expect(() => assertBalanced(lines)).not.toThrow();
        expect(() => assertPositiveAmounts(lines)).not.toThrow();
        for (const net of netByCurrency(lines).values()) {
          expect(net).toBe(0);
        }
      }),
      RUNS,
    );
  });

  it('accepts cross-currency commands that balance within each currency', () => {
    fc.assert(
      fc.property(arbCrossCurrencyLines, (lines) => {
        expect(() => assertBalanced(lines)).not.toThrow();
      }),
      RUNS,
    );
  });

  it('always rejects an unbalanced command, however small the discrepancy', () => {
    fc.assert(
      fc.property(
        arbBalancedLines,
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.nat(),
        (lines, extra, rawIndex) => {
          const index = rawIndex % lines.length;
          const target = lines[index] as PostingLine;
          const tampered = lines.map((candidate, i) =>
            i === index
              ? line(
                  candidate.accountRef,
                  candidate.direction,
                  candidate.amount.minorUnits + extra,
                  candidate.amount.currency,
                )
              : candidate,
          );
          expect(target).toBeDefined();
          expect(() => assertBalanced(tampered)).toThrow(LedgerUnbalancedError);
        },
      ),
      RUNS,
    );
  });

  it('rejects a one-legged transaction and any non-positive amount', () => {
    fc.assert(
      fc.property(
        arbAccountRef,
        arbCurrency,
        fc.integer({ min: 1, max: 1_000_000 }),
        (accountRef, currency, minorUnits) => {
          expect(() => assertBalanced([line(accountRef, 'debit', minorUnits, currency)])).toThrow(
            LedgerUnbalancedError,
          );
        },
      ),
      RUNS,
    );

    fc.assert(
      fc.property(
        arbBalancedLines,
        fc.integer({ min: -1_000_000, max: 0 }),
        fc.nat(),
        (lines, badAmount, rawIndex) => {
          const index = rawIndex % lines.length;
          const tampered = lines.map((candidate, i): PostingLine =>
            i === index
              ? {
                  accountRef: candidate.accountRef,
                  direction: candidate.direction,
                  amount: fromMinorUnits(badAmount, candidate.amount.currency),
                }
              : candidate,
          );
          expect(() => assertPositiveAmounts(tampered)).toThrow(LedgerUnbalancedError);
        },
      ),
      RUNS,
    );
  });

  it('keeps every command netted to zero across a long random posting sequence', () => {
    fc.assert(
      fc.property(fc.array(arbBalancedLines, { minLength: 1, maxLength: 25 }), (commands) => {
        const store = new Map<string, number>();
        for (const command of commands) {
          applyLines(store, command);
          // The whole-ledger invariant is per transaction: its signed entry deltas cancel out.
          for (const [, net] of netByCurrency(command)) {
            expect(net).toBe(0);
          }
        }
        expect(store.size).toBeGreaterThan(0);
      }),
      { numRuns: 2_000 },
    );
  });

  it('a reversal restores every touched account to its pre-transaction balance', () => {
    fc.assert(
      fc.property(
        fc.array(arbBalancedLines, { minLength: 1, maxLength: 20 }),
        fc.nat(),
        (commands, rawIndex) => {
          const index = rawIndex % commands.length;
          const store = new Map<string, number>();

          for (const command of commands.slice(0, index)) {
            applyLines(store, command);
          }
          const before = new Map(store);

          const reversed = commands[index] as PostingLine[];
          applyLines(store, reversed);
          applyLines(store, mirror(reversed));

          expectSameBalances(store, before);
        },
      ),
      { numRuns: 2_000 },
    );
  });

  it('reversing everything returns every account to zero', () => {
    fc.assert(
      fc.property(fc.array(arbBalancedLines, { minLength: 1, maxLength: 20 }), (commands) => {
        const store = new Map<string, number>();
        for (const command of commands) {
          applyLines(store, command);
        }
        for (const command of [...commands].reverse()) {
          applyLines(store, mirror(command));
        }
        for (const balance of store.values()) {
          expect(balance).toBe(0);
        }
      }),
      { numRuns: 2_000 },
    );
  });
});
