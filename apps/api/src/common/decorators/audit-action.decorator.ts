import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'icb:auditAction';

/**
 * Names the audit action a handler performs (e.g. `account.freeze`, `kyc.approve`).
 *
 * The audit pipeline (N7) reads this metadata to append a hash-chained `audit_events` entry with
 * a stable, greppable action name instead of inferring one from the route.
 */
export const AuditAction = (action: string): CustomDecorator<string> =>
  SetMetadata(AUDIT_ACTION_KEY, action);
