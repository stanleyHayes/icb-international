import type { StaffRole } from '@icb/contracts';

/**
 * The staff permission matrix.
 *
 * Roles are labels for people; permissions are what handlers check. Keeping the mapping in one
 * audited table — rather than scattering role names across handlers — is what makes "what can a
 * fraud analyst do?" answerable without reading the whole codebase.
 */
export const PERMISSIONS = [
  'customers:read',
  'customers:write',
  'accounts:read',
  'accounts:freeze',
  'transactions:read',
  'transactions:reverse',
  'cards:manage',
  'loans:read',
  'loans:approve',
  'kyc:review',
  'risk:review',
  'disputes:manage',
  'staff:manage',
  'audit:read',
  'simulation:control',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const READERS: readonly Permission[] = ['customers:read', 'accounts:read', 'transactions:read'];
const RISK_REVIEWERS: readonly Permission[] = [...READERS, 'risk:review'];
const AUDIT_READERS: readonly Permission[] = [...RISK_REVIEWERS, 'audit:read'];

export const ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly Permission[]>> = {
  support: [...READERS],
  teller: [...READERS, 'customers:write'],
  operations: [...READERS, 'transactions:reverse', 'cards:manage', 'disputes:manage'],
  underwriter: [...READERS, 'loans:read'],
  fraud_analyst: [...RISK_REVIEWERS],
  aml_officer: [...AUDIT_READERS],
  compliance: [...AUDIT_READERS, 'kyc:review'],
  admin: [
    ...AUDIT_READERS,
    'customers:write',
    'accounts:freeze',
    'transactions:reverse',
    'cards:manage',
    'loans:read',
    'loans:approve',
    'kyc:review',
    'disputes:manage',
    'staff:manage',
  ],
  super_admin: [...PERMISSIONS],
};

/** Union of every permission granted to any of the given roles. */
export function permissionsForRoles(roles: readonly string[]): ReadonlySet<Permission> {
  const granted = new Set<Permission>();
  for (const role of roles) {
    const permissions = ROLE_PERMISSIONS[role as StaffRole];
    if (permissions) {
      for (const permission of permissions) {
        granted.add(permission);
      }
    }
  }
  return granted;
}
