import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { RolesGuard } from './roles.guard.js';

function contextWith(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: string[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(roles) } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows when the handler declares no roles', () => {
    expect(guardRequiring(undefined).canActivate(contextWith({}))).toBe(true);
    expect(guardRequiring([]).canActivate(contextWith({}))).toBe(true);
  });

  it('allows a principal holding one of the listed roles', () => {
    const guard = guardRequiring(['operations', 'compliance']);
    expect(guard.canActivate(contextWith({ roles: ['compliance'] }))).toBe(true);
  });

  it('denies a principal holding none of the listed roles', () => {
    const guard = guardRequiring(['operations']);
    expect(() => guard.canActivate(contextWith({ roles: ['support'] }))).toThrow(
      expect.objectContaining({ code: 'PERMISSION_DENIED' }) as Error,
    );
  });

  it('denies an unauthenticated principal', () => {
    const guard = guardRequiring(['operations']);
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(
      expect.objectContaining({ code: 'PERMISSION_DENIED' }) as Error,
    );
  });
});
