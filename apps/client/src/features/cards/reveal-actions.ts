'use server';

import type { CardSensitiveDetails } from '@icb/contracts';

import { ApiError, api } from '@/lib/api';

export interface RevealState {
  status: 'idle' | 'revealed' | 'error';
  error: string | null;
  details: CardSensitiveDetails | null;
}

const IDLE: RevealState = { status: 'idle', error: null, details: null };

/**
 * Reveal the full card details on the customer's session alone.
 *
 * The shared `api` helper attaches the session token and never caches, so the PAN exists only in
 * this response. The details come back with a `hideAfter` deadline and the UI must honour it.
 */
export async function revealCardAction(cardId: string): Promise<RevealState> {
  try {
    const details = await api<CardSensitiveDetails>(`/cards/${cardId}/sensitive`);
    return { ...IDLE, status: 'revealed', details };
  } catch (error) {
    return {
      ...IDLE,
      status: 'error',
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'The card details could not be shown. Please try again.',
    };
  }
}
