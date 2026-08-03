import type { AuditEvent } from '@icb/contracts';

import type { AuditEventDoc } from './audit-event.schemas.js';

/**
 * Stored row → wire contract. The snapshots (`before`/`after`) deliberately stay off the wire:
 * the contract exposes the derived `changes`, and the raw snapshots exist only so the hash can
 * be recomputed during verification.
 */
export function toAuditEvent(doc: AuditEventDoc): AuditEvent {
  return {
    id: doc._id,
    sequence: doc.sequence,
    actorType: doc.actorType,
    actorId: doc.actorId,
    actorLabel: doc.actorLabel,
    action: doc.action,
    subjectType: doc.subjectType,
    subjectId: doc.subjectId,
    summary: doc.summary,
    changes: doc.changes.map((change) => ({
      field: change.field,
      before: change.before,
      after: change.after,
    })),
    ipAddress: doc.ipAddress,
    correlationId: doc.correlationId,
    hash: doc.hash,
    previousHash: doc.previousHash,
    at: doc.at.toISOString(),
  };
}
