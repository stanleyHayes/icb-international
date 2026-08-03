import type { StaffRole } from '@icb/contracts';

/**
 * Who may work AML cases.
 *
 * `aml_officer` is the programme's own role; compliance and above are the escalation path.
 * Declared once, applied to the whole controller, so "who can file a SAR?" has a one-line answer.
 */
export const AML_ROLES: readonly StaffRole[] = [
  'aml_officer',
  'compliance',
  'admin',
  'super_admin',
];
