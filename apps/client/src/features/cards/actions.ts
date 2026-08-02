'use server';

import type { CardDetail } from '@icb/contracts';
import { revalidateTag } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface CardActionState {
  error: string | null;
  frozen: boolean | null;
}

/**
 * Freeze or unfreeze a card.
 *
 * The server is the source of truth for the resulting state — the action returns what the API
 * says the card now is, rather than what the UI assumed it would be. A freeze that silently
 * failed but showed as applied is the worst possible outcome for this control.
 */
export async function toggleFreezeAction(
  _previous: CardActionState,
  formData: FormData,
): Promise<CardActionState> {
  const cardIdValue = formData.get('cardId');
  const cardId = typeof cardIdValue === 'string' ? cardIdValue : '';
  const freeze = formData.get('freeze') === 'true';

  try {
    const card = await api<CardDetail>(`/cards/${cardId}/freeze`, {
      method: 'POST',
      body: { frozen: freeze },
    });

    revalidateTag('cards', 'max');
    return { error: null, frozen: card.frozen };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.problem.detail
        : 'We could not change the card. Please try again.';
    return { error: message, frozen: null };
  }
}
