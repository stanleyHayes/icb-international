import type { StaffRole } from '@icb/contracts';

/**
 * Who may work fraud cases and disputes.
 *
 * Declared once and applied to every back-office controller in this module, so the answer to "who
 * can release a blocked payment?" is a single list rather than something to be reconstructed by
 * reading five decorators and hoping they agree.
 */
export const FRAUD_ROLES: readonly StaffRole[] = [
  'fraud_analyst',
  'compliance',
  'operations',
  'admin',
  'super_admin',
];
