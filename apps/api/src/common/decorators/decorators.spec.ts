import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { AUDIT_ACTION_KEY, AuditAction } from './audit-action.decorator.js';
import { IDEMPOTENT_KEY, Idempotent } from './idempotent.decorator.js';
import { PERMISSIONS_KEY, Permissions } from './permissions.decorator.js';
import { IS_PUBLIC_KEY, Public } from './public.decorator.js';
import { ROLES_KEY, Roles } from './roles.decorator.js';

@Public()
class PublicController {
  @Roles('operations', 'compliance')
  list(): void {
    // Decorator target; metadata assertions below are the test.
  }
}

class Sample {
  @Permissions('transactions:reverse', 'accounts:freeze')
  @Idempotent()
  @AuditAction('transaction.reverse')
  reverse(): void {
    // Decorator target; metadata assertions below are the test.
  }
}

function metadataOn(key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(Sample.prototype, 'reverse');
  return Reflect.getMetadata(key, descriptor?.value as object);
}

describe('cross-cutting decorators', () => {
  it('stores the required permissions', () => {
    expect(metadataOn(PERMISSIONS_KEY)).toEqual(['transactions:reverse', 'accounts:freeze']);
  });

  it('marks the handler idempotent', () => {
    expect(metadataOn(IDEMPOTENT_KEY)).toBe(true);
  });

  it('stores the audit action name', () => {
    expect(metadataOn(AUDIT_ACTION_KEY)).toBe('transaction.reverse');
  });

  it('marks a controller public', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PublicController)).toBe(true);
  });

  it('stores the required roles on the handler', () => {
    const descriptor = Object.getOwnPropertyDescriptor(PublicController.prototype, 'list');
    expect(Reflect.getMetadata(ROLES_KEY, descriptor?.value as object)).toEqual([
      'operations',
      'compliance',
    ]);
  });
});
