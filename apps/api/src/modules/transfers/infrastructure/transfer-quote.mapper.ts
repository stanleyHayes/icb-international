import type { TransferQuote, TransferRail } from '@icb/contracts';
import { fromMinorUnits, getMinorUnitFactor, type CurrencyCode, type Money } from '@icb/money';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import type { SignedTransferQuoteTerms } from '../domain/quote-signature.js';
import type { FeeLine } from '../domain/transfer-fees.js';
import type { TransferQuoteDoc } from './transfer-quote.schemas.js';

/** What redeeming a quote hands to the pipeline — the exact terms the customer confirmed. */
export interface RedeemedTransferQuote {
  readonly quoteId: string;
  readonly rail: TransferRail;
  readonly debit: Money;
  readonly credit: Money;
  readonly fees: readonly FeeLine[];
  readonly fx: { rate: number; spreadBps: number; roundingDelta: number } | null;
  readonly estimatedArrival: Date;
}

/** Persistence → wire, for a freshly issued quote. */
export function toQuoteContract(
  doc: TransferQuoteDoc,
  thresholds: { approvalMinorUnits: number },
): TransferQuote {
  const totalDebitMinorUnits = doc.feeMinorUnits + doc.debit.minorUnits;
  return {
    quoteId: doc._id,
    rail: doc.rail as TransferRail,
    debitAmount: toMoneyDto(doc.debit.minorUnits, doc.debit.currency),
    creditAmount: toMoneyDto(doc.credit.minorUnits, doc.credit.currency),
    fees: doc.feeBreakdown.map((fee) => ({
      code: fee.code,
      label: fee.label,
      amount: toMoneyDto(fee.minorUnits, doc.debit.currency),
    })),
    totalFees: toMoneyDto(doc.feeMinorUnits, doc.debit.currency),
    totalDebit: toMoneyDto(totalDebitMinorUnits, doc.debit.currency),
    fx: fxDetail(doc),
    estimatedArrival: doc.estimatedArrival.toISOString(),
    cutOffAt: doc.cutOffAt?.toISOString() ?? null,
    requiresApproval: totalDebitMinorUnits >= thresholds.approvalMinorUnits,
    expiresAt: doc.expiresAt.toISOString(),
  };
}

/** Persistence → pipeline terms, for a redeemed quote. */
export function toRedeemedQuote(doc: TransferQuoteDoc): RedeemedTransferQuote {
  return {
    quoteId: doc._id,
    rail: doc.rail as TransferRail,
    debit: fromMinorUnits(doc.debit.minorUnits, doc.debit.currency as CurrencyCode),
    credit: fromMinorUnits(doc.credit.minorUnits, doc.credit.currency as CurrencyCode),
    fees: doc.feeBreakdown.map((fee) => ({
      code: fee.code,
      label: fee.label,
      amount: fromMinorUnits(fee.minorUnits, doc.debit.currency as CurrencyCode),
    })),
    fx: doc.fxRate === null ? null : {
      rate: doc.fxRate,
      spreadBps: doc.fxSpreadBps ?? 0,
      roundingDelta: doc.fxRoundingDelta,
    },
    estimatedArrival: doc.estimatedArrival,
  };
}

function fxDetail(doc: TransferQuoteDoc): TransferQuote['fx'] {
  if (doc.fxRate === null) {
    return null;
  }
  return {
    fromAmount: toMoneyDto(doc.debit.minorUnits, doc.debit.currency),
    toAmount: toMoneyDto(doc.credit.minorUnits, doc.credit.currency),
    rate: doc.fxRate,
    spreadBps: doc.fxSpreadBps ?? 0,
  };
}

/** A major-unit threshold expressed in the currency's minor units. */
export function thresholdMinorUnits(majorUnits: number, currency: CurrencyCode): number {
  return majorUnits * getMinorUnitFactor(currency);
}

/** The exact terms the signature covers, rebuilt from a stored document for re-verification. */
export function toSignedQuoteTerms(doc: TransferQuoteDoc): SignedTransferQuoteTerms {
  return {
    quoteId: doc._id,
    customerId: doc.customerId,
    fromAccountId: doc.fromAccountId,
    rail: doc.rail,
    destinationKey: doc.destinationKey,
    debitMinorUnits: doc.debit.minorUnits,
    debitCurrency: doc.debit.currency,
    creditMinorUnits: doc.credit.minorUnits,
    creditCurrency: doc.credit.currency,
    feeMinorUnits: doc.feeMinorUnits,
    fxRate: doc.fxRate,
    expiresAtMs: doc.expiresAt.getTime(),
  };
}
