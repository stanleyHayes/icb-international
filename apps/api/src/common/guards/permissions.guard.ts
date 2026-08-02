import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { DomainError } from '../errors/domain.error.js';
import { permissionsForRoles, type Permission } from './permissions.constants.js';

/**
 * Capability check for back-office endpoints.
 *
 * Where `RolesGuard` asks "who are you?", this asks "may you do this specific thing?". All
 * listed permissions are required; a missing one denies with `PERMISSION_DENIED` and names what
 * was missing in the error context for the audit trail.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const granted = permissionsForRoles(request.user?.roles ?? []);
    const missing = required.filter((permission) => !granted.has(permission));

    if (missing.length > 0) {
      throw new DomainError('PERMISSION_DENIED', 'You do not have access to this action', {
        context: { missing },
      });
    }
    return true;
  }
}
