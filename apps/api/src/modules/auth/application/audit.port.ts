/**
 * The audit port (N7: everything privileged is audited).
 *
 * An abstract class as the injection token — the same pattern as the notifications module's
 * `EmailTransport` — so any module can depend on the port without knowing which store is bound.
 * Today the auth module binds a Mongo-backed, hash-chained store; when a dedicated audit module
 * lands it rebinds this token and every emitter keeps working unchanged.
 */
export const AUDIT_OUTCOMES = { Success: 'success', Failure: 'failure' } as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[keyof typeof AUDIT_OUTCOMES];

export interface AuditEventInput {
  /** The principal the event concerns; null when no authenticated principal exists yet. */
  readonly actorId: string | null;
  /** A stable, greppable action name — see `AUDIT_ACTIONS` in `auth.constants.ts`. */
  readonly action: string;
  readonly outcome: AuditOutcome;
  /** Identifiers only. Tokens, codes, hashes, and passwords never appear here. */
  readonly context?: Record<string, unknown>;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

export abstract class AuditPort {
  abstract record(event: AuditEventInput): Promise<void>;
}
