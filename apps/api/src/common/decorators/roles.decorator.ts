import type { StaffRole } from '@icb/contracts';
import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const ROLES_KEY = 'icb:roles';

/** Restricts a handler to principals holding at least one of the listed staff roles. */
export const Roles = (...roles: StaffRole[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
