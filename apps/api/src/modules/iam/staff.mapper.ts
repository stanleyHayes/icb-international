import type { StaffRole, StaffUser } from '@icb/contracts';

import type { StaffUserDoc } from './infrastructure/iam.schemas.js';

/** Document → wire DTO. The only place the doc shape is allowed to leak into the API. */
export function toStaffUser(doc: StaffUserDoc): StaffUser {
  return {
    id: doc._id,
    email: doc.email,
    firstName: doc.firstName,
    lastName: doc.lastName,
    roles: doc.roles as StaffRole[],
    active: doc.active,
    mfaEnabled: doc.mfaEnabled,
    lastLoginAt: doc.lastLoginAt === null ? null : doc.lastLoginAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}
