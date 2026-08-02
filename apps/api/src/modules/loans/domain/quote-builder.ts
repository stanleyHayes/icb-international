import type {
  LoanProduct,
  LoanQuote,
  RepaymentFrequency,
  RepaymentInstalment,
} from '@icb/contracts';
import { add, percentage, subtract, type CurrencyCode, type Money } from '@icb/money';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import { buildSchedule, type AmortisationRow } from './amortisation.js';
import { representativeApr } from './apr.js';
import { dueDateSequence, toIsoDate } from './schedule-dates.js';

/**
 * Assembling a quote.
 *
 * Everything the customer is shown — the instalment, the APR, the full schedule — is derived here
 * from the same amortisation the loan will actually be serviced on. There is no second, prettier
 * calculation for the sales journey.
 */

export interface DatedInstalment extends AmortisationRow {
  readonly dueOn: string;
}

export interface DatedSchedule {
  readonly rows: readonly DatedInstalment[];
  readonly instalment: Money;
  readonly totalInterest: Money;
  readonly totalRepayable: Money;
  readonly firstPaymentOn: string;
  readonly maturesOn: string;
}

export interface ScheduleRequest {
  readonly principal: Money;
  readonly annualRatePercent: number;
  readonly termMonths: number;
  readonly frequency: RepaymentFrequency;
  /** The instant the schedule runs from — drawdown, or "today" for an indicative quote. */
  readonly anchor: Date;
}

/** The amortisation with a calendar attached. The first instalment falls one period after draw. */
export function buildDatedSchedule(request: ScheduleRequest): DatedSchedule {
  const schedule = buildSchedule(request);
  const dueDates = dueDateSequence(request.anchor, schedule.rows.length, request.frequency);

  const rows: DatedInstalment[] = [];
  for (const [index, row] of schedule.rows.entries()) {
    const dueOn = dueDates[index];
    if (dueOn !== undefined) {
      rows.push({ ...row, dueOn });
    }
  }

  const anchorDate = toIsoDate(request.anchor);
  return {
    rows,
    instalment: schedule.instalment,
    totalInterest: schedule.totalInterest,
    totalRepayable: schedule.totalRepayable,
    firstPaymentOn: rows[0]?.dueOn ?? anchorDate,
    maturesOn: rows.at(-1)?.dueOn ?? anchorDate,
  };
}

/** A schedule row as first published: nothing paid, nothing due yet. */
export function toScheduledInstalment(
  row: DatedInstalment,
  currency: CurrencyCode,
): RepaymentInstalment {
  return {
    number: row.number,
    dueOn: row.dueOn,
    instalment: toMoneyDto(row.instalment.minorUnits, currency),
    principal: toMoneyDto(row.principal.minorUnits, currency),
    interest: toMoneyDto(row.interest.minorUnits, currency),
    fees: toMoneyDto(0, currency),
    openingBalance: toMoneyDto(row.openingBalance.minorUnits, currency),
    closingBalance: toMoneyDto(row.closingBalance.minorUnits, currency),
    status: 'scheduled',
    paidAt: null,
    paidAmount: null,
  };
}

export interface QuoteRequest extends ScheduleRequest {
  readonly product: LoanProduct;
  /** False only once underwriting has actually run and the figures are contractual. */
  readonly indicative: boolean;
}

export function buildQuote(request: QuoteRequest): LoanQuote {
  const currency = request.principal.currency;
  const schedule = buildDatedSchedule(request);
  const arrangementFee = percentage(request.principal, request.product.arrangementFeePercent);

  return {
    productCode: request.product.code,
    amount: toMoneyDto(request.principal.minorUnits, currency),
    termMonths: request.termMonths,
    frequency: request.frequency,
    nominalRate: request.annualRatePercent,
    representativeApr: representativeApr({
      // The fee is taken from the advance, so the customer finances less than they repay on.
      netAdvance: subtract(request.principal, arrangementFee),
      instalments: schedule.rows.map((row) => row.instalment),
      frequency: request.frequency,
    }),
    instalment: toMoneyDto(schedule.instalment.minorUnits, currency),
    arrangementFee: toMoneyDto(arrangementFee.minorUnits, currency),
    totalInterest: toMoneyDto(schedule.totalInterest.minorUnits, currency),
    totalRepayable: toMoneyDto(
      add(schedule.totalRepayable, arrangementFee).minorUnits,
      currency,
    ),
    firstPaymentOn: schedule.firstPaymentOn,
    schedule: schedule.rows.map((row) => toScheduledInstalment(row, currency)),
    indicative: request.indicative,
  };
}
