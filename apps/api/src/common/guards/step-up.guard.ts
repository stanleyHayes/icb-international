import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { TokenService } from '../../modules/auth/application/token.service.js';
import { STEP_UP_KEY, STEP_UP_TOKEN_HEADER } from '../decorators/require-step-up.decorator.js';
import { isDomainError } from '../errors/domain.error.js';
import { StepUpRequiredError } from '../errors/domain-errors.js';

/**
 * Requires a fresh second-factor proof on sensitive operations (§11 step-up).
 *
 * The client mints a short-lived step-up token via the auth module and sends it on
 * `x-step-up-token`. The guard verifies the token, that it belongs to the caller, and that its
 * `purpose` claim matches the handler's `@RequireStepUp(purpose)` — freshness is enforced by the
 * token's short TTL (`jwt.stepUpTtlSeconds`), checked by JWT verification itself.
 */
@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const purpose = this.reflector.getAllAndOverride<string>(STEP_UP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!purpose) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers[STEP_UP_TOKEN_HEADER];
    if (typeof header !== 'string' || header.length === 0) {
      throw new StepUpRequiredError(purpose);
    }

    await this.assertValidProof(header, purpose, request.user?.sub);
    return true;
  }

  private async assertValidProof(
    token: string,
    purpose: string,
    subject: string | undefined,
  ): Promise<void> {
    try {
      const claims = await this.tokens.verifyStepUpToken(token);
      if (claims.sub !== subject || claims.purpose !== purpose) {
        throw new StepUpRequiredError(purpose);
      }
    } catch (error) {
      if (isDomainError(error)) {
        throw error;
      }
      throw new StepUpRequiredError(purpose);
    }
  }
}
