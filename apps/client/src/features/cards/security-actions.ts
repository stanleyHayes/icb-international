'use server';

import type { CardDetail } from '@icb/contracts';
import { randomUUID } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { ApiError, api } from '@/lib/api';

export interface CardSecurityState {
  error: string | null;
  saved: boolean;
  /** Reference of the replacement card, when a report triggers a reissue. */
  reissuedCardId: string | null;
}

const pinSchema = z.object({
  cardId: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be four digits'),
  confirm: z.string(),
});

/** Sets or replaces the PIN. The PIN is posted once and never returned by the API. */
export async function setPinAction(
  _previous: CardSecurityState,
  formData: FormData,
): Promise<CardSecurityState> {
  const parsed = pinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'PIN must be four digits',
      saved: false,
      reissuedCardId: null,
    };
  }
  if (parsed.data.pin !== parsed.data.confirm) {
    return { error: 'The two PINs do not match.', saved: false, reissuedCardId: null };
  }
  if (isWeakPin(parsed.data.pin)) {
    return {
      error: 'That PIN is too easy to guess. Avoid runs and repeated digits.',
      saved: false,
      reissuedCardId: null,
    };
  }

  try {
    await api<CardDetail>(`/cards/${parsed.data.cardId}/pin`, {
      method: 'POST',
      body: { pin: parsed.data.pin },
    });
    revalidateTag('cards', 'max');
    return { error: null, saved: true, reissuedCardId: null };
  } catch (error) {
    return {
      error:
        error instanceof ApiError ? error.problem.detail : 'The PIN could not be set. Please try again.',
      saved: false,
      reissuedCardId: null,
    };
  }
}

/** Sequential or repeated digits are declined before the network round-trip. */
function isWeakPin(pin: string): boolean {
  const digits = pin.split('').map(Number);
  const repeated = digits.every((digit) => digit === digits[0]);
  const ascending = digits.every((digit, index) => index === 0 || digit === (digits[index - 1] ?? 0) + 1);
  const descending = digits.every(
    (digit, index) => index === 0 || digit === (digits[index - 1] ?? 0) - 1,
  );
  return repeated || ascending || descending;
}

const travelSchema = z.object({
  cardId: z.string().min(1),
  countries: z.array(z.string().length(2)).min(1, 'Add at least one country'),
  from: z.iso.date('Enter a valid start date'),
  to: z.iso.date('Enter a valid end date'),
});

export async function setTravelNoticeAction(
  _previous: CardSecurityState,
  formData: FormData,
): Promise<CardSecurityState> {
  const parsed = travelSchema.safeParse({
    cardId: formData.get('cardId'),
    countries: formData.getAll('countries'),
    from: formData.get('from'),
    to: formData.get('to'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check the dates and countries.',
      saved: false,
      reissuedCardId: null,
    };
  }
  if (parsed.data.to < parsed.data.from) {
    return { error: 'The end date must be after the start date.', saved: false, reissuedCardId: null };
  }

  try {
    await api<CardDetail>(`/cards/${parsed.data.cardId}/travel-notice`, {
      method: 'POST',
      body: {
        countries: parsed.data.countries,
        from: parsed.data.from,
        to: parsed.data.to,
      },
    });
    revalidateTag('cards', 'max');
    return { error: null, saved: true, reissuedCardId: null };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'The travel notice could not be saved. Please try again.',
      saved: false,
      reissuedCardId: null,
    };
  }
}

const reportSchema = z.object({
  cardId: z.string().min(1),
  reason: z.enum(['lost', 'stolen', 'damaged', 'not_received', 'fraud']),
  detail: z.string().max(500).optional(),
  reissue: z.enum(['yes', 'no']),
});

/**
 * Report a card lost, stolen, or otherwise compromised. The old card is dead from the moment the
 * API confirms — the replacement, if asked for, is what the customer is sent next.
 */
export async function reportCardAction(
  _previous: CardSecurityState,
  formData: FormData,
): Promise<CardSecurityState> {
  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Choose what happened to the card.', saved: false, reissuedCardId: null };
  }

  try {
    const card = await api<CardDetail>(`/cards/${parsed.data.cardId}/report`, {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: {
        reason: parsed.data.reason,
        reissue: parsed.data.reissue === 'yes',
        ...(parsed.data.detail ? { detail: parsed.data.detail } : {}),
      },
    });
    revalidateTag('cards', 'max');
    // With a reissue the API returns the replacement card; without one it returns the old card.
    const reissuedCardId = parsed.data.reissue === 'yes' ? card.id : null;
    return { error: null, saved: true, reissuedCardId };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'The report could not be submitted. Please try again.',
      saved: false,
      reissuedCardId: null,
    };
  }
}
