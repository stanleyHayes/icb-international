import type {
  AssetRef,
  KycCase,
  KycCheck,
  KycDocument,
  KycDocumentType,
  KycLevel,
  KycStatus,
  RiskRating,
} from '@icb/contracts';

import type {
  KycCaseDoc,
  KycCheckSub,
  KycDecisionSub,
  KycDocumentSub,
} from './kyc.schemas.js';

/**
 * Persistence → contract.
 *
 * The case document carries operational fields the customer has no business seeing — who the
 * case is assigned to, when it was submitted — and this is the boundary where they are dropped
 * rather than accidentally serialised.
 */

function toKycDocument(sub: KycDocumentSub): KycDocument {
  return {
    id: sub.id,
    type: sub.type as KycDocumentType,
    asset: sub.asset as unknown as AssetRef,
    status: sub.status as KycDocument['status'],
    rejectionReason: sub.rejectionReason,
    documentNumber: sub.documentNumber,
    issuingCountry: sub.issuingCountry,
    expiresOn: sub.expiresOn,
    uploadedAt: sub.uploadedAt.toISOString(),
    reviewedAt: sub.reviewedAt?.toISOString() ?? null,
  };
}

function toKycCheck(sub: KycCheckSub): KycCheck {
  return {
    kind: sub.kind as KycCheck['kind'],
    outcome: sub.outcome as KycCheck['outcome'],
    score: sub.score,
    detail: sub.detail,
    completedAt: sub.completedAt?.toISOString() ?? null,
  };
}

function toDecision(sub: KycDecisionSub): NonNullable<KycCase['decision']> {
  return {
    outcome: sub.outcome as NonNullable<KycCase['decision']>['outcome'],
    grantedLevel: sub.grantedLevel as KycLevel | null,
    reason: sub.reason,
    decidedBy: sub.decidedBy,
    decidedAt: sub.decidedAt.toISOString(),
  };
}

export function toKycCase(row: KycCaseDoc): KycCase {
  return {
    id: row._id,
    customerId: row.customerId,
    customerName: row.customerName,
    requestedLevel: row.requestedLevel as KycLevel,
    status: row.status as KycStatus,
    documents: row.documents.map(toKycDocument),
    checks: row.checks.map(toKycCheck),
    riskRating: row.riskRating as RiskRating | null,
    decision: row.decision === null ? null : toDecision(row.decision),
    slaDueAt: row.slaDueAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Contract → persistence, for the check results produced at submission. */
export function toCheckSub(check: KycCheck): KycCheckSub {
  return {
    kind: check.kind,
    outcome: check.outcome,
    score: check.score,
    detail: check.detail,
    completedAt: check.completedAt === null ? null : new Date(check.completedAt),
  };
}
