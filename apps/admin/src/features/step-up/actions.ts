'use server';

import type { MfaChallenge, StepUpToken } from '@icb/contracts';

import { ApiError, api } from '@/lib/api';

export interface StepUpRequestResult {
  challenge: MfaChallenge | null;
  error: string | null;
}

export interface StepUpVerifyResult {
  stepUpToken: string | null;
  error: string | null;
}

/**
 * Begin forced re-authentication for a sensitive operation.
 *
 * The API issues a one-time-code challenge pinned to the operation's purpose; completing it
 * mints a short-lived, single-purpose token the next mutation sends as `x-step-up-token`.
 */
export async function requestStepUpAction(purpose: string): Promise<StepUpRequestResult> {
  try {
    const challenge = await api<MfaChallenge>('/auth/step-up', {
      method: 'POST',
      body: { purpose },
    });
    return { challenge, error: null };
  } catch (error) {
    return {
      challenge: null,
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'Re-authentication could not be started. Please try again.',
    };
  }
}

/** Complete the challenge; the returned token authorises exactly one sensitive call. */
export async function verifyStepUpAction(
  challengeId: string,
  code: string,
): Promise<StepUpVerifyResult> {
  try {
    const token = await api<StepUpToken>('/auth/step-up/verify', {
      method: 'POST',
      body: { challengeId, code },
    });
    return { stepUpToken: token.stepUpToken, error: null };
  } catch (error) {
    return {
      stepUpToken: null,
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'That code was not accepted. Please try again.',
    };
  }
}
