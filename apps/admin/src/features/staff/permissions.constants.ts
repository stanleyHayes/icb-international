import { STAFF_ROLES, type StaffRole } from '@icb/contracts';

/**
 * The staff permission matrix, mirrored for display.
 *
 * The authoritative mapping lives in the API (`common/guards/permissions.constants.ts`); it is
 * not exposed over an endpoint, so the matrix viewer renders this copy. The two must agree —
 * when the API matrix changes, change this file in the same breath.
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
  'controls:operate',
] as const;

export type ConsolePermission = (typeof PERMISSIONS)[number];

const READERS: readonly ConsolePermission[] = [
  'customers:read',
  'accounts:read',
  'transactions:read',
];
const RISK_REVIEWERS: readonly ConsolePermission[] = [...READERS, 'risk:review'];
const AUDIT_READERS: readonly ConsolePermission[] = [...RISK_REVIEWERS, 'audit:read'];

export const ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly ConsolePermission[]>> = {
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

export const ALL_STAFF_ROLES = STAFF_ROLES;

/** `customers:read` → `Customers · read`, for a matrix cell's accessible label. */
export function permissionLabel(permission: ConsolePermission): string {
  const [area = '', verb = ''] = permission.split(':');
  return `${area.charAt(0).toUpperCase()}${area.slice(1)} · ${verb}`;
}
