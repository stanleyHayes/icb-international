import { describe, expect, it } from 'vitest';

import { AccountTransitionError } from '../account.errors.js';
import { assertTransition, isTransitionAllowed } from '../account-status-machine.js';

describe('account status machine', () => {
  it('freezes and unfreezes an active account', () => {
    expect(isTransitionAllowed('active', 'frozen')).toBe(true);
    expect(isTransitionAllowed('frozen', 'active')).toBe(true);
  });

  it('wakes a dormant account and lets an active one go dormant', () => {
    expect(isTransitionAllowed('dormant', 'active')).toBe(true);
    expect(isTransitionAllowed('active', 'dormant')).toBe(true);
  });

  it('activates a pending account', () => {
    expect(isTransitionAllowed('pending', 'active')).toBe(true);
  });

  it('treats closed as terminal — nothing leaves it', () => {
    expect(isTransitionAllowed('closed', 'active')).toBe(false);
    expect(isTransitionAllowed('closed', 'frozen')).toBe(false);
    expect(() => assertTransition('acct_1', 'closed', 'active')).toThrow(AccountTransitionError);
  });

  it('refuses to freeze an account that is not active', () => {
    expect(isTransitionAllowed('pending', 'frozen')).toBe(false);
    expect(isTransitionAllowed('dormant', 'frozen')).toBe(false);
    expect(() => assertTransition('acct_1', 'pending', 'frozen')).toThrow(AccountTransitionError);
  });

  it('permits closure from any live status', () => {
    expect(isTransitionAllowed('pending', 'closed')).toBe(true);
    expect(isTransitionAllowed('active', 'closed')).toBe(true);
    expect(isTransitionAllowed('frozen', 'closed')).toBe(true);
    expect(isTransitionAllowed('dormant', 'closed')).toBe(true);
  });

  it('treats setting the current status again as a no-op, not an error', () => {
    expect(isTransitionAllowed('frozen', 'frozen')).toBe(true);
    expect(() => assertTransition('acct_1', 'active', 'active')).not.toThrow();
  });

  it('carries the account and both statuses in the error context', () => {
    try {
      assertTransition('acct_9', 'closed', 'frozen');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AccountTransitionError);
      expect((error as AccountTransitionError).code).toBe('CONFLICT');
      expect((error as AccountTransitionError).context).toMatchObject({
        accountId: 'acct_9',
        from: 'closed',
        to: 'frozen',
      });
    }
  });
});
