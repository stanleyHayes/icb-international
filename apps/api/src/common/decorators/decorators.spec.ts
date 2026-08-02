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

describe('cross-cutting decorators', () => {
  it('stores the required permissions', () => {
    const metadata = Reflect.getMetadata(PERMISSIONS_KEY, Sample.prototype.reverse) as string[];
    expect(metadata).toEqual(['transactions:reverse', 'accounts:freeze']);
  });

  it('stores the step-up purpose', () => {
    expect(Reflect.getMetadata(STEP_UP_KEY, Sample.prototype.reverse)).toBe('transaction-reverse');
  });

  it('marks the handler idempotent', () => {
    expect(Reflect.getMetadata(IDEMPOTENT_KEY, Sample.prototype.reverse)).toBe(true);
  });

  it('stores the audit action name', () => {
    expect(Reflect.getMetadata(AUDIT_ACTION_KEY, Sample.prototype.reverse)).toBe(
      'transaction.reverse',
    );
  });

  it('names the step-up header the guard reads', () => {
    expect(STEP_UP_TOKEN_HEADER).toBe('x-step-up-token');
  });
});
