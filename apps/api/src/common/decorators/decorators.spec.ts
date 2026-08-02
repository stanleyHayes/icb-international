import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { AUDIT_ACTION_KEY, AuditAction } from './audit-action.decorator.js';
import { IDEMPOTENT_KEY, Idempotent } from './idempotent.decorator.js';
import { PERMISSIONS_KEY, Permissions } from './permissions.decorator.js';
import {
  STEP_UP_KEY,
  STEP_UP_TOKEN_HEADER,
  RequireStepUp,
} from './require-step-up.decorator.js';

class Sample {
  @Permissions('transactions:reverse', 'accounts:freeze')
  @RequireStepUp('transaction-reverse')
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

  it('stores the step-up purpose', () => {
    expect(metadataOn(STEP_UP_KEY)).toBe('transaction-reverse');
  });

  it('marks the handler idempotent', () => {
    expect(metadataOn(IDEMPOTENT_KEY)).toBe(true);
  });

  it('stores the audit action name', () => {
    expect(metadataOn(AUDIT_ACTION_KEY)).toBe('transaction.reverse');
  });

  it('names the step-up header the guard reads', () => {
    expect(STEP_UP_TOKEN_HEADER).toBe('x-step-up-token');
  });
});
