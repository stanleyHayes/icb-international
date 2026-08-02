import type {
  AccountBalances,
  AccountDetail,
  AccountIdentifiers,
  AccountKind,
  AccountStatus,
  AccountSummary,
  MoneyDto,
} from '@icb/contracts';
import { getScale, type CurrencyCode } from '@icb/money';

import type { AccountBalanceRow } from '../accounts.service.js';
import type { AccountDoc } from './account.schemas.js';

/**
 * Persistence → contract.
 *
 * Mapping lives in its own file so the service never has to think about wire shapes and the
 * controller never has to think about documents. It is also the boundary where internal fields
 * are dropped rather than accidentally serialised.
 */

export function toMoneyDto(minorUnits: number, currency: string): MoneyDto {
  return {
    minorUnits,
    currency: currency as MoneyDto['currency'],
    scale: getScale(currency as CurrencyCode),
  };
}

function toBalances(row: AccountBalanceRow): AccountBalances {
  const available = row.ledgerMinorUnits - row.holdMinorUnits + row.overdraftMinorUnits;
  return {
    ledger: toMoneyDto(row.ledgerMinorUnits, row.currency),
    holds: toMoneyDto(row.holdMinorUnits, row.currency),
    available: toMoneyDto(available, row.currency),
    overdraftLimit: toMoneyDto(row.overdraftMinorUnits, row.currency),
    asOf: row.asOf.toISOString(),
  };
}

function toIdentifiers(account: AccountDoc): AccountIdentifiers {
  return {
    number: account.number,
    iban: account.iban,
    bic: account.bic,
    sortCode: account.sortCode,
  };
}

export function toAccountSummary(account: AccountDoc, balance: AccountBalanceRow): AccountSummary {
  return {
    id: account._id,
    kind: account.kind as AccountKind,
    productCode: account.productCode,
    productName: account.productName,
    nickname: account.nickname,
    currency: account.currency as CurrencyCode,
    status: account.status as AccountStatus,
    balances: toBalances({ ...balance, currency: account.currency }),
    identifiers: toIdentifiers(account),
    primary: account.primary,
    openedAt: account.openedAt.toISOString(),
  };
}

export function toAccountDetail(account: AccountDoc, balance: AccountBalanceRow): AccountDetail {
  return {
    ...toAccountSummary(account, balance),
    customerId: account.customerId,
    interestRate: account.interestRate,
    minimumBalance:
      account.minimumBalanceMinorUnits === null
        ? null
        : toMoneyDto(account.minimumBalanceMinorUnits, account.currency),
    monthlyFee:
      account.monthlyFeeMinorUnits === null
        ? null
        : toMoneyDto(account.monthlyFeeMinorUnits, account.currency),
    closedAt: account.closedAt?.toISOString() ?? null,
    closureReason: account.closureReason,
    statementDay: account.statementDay,
    lastStatementAt: account.lastStatementAt?.toISOString() ?? null,
  };
}
