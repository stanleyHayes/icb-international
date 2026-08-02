import 'reflect-metadata';

import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { describe, expect, it } from 'vitest';

import { CurrentCustomer, CurrentUser } from './current-user.decorator.js';

type Factory = (data: unknown, context: ExecutionContext) => unknown;

/** Pulls the param factory Nest registered for a decorated method parameter. */
function factoryOf(target: object, method: string): Factory {
  const routeArgs = Reflect.getMetadata(ROUTE_ARGS_METADATA, target.constructor, method) as Record<
    string,
    { factory: Factory }
  >;
  const entry = Object.values(routeArgs)[0];
  if (!entry) {
    throw new Error('No route-arg metadata registered');
  }
  return entry.factory;
}

class CurrentUserTarget {
  handler(@CurrentUser() _user: unknown): void {
    // Decorated only so the factory can be captured; never invoked.
  }
}

class CurrentCustomerTarget {
  handler(@CurrentCustomer() _customerId: unknown): void {
    // Decorated only so the factory can be captured; never invoked.
  }
}

function contextWith(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('CurrentUser', () => {
  const factory = factoryOf(CurrentUserTarget.prototype, 'handler');

  it('returns the verified token claims', () => {
    const claims = { sub: 'user-1', customerId: 'cust-1', roles: [] };
    expect(factory(null, contextWith(claims))).toBe(claims);
  });

  it('rejects when no principal is present', () => {
    expect(() => factory(null, contextWith(undefined))).toThrow(
      expect.objectContaining({ code: 'UNAUTHENTICATED' }) as Error,
    );
  });
});

describe('CurrentCustomer', () => {
  const factory = factoryOf(CurrentCustomerTarget.prototype, 'handler');

  it('returns the customer id', () => {
    expect(factory(null, contextWith({ sub: 'user-1', customerId: 'cust-9' }))).toBe('cust-9');
  });

  it('rejects staff-only principals', () => {
    expect(() => factory(null, contextWith({ sub: 'staff-1', customerId: null }))).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }) as Error,
    );
  });
});
