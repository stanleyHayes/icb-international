import { DomainError } from '../../../common/errors/index.js';
import type { NormalSide } from '../../ledger/domain/chart-of-accounts.js';

/** Aggregated ledger entries over a window, as three independently summed columns. */
export interface EntryTotals {
  creditMinorUnits: number;
  debitMinorUnits: number;
  /** The effect the ledger recorded against the account when each entry was written. */
  signedMinorUnits: number;
  count: number;
}

export const EMPTY_TOTALS: EntryTotals = {
  creditMinorUnits: 0,
  debitMinorUnits: 0,
  signedMinorUnits: 0,
  count: 0,
};

export interface StatementFigures {
  openingMinorUnits: number;
  closingMinorUnits: number;
  totalCreditsMinorUnits: number;
  totalDebitsMinorUnits: number;
  transactionCount: number;
}

/** Identifies the statement in the error raised when the figures refuse to reconcile. */
export interface StatementScope {
  accountId: string;
  from: string;
  to: string;
  currency: string;
}

/**
 * The account holder's view of a signed ledger effect.
 *
 * A customer account is a liability of the bank, so it increases on the credit side and the
 * ledger's signed delta already reads the way a customer expects. A debit-normal account (a
 * loan) records the mirror image, so it is flipped: a statement always shows credits adding
 * and debits subtracting, whatever the account's normal side is internally.
 */
function holderView(signedMinorUnits: number, normalSide: NormalSide): number {
  return normalSide === 'credit' ? signedMinorUnits : -signedMinorUnits;
}

/**
 * Builds the statement's five headline figures from two windows of ledger entries.
 *
 * The opening balance is summed from the raw posting directions of everything before the
 * period; the closing balance is summed from the signed effects the ledger itself recorded
 * across everything up to the period end. Those are two independent paths through the same
 * data, so requiring them to agree is a real check rather than a restatement — if a direction
 * and its signed delta ever drifted apart, the statement would be arithmetically wrong and is
 * refused instead of issued.
 */
export function buildStatementFigures(
  before: EntryTotals,
  period: EntryTotals,
  normalSide: NormalSide,
  scope: StatementScope,
): StatementFigures {
  const openingMinorUnits = before.creditMinorUnits - before.debitMinorUnits;
  const closingMinorUnits = holderView(
    before.signedMinorUnits + period.signedMinorUnits,
    normalSide,
  );

  assertReconciles(openingMinorUnits, period, closingMinorUnits, scope);

  return {
    openingMinorUnits,
    closingMinorUnits,
    totalCreditsMinorUnits: period.creditMinorUnits,
    totalDebitsMinorUnits: period.debitMinorUnits,
    transactionCount: period.count,
  };
}

/** Opening + credits − debits must equal closing, to the minor unit. No tolerance. */
function assertReconciles(
  opening: number,
  period: EntryTotals,
  closing: number,
  scope: StatementScope,
): void {
  const difference = opening + period.creditMinorUnits - period.debitMinorUnits - closing;
  if (difference === 0) {
    return;
  }

  throw new DomainError(
    'LEDGER_UNBALANCED',
    'Refusing to issue a statement whose opening, turnover and closing balances do not reconcile',
    {
      context: {
        ...scope,
        openingMinorUnits: opening,
        totalCreditsMinorUnits: period.creditMinorUnits,
        totalDebitsMinorUnits: period.debitMinorUnits,
        closingMinorUnits: closing,
        differenceMinorUnits: difference,
      },
    },
  );
}
