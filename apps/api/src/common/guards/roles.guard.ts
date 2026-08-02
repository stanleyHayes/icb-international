import type { StaffRole } from '@icb/contracts';
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { DomainError } from '../errors/domain.error.js';

/**
 * Role check for back-office endpoints.
 *
 * Deny by default: a handler with `@Roles(...)` is reachable only by a principal holding one of
 * the listed roles, and `super_admin` is not implicitly granted everything — it is listed where
 * it applies, so the permission model stays readable.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<StaffRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const roles = request.user?.roles ?? [];

    if (!required.some((role) => roles.includes(role))) {
      throw new DomainError('PERMISSION_DENIED', 'You do not have access to this area', {
        context: { required },
      });
    }
    return true;
  }
}
