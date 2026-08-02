import type { Dispute, DisputeOutcome, DisputeReason, DisputeStage } from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import type { DisputeDoc, ProvisionalCreditSub } from './dispute.schemas.js';

/**
 * Persistence → contract.
 *
 * The stored provisional credit carries its clawback transaction id, which the contract does not
 * expose: the customer sees the reversal on their statement like any other posting, and does not
 * need a second representation of it inside the dispute.
 */

type Uploader = Dispute['evidence'][number]['uploadedBy'];

function toProvisionalCredit(
  credit: ProvisionalCreditSub | null,
): Dispute['provisionalCredit'] {
  if (!credit) {
    return null;
  }
  return {
    amount: toMoneyDto(credit.minorUnits, credit.currency),
    transactionId: credit.transactionId,
    grantedAt: credit.grantedAt.toISOString(),
    clawedBackAt: credit.clawedBackAt?.toISOString() ?? null,
  };
}

export function toDispute(dispute: DisputeDoc): Dispute {
  return {
    id: dispute._id,
    reference: dispute.reference,
    transactionId: dispute.transactionId,
    customerId: dispute.customerId,
    customerName: dispute.customerName,
    amount: toMoneyDto(dispute.amountMinorUnits, dispute.currency),
    reason: dispute.reason as DisputeReason,
    detail: dispute.detail,
    stage: dispute.stage as DisputeStage,
    outcome: (dispute.outcome as DisputeOutcome | null) ?? null,
    evidence: dispute.evidence.map((item) => ({
      id: item.id,
      label: item.label,
      asset: item.asset,
      uploadedBy: item.uploadedBy as Uploader,
      uploadedAt: item.uploadedAt.toISOString(),
    })),
    provisionalCredit: toProvisionalCredit(dispute.provisionalCredit),
    timeline: dispute.timeline.map((entry) => ({
      at: entry.at.toISOString(),
      stage: entry.stage as DisputeStage,
      note: entry.note,
    })),
    slaDueAt: dispute.slaDueAt.toISOString(),
    resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
    createdAt: dispute.createdAt.toISOString(),
  };
}
