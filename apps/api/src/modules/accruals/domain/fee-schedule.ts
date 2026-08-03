import { getScale, roundMinorUnits, type CurrencyCode } from '@icb/money';

import {
  DAYS_IN_YEAR_ACT_360,
  FX_FEE_PERCENT,
  LATE_FEE_MAJOR_UNITS,
  OVERDRAFT_ANNUAL_RATE,
  TRANSACTION_FEE_MAJOR_UNITS,
  TRANSACTION_FREE_ALLOWANCE,
} from '../accruals.constants.js';

/**
 * Fee computations — the arithmetic half of the fee schedule.
 *
 * Each function prices one fee type and nothing else: given the measured activity (a debit
 * count, an overdrawn balance, an FX volume), how many minor units is that worth? When the
 * charge lands, which account it debits and which GL it credits, is the caller's decision.
 *
 * Flat amounts are declared in major units (the way a tariff sheet is printed) and converted
 * per currency, so a zero-decimal currency needs no second table.
 */

function majorToMinor(majorUnits: number, currency: CurrencyCode): number {
  return roundMinorUnits(majorUnits * 10 ** getScale(currency), 'half-even');
}

/**
 * Per-item fee for customer debits beyond the free allowance. `debitCount` is the full cycle
 * count, not the excess — the allowance is applied here so no caller can forget it.
 */
export function transactionFeeMinorUnits(debitCount: number, currency: CurrencyCode): number {
  const excess = Math.max(0, debitCount - TRANSACTION_FREE_ALLOWANCE);
  // Multiply first, round once: two half-unit fees are one whole unit, not zero.
  return majorToMinor(excess * TRANSACTION_FEE_MAJOR_UNITS, currency);
}

/**
 * One day of overdraft interest on an arranged facility, ACT/360 — the money-market
 * convention short-dated borrowing is quoted on. `overdrawnMinorUnits` is positive.
 */
export function overdraftFeeMinorUnits(
  overdrawnMinorUnits: number,
  days: number,
  annualRate: number = OVERDRAFT_ANNUAL_RATE,
): number {
  if (overdrawnMinorUnits <= 0 || days <= 0) {
    return 0;
  }
  return roundMinorUnits(
    (overdrawnMinorUnits * annualRate * days) / DAYS_IN_YEAR_ACT_360,
    'half-even',
  );
}

/** FX service fee: a percentage of the period's conversion volume, rounded half-even. */
export function fxFeeMinorUnits(fxVolumeMinorUnits: number, percent: number = FX_FEE_PERCENT): number {
  if (fxVolumeMinorUnits <= 0) {
    return 0;
  }
  return roundMinorUnits((fxVolumeMinorUnits * percent) / 100, 'half-even');
}

/** Flat late fee per overdue instalment. */
export function lateFeeMinorUnits(overdueInstalments: number, currency: CurrencyCode): number {
  if (overdueInstalments <= 0) {
    return 0;
  }
  return majorToMinor(overdueInstalments * LATE_FEE_MAJOR_UNITS, currency);
}
