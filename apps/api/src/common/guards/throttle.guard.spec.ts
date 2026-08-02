import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerLimitDetail, ThrottlerStorage } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';

import { ThrottleGuard } from './throttle.guard.js';

class TestableThrottleGuard extends ThrottleGuard {
  tracker(request: Record<string, unknown>): Promise<string> {
    return this.getTracker(request);
  }

  reject(detail: ThrottlerLimitDetail): Promise<void> {
    return this.throwThrottlingException({} as ExecutionContext, detail);
  }
}

function build(): TestableThrottleGuard {
  const storage = {} as ThrottlerStorage;
  return new TestableThrottleGuard([], storage, new Reflector());
}

function detail(ttlMs: number): ThrottlerLimitDetail {
  return {
    ttl: ttlMs,
    limit: 10,
    key: 'k',
    tracker: 't',
    totalHits: 11,
    timeToExpire: ttlMs,
    timeToBlockExpire: ttlMs,
    isBlocked: true,
  };
}

describe('ThrottleGuard', () => {
  it('tracks authenticated callers by subject', async () => {
    const request = { user: { sub: 'user-9' }, ip: '10.0.0.1' };
    await expect(build().tracker(request)).resolves.toBe('user-9');
  });

  it('falls back to the client IP for anonymous callers', async () => {
    await expect(build().tracker({ ip: '203.0.113.7' })).resolves.toBe('203.0.113.7');
  });

  it('never returns an empty tracker', async () => {
    await expect(build().tracker({})).resolves.toBe('unknown');
  });

  it('throws a typed RateLimitedError with whole-second retryAfter', () => {
    expect(() => build().reject(detail(30_000))).toThrowError(
      expect.objectContaining({ code: 'RATE_LIMITED', retryAfterSeconds: 30 }) as Error,
    );
  });

  it('rounds sub-second ttls up to one second', () => {
    expect(() => build().reject(detail(1))).toThrowError(
      expect.objectContaining({ code: 'RATE_LIMITED', retryAfterSeconds: 1 }) as Error,
    );
  });
});
