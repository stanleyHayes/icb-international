import { Injectable, type ExecutionContext } from '@nestjs/common';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';

import type { AccessTokenClaims } from '../../modules/auth/application/token.service.js';
import { RateLimitedError } from '../errors/domain-errors.js';

const MILLISECONDS_PER_SECOND = 1000;

/**
 * ICB-flavoured rate limiting.
 *
 * Two adjustments to the stock guard: authenticated callers are tracked by subject (so one user
 * behind a shared NAT is not punished for a neighbour), and the rejection is a typed
 * `RateLimitedError` so it leaves the building as an RFC 9457 problem with `retryAfterSeconds`,
 * not a framework default.
 */
@Injectable()
export class ThrottleGuard extends ThrottlerGuard {
  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    const user = request['user'] as AccessTokenClaims | undefined;
    if (user) {
      return Promise.resolve(user.sub);
    }
    const ip = request['ip'];
    return Promise.resolve(typeof ip === 'string' ? ip : 'unknown');
  }

  protected override throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new RateLimitedError(Math.max(1, Math.ceil(detail.ttl / MILLISECONDS_PER_SECOND)));
  }
}
