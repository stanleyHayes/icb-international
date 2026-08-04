import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from './permissions.guard.js';
import { permissionsForRoles, type Permission } from './permissions.constants.js';

interface FakeRequest {
  user?: { roles: readonly string[] };
}

function contextWith(request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function guardRequiring(permissions: Permission[] | undefined): PermissionsGuard {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(permissions),
  } as unknown as Reflector;
  return new PermissionsGuard(reflector);
}

describe('permissionsForRoles', () => {
  it('grants a role its listed permissions', () => {
    expect(permissionsForRoles(['fraud_analyst']).has('risk:review')).toBe(true);
  });

  it('unions permissions across roles', () => {
    const granted = permissionsForRoles(['support', 'underwriter']);
    expect(granted.has('customers:read')).toBe(true);
    expect(granted.has('loans:read')).toBe(true);
    expect(granted.has('loans:approve')).toBe(false);
  });

  it('grants super_admin every permission', () => {
    const granted = permissionsForRoles(['super_admin']);
    expect(granted.has('controls:operate')).toBe(true);
    expect(granted.has('staff:manage')).toBe(true);
  });

  it('ignores unknown role strings', () => {
    expect(permissionsForRoles(['not-a-role']).size).toBe(0);
  });
});

describe('PermissionsGuard', () => {
  it('allows when no permissions are required', () => {
    expect(guardRequiring(undefined).canActivate(contextWith({}))).toBe(true);
    expect(guardRequiring([]).canActivate(contextWith({}))).toBe(true);
  });

  it('allows when the principal holds every required permission', () => {
    const request = { user: { roles: ['operations'] } };
    const guard = guardRequiring(['transactions:reverse']);

    expect(guard.canActivate(contextWith(request))).toBe(true);
  });

  it('denies with the missing permissions in context', () => {
    const request = { user: { roles: ['support'] } };
    const guard = guardRequiring(['transactions:reverse', 'audit:read']);

    expect(() => guard.canActivate(contextWith(request))).toThrow(
      expect.objectContaining({
        code: 'PERMISSION_DENIED',
        context: { missing: ['transactions:reverse', 'audit:read'] },
      }) as Error,
    );
  });

  it('denies an unauthenticated principal', () => {
    const guard = guardRequiring(['customers:read']);

    expect(() => guard.canActivate(contextWith({}))).toThrow(
      expect.objectContaining({ code: 'PERMISSION_DENIED' }) as Error,
    );
  });
});
