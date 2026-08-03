import type { TransferRail } from '@icb/contracts';
import { fromMinorUnits, getMinorUnitFactor, type CurrencyCode, type Money } from '@icb/money';

import { LimitExceededError } from '../../../common/errors/index.js';
import {
  DAILY_DEBIT_CAP_MAJOR_UNITS,
  RAIL_PER_TRANSACTION_CAP,
} from './transfers.constants.js';

function capMoney(majorUnits: number, currency: CurrencyCode): Money {
  return fromMinorUnits(majorUnits * getMinorUnitFactor(currency), currency);
}

/**
 * Transfer limits.
 *
 * Two caps guard every send: what a single instruction may move, and what one customer may push
 * through a rail in a business day. They are evaluated before the fraud score so that a
 * over-limit payment never burns a risk assessment, and the error names the limit so the client
 * can say which one bit.
 */
export function assertPerTransactionLimit(
  rail: TransferRail,
  amount: Money,
): void {
  const cap = capMoney(RAIL_PER_TRANSACTION_CAP[rail], amount.currency);
  if (amount.minorUnits > cap.minorUnits) {
    throw new LimitExceededError('per-transaction transfer limit', cap, amount);
  }
}

/**
 * The daily cap check. `spentTodayMinorUnits` is the customer's debit total on this rail since
 * the start of the current business date, supplied by the caller (the only place that can query
 * it). The cap applies to the running total, not to this transfer alone.
 */
export function assertDailyLimit(
  rail: TransferRail,
  amount: Money,
  spentTodayMinorUnits: number,
): void {
  const cap = capMoney(DAILY_DEBIT_CAP_MAJOR_UNITS[rail], amount.currency);
  const attempted = fromMinorUnits(spentTodayMinorUnits + amount.minorUnits, amount.currency);
  if (attempted.minorUnits > cap.minorUnits) {
    throw new LimitExceededError('daily transfer limit', cap, attempted);
  }
}
