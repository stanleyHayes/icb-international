import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { DomainError } from '../errors/domain.error.js';
import { TokenService, type AccessTokenClaims } from '../../modules/auth/application/token.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Populated by JwtAuthGuard. Absent on public routes. */
    user?: AccessTokenClaims;
  }
}

/**
 * Bearer-token authentication.
 *
 * Applied globally and opted out of with `@Public()`, so a new endpoint is authenticated by
 * default. The opposite arrangement — opt-in protection — means one forgotten decorator exposes
 * customer money.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = extractBearer(request.headers.authorization);

    if (!token) {
      throw new DomainError('UNAUTHENTICATED', 'A bearer token is required');
    }

    try {
      request.user = await this.tokens.verifyAccessToken(token);
      return true;
    } catch {
      throw new DomainError('UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
    }
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}
