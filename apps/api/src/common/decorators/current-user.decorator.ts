import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { DomainError } from '../errors/domain.error.js';
import type { AccessTokenClaims } from '../../modules/auth/application/token.service.js';

/**
 * The authenticated principal, taken from the verified token.
 *
 * Handlers must derive ownership from this and never from a path or body parameter — that
 * distinction is what stops one customer reading another's account (IDOR).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenClaims => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (!request.user) {
      throw new DomainError('UNAUTHENTICATED', 'Authentication is required');
    }
    return request.user;
  },
);

/**
 * The authenticated customer id, rejecting staff-only principals.
 *
 * Customer-facing endpoints take this rather than the whole claim set so that "which customer?"
 * cannot be answered from request input.
 */
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const customerId = request.user?.customerId;
    if (!customerId) {
      throw new DomainError('FORBIDDEN', 'This endpoint is only available to customers');
    }
    return customerId;
  },
);
