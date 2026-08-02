import type { BeneficiaryVerification } from '@icb/contracts';

/**
 * The verification state machine, named once.
 *
 * `not_started → deposits_sent → verified` is the happy path; `failed` records a wrong answer
 * that still has attempts left, and `locked` is terminal until a human intervenes.
 */
export type VerificationState = BeneficiaryVerification['state'];

export const VERIFICATION_STATES: Readonly<Record<Uppercase<VerificationState>, VerificationState>> =
  {
    NOT_STARTED: 'not_started',
    DEPOSITS_SENT: 'deposits_sent',
    VERIFIED: 'verified',
    FAILED: 'failed',
    LOCKED: 'locked',
  };

export function toVerificationState(value: string): VerificationState {
  const known = Object.values(VERIFICATION_STATES).find((state) => state === value);
  return known ?? VERIFICATION_STATES.NOT_STARTED;
}
