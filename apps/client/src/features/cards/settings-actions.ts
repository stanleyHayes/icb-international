'use server';

import type { CardDetail } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { draftToMoney } from '@/features/form-money';
import { ApiError, api } from '@/lib/api';

export interface CardSettingsState {
  error: string | null;
  saved: boolean;
}

const CHANNELS = ['online', 'contactless', 'atm', 'international', 'in_store'] as const;

const controlsSchema = z.object({
  cardId: z.string().min(1),
  blockedCategories: z.array(z.string()).default([]),
});

/**
 * Channel switches and blocked categories arrive as repeated form fields; every channel absent
 * from the submission is off. Each switch is enforced at authorisation, so the state the server
 * confirms is the state shown.
 */
export async function updateControlsAction(
  _previous: CardSettingsState,
  formData: FormData,
): Promise<CardSettingsState> {
  const parsed = controlsSchema.safeParse({
    cardId: formData.get('cardId'),
    blockedCategories: formData.getAll('blockedCategories'),
  });
  if (!parsed.success) {
    return { error: 'The controls could not be read. Please try again.', saved: false };
  }

  const channels = Object.fromEntries(
    CHANNELS.map((channel) => [channel, formData.get(`channel.${channel}`) === 'on']),
  );

  try {
    await api<CardDetail>(`/cards/${parsed.data.cardId}/controls`, {
      method: 'PATCH',
      body: { channels, blockedCategories: parsed.data.blockedCategories },
    });
    revalidateTag('cards', 'max');
    return { error: null, saved: true };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'The controls could not be saved. Please try again.',
      saved: false,
    };
  }
}

const AMOUNT_REQUIRED = 'Enter an amount';

const limitSchema = z.object({
  cardId: z.string().min(1),
  currency: z.string().length(3),
  perTransaction: z.string().min(1, AMOUNT_REQUIRED),
  daily: z.string().min(1, AMOUNT_REQUIRED),
  monthly: z.string().min(1, AMOUNT_REQUIRED),
  atmDaily: z.string().min(1, AMOUNT_REQUIRED),
  contactless: z.string().min(1, AMOUNT_REQUIRED),
});

const LIMIT_FIELDS = ['perTransaction', 'daily', 'monthly', 'atmDaily', 'contactless'] as const;

export async function updateLimitsAction(
  _previous: CardSettingsState,
  formData: FormData,
): Promise<CardSettingsState> {
  const parsed = limitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Every limit needs an amount.', saved: false };
  }

  const { cardId, currency, ...drafts } = parsed.data;
  const body: Record<string, unknown> = {};
  for (const field of LIMIT_FIELDS) {
    const money = draftToMoney(drafts[field], currency as CurrencyCode);
    if (!money) {
      return { error: 'Enter amounts such as 250.00.', saved: false };
    }
    body[field] = money;
  }

  try {
    await api<CardDetail>(`/cards/${cardId}/limits`, { method: 'PATCH', body });
    revalidateTag('cards', 'max');
    return { error: null, saved: true };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'The limits could not be saved. Please try again.',
      saved: false,
    };
  }
}
