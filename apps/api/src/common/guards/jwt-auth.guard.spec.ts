import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { TokenService } from '../../modules/auth/application/token.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

interface FakeRequest {
  headers: Record<string, string>;
  user?: unknown;
}

function contextWith(request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function build(options: { isPublic: boolean; verify: (token: string) => Promise<unknown> }): {
  guard: JwtAuthGuard;
  verify: ReturnType<typeof vi.fn>;
} {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(options.isPublic),
  } as unknown as Reflector;
  const verify = vi.fn(options.verify);
  const tokens = { verifyAccessToken: verify } as unknown as TokenService;
  return { guard: new JwtAuthGuard(tokens, reflector), verify };
}

const CLAIMS = { sub: 'user-1', customerId: 'cust-1', roles: [], sessionId: 's-1' };

describe('JwtAuthGuard', () => {
  it('allows public routes without a token', async () => {
    const { guard, verify } = build({
      isPublic: true,
      verify: () => Promise.reject(new Error('must not be called')),
    });
    await expect(guard.canActivate(contextWith({ headers: {} }))).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects when the Authorization header is absent or malformed', async () => {
    const { guard } = build({ isPublic: false, verify: () => Promise.resolve(CLAIMS) });

    await expect(guard.canActivate(contextWith({ headers: {} }))).rejects.toThrow(
      expect.objectContaining({ code: 'UNAUTHENTICATED' }) as Error,
    );
    await expect(
      guard.canActivate(contextWith({ headers: { authorization: 'Basic abc' } })),
    ).rejects.toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }) as Error);
  });

  it('attaches the verified claims to the request', async () => {
    const { guard } = build({ isPublic: false, verify: () => Promise.resolve(CLAIMS) });
    const request: FakeRequest = { headers: { authorization: 'Bearer good-token' } };

    await expect(guard.canActivate(contextWith(request))).resolves.toBe(true);
    expect(request.user).toEqual(CLAIMS);
  });

  it('rejects an expired or invalid token as UNAUTHENTICATED', async () => {
    const { guard } = build({
      isPublic: false,
      verify: () => Promise.reject(new Error('jwt expired')),
    });
    const request: FakeRequest = { headers: { authorization: 'Bearer stale' } };

    await expect(guard.canActivate(contextWith(request))).rejects.toThrow(
      expect.objectContaining({ code: 'UNAUTHENTICATED' }) as Error,
    );
  });
});
