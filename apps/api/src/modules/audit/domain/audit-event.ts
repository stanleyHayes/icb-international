import type { auditIntegritySchema, auditQuerySchema } from '@icb/contracts';
import type { z } from 'zod';

/** Who acted. `system` covers jobs, seeds and unauthenticated request flows. */
export const ACTOR_TYPES = ['customer', 'staff', 'system'] as const;
export type AuditActorType = (typeof ACTOR_TYPES)[number];

export interface AuditActor {
  readonly type: AuditActorType;
  readonly id: string | null;
  readonly label: string;
}

export interface AuditSubject {
  readonly type: string;
  readonly id: string | null;
}

/**
 * Everything needed to append one event. `before`/`after` are arbitrary snapshots — the service
 * masks PII and derives the change rows, so a caller can never accidentally log a PAN.
 */
export interface RecordAuditInput {
  readonly actor: AuditActor;
  readonly action: string;
  readonly subject: AuditSubject;
  readonly summary?: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly ipAddress?: string | null;
  readonly correlationId?: string;
}

/** One field that changed, values stringified so the diff renders without a schema. */
export interface AuditChange {
  readonly field: string;
  readonly before: string;
  readonly after: string;
}

export type AuditQuery = z.infer<typeof auditQuerySchema>;
export type AuditIntegrity = z.infer<typeof auditIntegritySchema>;
