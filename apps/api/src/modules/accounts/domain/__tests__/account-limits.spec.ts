import { describe, expect, it } from 'vitest';

import { AccountLimitExceededError } from '../account.errors.js';
import { assertWithinAccountLimits, type ExistingAccountLike } from '../account-limits.js';

function account(productCode: string, currency: string, status = 'active'): ExistingAccountLike {
  return { productCode, currency, status };
}

describe('assertWithinAccountLimits', () => {
  it('allows the first account of a product and currency', () => {
    expect(() =>
      assertWithinAccountLimits([account('ICB-SAVINGS', 'USD')], 'ICB-CURRENT', 'USD'),
    ).not.toThrow();
  });

  it('rejects a second account of the same product in the same currency', () => {
    expect(() =>
      assertWithinAccountLimits([account('ICB-CURRENT', 'USD')], 'ICB-CURRENT', 'USD'),
    ).toThrow(AccountLimitExceededError);
  });

  it('allows the same product in another currency — multi-currency is the point', () => {
    expect(() =>
      assertWithinAccountLimits([account('ICB-CURRENT', 'USD')], 'ICB-CURRENT', 'GHS'),
    ).not.toThrow();
  });

  it('frees the slot when the existing account is closed', () => {
    expect(() =>
      assertWithinAccountLimits(
        [account('ICB-CURRENT', 'USD', 'closed')],
        'ICB-CURRENT',
        'USD',
      ),
    ).not.toThrow();
  });

  it('enforces the total cap across the relationship', () => {
    const many = Array.from({ length: 10 }, (_unused, index) =>
      account(index % 2 === 0 ? 'ICB-CURRENT' : 'ICB-SAVINGS', `C${index}`),
    );

    expect(() => assertWithinAccountLimits(many, 'ICB-SAVINGS', 'USD')).toThrow(
      AccountLimitExceededError,
    );
  });

  it('ignores closed accounts when counting the total', () => {
    const many = Array.from({ length: 10 }, (_unused, index) =>
      account('ICB-CURRENT', `C${index}`, index === 9 ? 'active' : 'closed'),
    );

    expect(() => assertWithinAccountLimits(many, 'ICB-SAVINGS', 'USD')).not.toThrow();
  });

  it('carries the scope and limit in the error', () => {
    try {
      assertWithinAccountLimits([account('ICB-CURRENT', 'USD')], 'ICB-CURRENT', 'USD');
      expect.unreachable();
    } catch (error) {
      expect((error as AccountLimitExceededError).code).toBe('LIMIT_EXCEEDED');
      expect((error as AccountLimitExceededError).context).toMatchObject({ limit: 1 });
    }
  });
});
