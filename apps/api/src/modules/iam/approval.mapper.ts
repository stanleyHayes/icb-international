import type { ApprovalRequest } from '@icb/contracts';

import type { ApprovalRequestDoc } from './infrastructure/iam.schemas.js';

type ApprovalKind = ApprovalRequest['kind'];
type ApprovalStatus = ApprovalRequest['status'];

/**
 * Document → wire DTO.
 *
 * The contract has no dedicated `subjectRef` field, so the pointer travels inside `payload`
 * under a reserved key — one wire shape for every kind of approval, with the subject always
 * identifiable by the client.
 */
export function toApprovalRequest(doc: ApprovalRequestDoc): ApprovalRequest {
  return {
    id: doc._id,
    kind: doc.kind as ApprovalKind,
    summary: doc.summary,
    payload: { ...doc.payload, subjectRef: doc.subjectRef },
    amount: doc.amount,
    requestedBy: doc.requestedBy,
    requestedAt: doc.requestedAt.toISOString(),
    status: doc.status as ApprovalStatus,
    decidedBy: doc.decidedBy,
    decidedAt: doc.decidedAt === null ? null : doc.decidedAt.toISOString(),
    reason: doc.reason,
    expiresAt: doc.expiresAt.toISOString(),
  };
}
