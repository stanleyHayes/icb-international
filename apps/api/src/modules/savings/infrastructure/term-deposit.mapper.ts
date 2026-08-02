import type { BreakDepositQuote, TermDeposit } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import {
  accruedInterestOn,
  maturityValueMinorUnits,
  projectedInterestMinorUnits,
  type DepositTerms,
} from '../domain/interest.js';
import type { BreakQuoteRecord, TermDepositDoc } from './term-deposit.schemas.js';

/**
 * Persistence → contract.
 *
 * `accruedInterest` is recomputed on every read rather than served from the stored figure. The
 * stored figure is what has been *posted*; the customer is entitled to see what has been
 * *earned*, which is a day or so ahead of it between accrual runs.
 */

/** The economics of the deposit, in the shape the pure interest maths expects. */
export function toDepositTerms(deposit: TermDepositDoc): DepositTerms {
  return {
    principalMinorUnits: deposit.principalMinorUnits,
    rate: deposit.rate,
    openedOn: deposit.openedOn,
    maturesOn: deposit.maturesOn,
  };
}

export function toTermDeposit(deposit: TermDepositDoc, today: string): TermDeposit {
  const terms = toDepositTerms(deposit);

  return {
    id: deposit._id,
    accountId: deposit.accountId,
    reference: deposit.reference,
    principal: toMoneyDto(deposit.principalMinorUnits, deposit.currency),
    currency: deposit.currency as CurrencyCode,
    rate: deposit.rate,
    termMonths: deposit.termMonths,
    accruedInterest: toMoneyDto(accruedInterestOn(terms, today), deposit.currency),
    projectedInterest: toMoneyDto(projectedInterestMinorUnits(terms), deposit.currency),
    maturityValue: toMoneyDto(maturityValueMinorUnits(terms), deposit.currency),
    openedOn: deposit.openedOn,
    maturesOn: deposit.maturesOn,
    maturityInstruction: deposit.maturityInstruction as TermDeposit['maturityInstruction'],
    rolloverAccountId: deposit.rolloverAccountId,
    status: deposit.status as TermDeposit['status'],
    brokenAt: deposit.brokenAt?.toISOString() ?? null,
  };
}

export function toBreakQuote(
  deposit: TermDepositDoc,
  quote: BreakQuoteRecord,
): BreakDepositQuote {
  return {
    depositId: deposit._id,
    principal: toMoneyDto(deposit.principalMinorUnits, deposit.currency),
    accruedInterest: toMoneyDto(quote.accruedInterestMinorUnits, deposit.currency),
    penalty: toMoneyDto(quote.penaltyMinorUnits, deposit.currency),
    netProceeds: toMoneyDto(quote.netProceedsMinorUnits, deposit.currency),
    interestForfeited: toMoneyDto(quote.interestForfeitedMinorUnits, deposit.currency),
    validUntil: quote.expiresAt.toISOString(),
  };
}
