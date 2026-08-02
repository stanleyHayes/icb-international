import type { LoanApplication, LoanStatus, RepaymentFrequency } from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import type { LoanApplicationDoc, StoredOffer } from './loan-application.schemas.js';

/** Persistence → contract for applications. The decision is already in contract shape. */

function toOffer(offer: StoredOffer | null, currency: string): LoanApplication['offer'] {
  if (!offer) {
    return null;
  }
  return {
    amount: toMoneyDto(offer.amountMinorUnits, currency),
    rate: offer.rate,
    instalment: toMoneyDto(offer.instalmentMinorUnits, currency),
    expiresAt: offer.expiresAt.toISOString(),
    acceptedAt: offer.acceptedAt?.toISOString() ?? null,
  };
}

export function toLoanApplication(application: LoanApplicationDoc): LoanApplication {
  return {
    id: application._id,
    reference: application.reference,
    customerId: application.customerId,
    productCode: application.productCode,
    productName: application.productName,
    status: application.status as LoanStatus,
    requestedAmount: toMoneyDto(application.requestedMinorUnits, application.currency),
    termMonths: application.termMonths,
    frequency: application.frequency as RepaymentFrequency,
    purpose: application.purpose,
    documents: application.documents,
    decision: application.decision,
    offer: toOffer(application.offer, application.currency),
    submittedAt: application.submittedAt?.toISOString() ?? null,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}
