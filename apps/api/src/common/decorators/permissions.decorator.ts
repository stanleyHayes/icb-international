import { SetMetadata, type CustomDecorator } from '@nestjs/common';

import type { Permission } from '../guards/permissions.constants.js';

export const PERMISSIONS_KEY = 'icb:permissions';

/**
 * Restricts a handler to principals whose roles grant every listed permission.
 *
 * Prefer this over `@Roles` for back-office endpoints: handlers declare the capability they
 * need, and the role→permission matrix stays in one place.
 */
export const Permissions = (...permissions: Permission[]): CustomDecorator<string> =>
  SetMetadata(PERMISSIONS_KEY, permissions);
