import { describe, expect, it } from 'vitest';

import { VERIFICATION_STATES, toVerificationState } from '../domain/verification-state.js';

describe('toVerificationState', () => {
  it('round-trips every known state', () => {
    for (const state of Object.values(VERIFICATION_STATES)) {
      expect(toVerificationState(state)).toBe(state);
    }
  });

  it('maps an unrecognised stored value back to not_started', () => {
    expect(toVerificationState('something-else')).toBe(VERIFICATION_STATES.NOT_STARTED);
    expect(toVerificationState('')).toBe(VERIFICATION_STATES.NOT_STARTED);
  });
});
