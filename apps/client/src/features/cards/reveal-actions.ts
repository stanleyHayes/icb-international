'use server';

import { resolveApiBaseUrl } from '@icb/contracts';
import type { CardSensitiveDetails, MfaChallenge, StepUpToken } from '@icb/contracts';
import { redirect } from 'next/navigation';

import { readSession } from '@/lib/session';

import { ApiError, api } from '@/lib/api';

const API_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4100/v1');

export interface StepUpState {
  status: 'idle' | 'challenge' | 'revealed' | 'error';
  error: string | null;
  challenge: MfaChallenge | null;
  details: CardSensitiveDetails | null;
}

const IDLE: StepUpState = { status: 'idle', error: null, challenge: null, details: null };

/**
 * Begin the step-up: a fresh second-factor challenge pinned to the `reveal_card` purpose. The
 * full PAN is never touched until the challenge is answered.
 */
export async function requestRevealAction(): Promise<StepUpState> {
  try {
    const challenge = await api<MfaChallenge>('/auth/step-up', {
      method: 'POST',
      body: { purpose: 'reveal_card' },
    });
    return { ...IDLE, status: 'challenge', challenge };
  } catch (error) {
    return {
      ...IDLE,
      status: 'error',
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'Verification could not be started. Please try again.',
    };
  }
}

/**
 * Answer the challenge, then exchange the minted step-up token for the sensitive details.
 *
 * The reveal call carries the token in `x-step-up-token`, which the shared `api` helper does not
 * know about, so this one request is hand-built on the same session. The details come back with
 * a `hideAfter` deadline and the UI must honour it.
 */
export async function verifyAndRevealAction(
  cardId: string,
  challengeId: string,
  code: string,
): Promise<StepUpState> {
  try {
    const token = await api<StepUpToken>('/auth/step-up/verify', {
      method: 'POST',
      body: { challengeId, code },
    });
    const details = await fetchSensitive(cardId, token.stepUpToken);
    return { ...IDLE, status: 'revealed', details };
  } catch (error) {
    return {
      ...IDLE,
      status: 'error',
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'The code could not be verified. Please try again.',
    };
  }
}

async function fetchSensitive(cardId: string, stepUpToken: string): Promise<CardSensitiveDetails> {
  const session = await readSession();
  if (!session) {
    redirect('/login');
  }

  const response = await fetch(`${API_URL}/cards/${cardId}/sensitive`, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${session.accessToken}`,
      'x-step-up-token': stepUpToken,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ApiError(
      {
        type: 'about:blank',
        title: 'Reveal failed',
        status: response.status,
        detail: 'The card details could not be shown. Please verify again.',
        code: 'INTERNAL_ERROR',
        correlationId: 'unknown',
      },
      response.status,
    );
  }
  return (await response.json()) as CardSensitiveDetails;
}
