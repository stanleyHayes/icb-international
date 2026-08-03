import type { StaffRole } from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  permissionsForRoles,
  type Permission,
} from '../../common/guards/permissions.constants.js';

/** One row of the matrix: a role and the capabilities it grants. */
export interface RolePermissions {
  readonly role: StaffRole;
  readonly permissions: readonly Permission[];
}

/**
 * The permission matrix, as data.
 *
 * The matrix itself lives in `common/guards/permissions.constants.ts` — this service only
 * *exposes* it, so admin tooling (BE-27, the console) can render "what can a fraud analyst
 * do?" without importing guard internals, and so there is exactly one copy of the data.
 */
@Injectable()
export class PermissionMatrixService {
  /** Every permission that exists, in declaration order. */
  catalog(): readonly Permission[] {
    return PERMISSIONS;
  }

  /** The full role → permission table. */
  matrix(): readonly RolePermissions[] {
    return (Object.keys(ROLE_PERMISSIONS) as StaffRole[]).map((role) => ({
      role,
      permissions: ROLE_PERMISSIONS[role],
    }));
  }

  /** The union of permissions granted by a set of roles — what a holder may actually do. */
  resolve(roles: readonly string[]): readonly Permission[] {
    return [...permissionsForRoles(roles)];
  }
}
