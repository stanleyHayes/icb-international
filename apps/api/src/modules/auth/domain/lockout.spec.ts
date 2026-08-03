import { describe, expect, it } from 'vitest';

import { LOCKOUT_LADDER_MS, MAX_FAILED_ATTEMPTS } from '../auth.constants.js';
import { lockoutDurationMs, lockoutRemainingSeconds } from './lockout.js';

describe('lockoutDurationMs', () => {
  it('leaves the account open below the failure threshold', () => {
    expect(lockoutDurationMs(1)).toBeNull();
    expect(lockoutDurationMs(MAX_FAILED_ATTEMPTS - 1)).toBeNull();
  });

  it('locks for the first ladder step at the threshold', () => {
    expect(lockoutDurationMs(MAX_FAILED_ATTEMPTS)).toBe(LOCKOUT_LADDER_MS[0]);
  });

  it('lengthens each successive lockout', () => {
    expect(lockoutDurationMs(MAX_FAILED_ATTEMPTS + 1)).toBe(LOCKOUT_LADDER_MS[1]);
    expect(lockoutDurationMs(MAX_FAILED_ATTEMPTS + 2)).toBe(LOCKOUT_LADDER_MS[2]);
  });

  it('caps at the final ladder step no matter how many failures', () => {
    const last = LOCKOUT_LADDER_MS[LOCKOUT_LADDER_MS.length - 1];
    expect(lockoutDurationMs(MAX_FAILED_ATTEMPTS + 100)).toBe(last);
  });
});

describe('lockoutRemainingSeconds', () => {
  const now = new Date('2026-08-02T12:00:00.000Z').getTime();

  it('is zero when there is no lock', () => {
    expect(lockoutRemainingSeconds(null, now)).toBe(0);
  });

  it('is zero once the lock has lapsed', () => {
    expect(lockoutRemainingSeconds(new Date(now - 1), now)).toBe(0);
  });

  it('rounds up to whole seconds while locked', () => {
    expect(lockoutRemainingSeconds(new Date(now + 1_500), now)).toBe(2);
  });
});
