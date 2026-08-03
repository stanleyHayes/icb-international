import { createHash } from 'node:crypto';

import { GENESIS_HASH } from '../audit.constants.js';
import type { AuditChange } from './audit-event.js';
import { canonicalJson } from './canonicalise.js';

/**
 * The stored fields the hash commits to — everything on the event except its identity (`_id`)
 * and the chain pointers themselves. Recomputable from a stored row alone, which is what makes
 * tamper verification possible without any external state.
 */
export interface HashableAuditEvent {
  readonly sequence: number;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly actorLabel: string;
  readonly action: string;
  readonly subjectType: string;
  readonly subjectId: string | null;
  readonly summary: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly changes: readonly AuditChange[];
  readonly ipAddress: string | null;
  readonly correlationId: string;
  readonly at: Date;
}

/**
 * `hash = H(prevHash ‖ canonical(event))` — the separator keeps the boundary between the two
 * inputs unambiguous so no pair of (prevHash, event) can collide with a different split.
 */
export function computeEventHash(
  previousHash: string | null,
  event: HashableAuditEvent,
): string {
  const canonical = canonicalJson({
    sequence: event.sequence,
    actorType: event.actorType,
    actorId: event.actorId,
    actorLabel: event.actorLabel,
    action: event.action,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    summary: event.summary,
    before: event.before,
    after: event.after,
    changes: event.changes,
    ipAddress: event.ipAddress,
    correlationId: event.correlationId,
    at: event.at,
  });
  return createHash('sha256')
    .update(`${previousHash ?? GENESIS_HASH}\n${canonical}`, 'utf8')
    .digest('hex');
}
