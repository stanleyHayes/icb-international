import type { AccountBalances, AccountDetail, AccountIdentifiers, AccountSummary } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

import type { FactoryContext } from '../core/context.js';
import { accountNumber, iban, moneyDto, sortCode, zeroMoney } from './helpers.js';

const ICB_BIC = 'ICBKGHAC';
const DEFAULT_LEDGER_MINOR_UNITS = 250_000;
const SAVINGS_RATE_PERCENT = 4.5;
const STATEMENT_DAY = 1;

export interface AccountOptions extends Partial<AccountDetail> {
  /** Opening ledger balance in minor units. Defaults to a non-zero balance. */
  readonly ledgerMinorUnits?: number;
  readonly currency?: CurrencyCode;
}

/**
 * Account factory.
 *
 * Default: an active current account in GHS with a real (ledger-derived) balance — holds zero,
 * available equals ledger, matching what the API would return after a single deposit posted.
 */
export function accountDetail(ctx: FactoryContext, options: AccountOptions = {}): AccountDetail {
  const { ledgerMinorUnits = DEFAULT_LEDGER_MINOR_UNITS, currency = 'GHS', ...overrides } = options;
  const base: AccountDetail = {
    ...accountSummary(ctx, { currency, ledgerMinorUnits }),
    customerId: ctx.nextId(),
    interestRate: null,
    minimumBalance: null,
    monthlyFee: null,
    closedAt: null,
    closureReason: null,
    statementDay: STATEMENT_DAY,
    lastStatementAt: null,
  };
  return { ...base, ...overrides };
}

export function accountSummary(
  ctx: FactoryContext,
  options: AccountOptions = {},
): AccountSummary {
  const { ledgerMinorUnits = DEFAULT_LEDGER_MINOR_UNITS, currency = 'GHS', ...overrides } = options;
  const base: AccountSummary = {
    id: ctx.nextId(),
    kind: 'current',
    productCode: 'CUR-STD',
    productName: 'Everyday Current Account',
    nickname: null,
    currency,
    status: 'active',
    balances: balances(ctx, currency, ledgerMinorUnits),
    identifiers: accountIdentifiers(ctx),
    primary: true,
    openedAt: ctx.clock.iso(),
  };
  return { ...base, ...overrides };
}

/** Balances consistent with each other: available = ledger − holds + overdraft. */
export function balances(
  ctx: FactoryContext,
  currency: CurrencyCode,
  ledgerMinorUnits: number,
): AccountBalances {
  return {
    ledger: moneyDto(ledgerMinorUnits, currency),
    holds: zeroMoney(currency),
    available: moneyDto(ledgerMinorUnits, currency),
    overdraftLimit: zeroMoney(currency),
    asOf: ctx.clock.iso(),
  };
}

export function accountIdentifiers(ctx: FactoryContext): AccountIdentifiers {
  return {
    number: accountNumber(ctx),
    iban: iban(ctx),
    bic: ICB_BIC,
    sortCode: sortCode(ctx),
  };
}

/** A savings account variant — interest-bearing, not primary. */
export function savingsAccount(ctx: FactoryContext, options: AccountOptions = {}): AccountDetail {
  return accountDetail(ctx, {
    kind: 'savings',
    productCode: 'SAV-STD',
    productName: 'Instant Access Savings',
    primary: false,
    interestRate: SAVINGS_RATE_PERCENT,
    ...options,
  });
}
