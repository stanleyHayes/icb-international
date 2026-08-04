'use server';

import type { CardDetail } from '@icb/contracts';
import { randomUUID } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { ApiError, api } from '@/lib/api';

import { fieldErrorsFrom } from '../form-money';

export interface IssueCardState {
  error: string | null;
  fieldErrors: Record<string, string>;
  /** Set on success; the form navigates to the new card. */
  cardId: string | null;
}

const issueSchema = z.object({
  accountId: z.string().min(1, 'Choose the account this card spends from'),
  kind: z.enum(['debit', 'virtual']),
  network: z.enum(['visa', 'mastercard']),
  nickname: z
    .string()
    .max(60, 'Keep the name under 60 characters')
    .optional(),
  deliveryAddressId: z.enum(['residential', 'postal']).default('residential'),
});

export async function issueCardAction(
  _previous: IssueCardState,
  formData: FormData,
): Promise<IssueCardState> {
  const parsed = issueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFrom(parsed.error.issues), cardId: null };
  }

  const { nickname, ...rest } = parsed.data;
  try {
    const card = await api<CardDetail>('/cards', {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: { ...rest, ...(nickname ? { nickname } : {}) },
    });

    revalidateTag('cards', 'max');
    return { error: null, fieldErrors: {}, cardId: card.id };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'The card could not be issued. Please try again.',
      fieldErrors: {},
      cardId: null,
    };
  }
}
