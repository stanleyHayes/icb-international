import type { Loan, RepaymentInstalment } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

import type { FactoryContext } from '../core/context.js';
import { moneyDto, zeroMoney } from './helpers.js';

const DEFAULT_PRINCIPAL_MINOR_UNITS = 500_000;
const DEFAULT_TERM_MONTHS = 24;
const DEFAULT_RATE_PERCENT = 12.5;
const INSTALMENT_MINOR_UNITS = 23_500;
const MATURITY_YEARS = 2;

export interface LoanOptions extends Partial<Loan> {
  readonly currency?: CurrencyCode;
}

/**
 * Loan factory.
 *
 * Default: an active, fully performing loan — disbursed at the clock's instant, no arrears,
 * principal still outstanding. `loanSchema` (not `loanDetailSchema`): the schedule is separate
 * so a summary-list test does not pay for 24 instalment rows.
 */
export function loan(ctx: FactoryContext, options: LoanOptions = {}): Loan {
  const { currency = 'GHS', ...overrides } = options;
  const principal = moneyDto(DEFAULT_PRINCIPAL_MINOR_UNITS, currency);
  const base: Loan = {
    id: ctx.nextId(),
    reference: ctx.reference('LON'),
    accountId: ctx.nextId(),
    customerId: ctx.nextId(),
    productCode: 'PL-STD',
    productName: 'Personal Loan',
    status: 'active',
    principal,
    outstandingPrincipal: principal,
    outstandingInterest: zeroMoney(currency),
    totalOutstanding: principal,
    rate: DEFAULT_RATE_PERCENT,
    termMonths: DEFAULT_TERM_MONTHS,
    frequency: 'monthly',
    instalment: moneyDto(INSTALMENT_MINOR_UNITS, currency),
    nextPaymentOn: ctx.clock.datePlusDays(30),
    nextPaymentAmount: moneyDto(INSTALMENT_MINOR_UNITS, currency),
    paidInstalments: 0,
    remainingInstalments: DEFAULT_TERM_MONTHS,
    arrears: null,
    disbursedAt: ctx.clock.iso(),
    maturesOn: ctx.clock.datePlusDays(MATURITY_YEARS * 365),
    settledAt: null,
  };
  return { ...base, ...overrides };
}

/** One scheduled instalment row; interest + principal re-sum to the instalment amount. */
export function repaymentInstalment(
  ctx: FactoryContext,
  currency: CurrencyCode = 'GHS',
  overrides: Partial<RepaymentInstalment> = {},
): RepaymentInstalment {
  const interest = moneyDto(5_000, currency);
  const principal = moneyDto(INSTALMENT_MINOR_UNITS - 5_000, currency);
  const base: RepaymentInstalment = {
    number: 1,
    dueOn: ctx.clock.datePlusDays(30),
    instalment: moneyDto(INSTALMENT_MINOR_UNITS, currency),
    principal,
    interest,
    fees: zeroMoney(currency),
    openingBalance: moneyDto(DEFAULT_PRINCIPAL_MINOR_UNITS, currency),
    closingBalance: moneyDto(DEFAULT_PRINCIPAL_MINOR_UNITS - principal.minorUnits, currency),
    status: 'scheduled',
    paidAt: null,
    paidAmount: null,
  };
  return { ...base, ...overrides };
}
