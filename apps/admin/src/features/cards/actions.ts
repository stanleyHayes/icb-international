'use server';

import {
  currencySchema,
  issueCardRequestSchema,
  updateCardLimitsRequestSchema,
} from '@icb/contracts';
import { getCurrency, type CurrencyCode } from '@icb/money';
import { revalidatePath } from 'next/cache';

import { ApiError, api } from '@/lib/api';

import {
  CARD_PATHS,
  blockCardRequestSchema,
  expireHoldRequestSchema,
  reissueCardRequestSchema,
} from './cards.constants';

export interface CardActionState {
  status: 'idle' | 'error' | 'done';
  message: string | null;
  fieldErrors: Record<string, string>;
}

const IDLE: CardActionState = { status: 'idle', message: null, fieldErrors: {} };

function fieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return Object.fromEntries(error.issues.map((i) => [i.path.map(String).join('.'), i.message]));
}

function failure(error: unknown, fallback: string): CardActionState {
  return {
    status: 'error',
    message: error instanceof ApiError ? error.problem.detail : fallback,
    fieldErrors: {},
  };
}

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value : '';
}

/**
 * Money arrives from MoneyInput as integer minor units in a hidden field — never a float.
 * `undefined` means the field was left blank; `null` means it held something unparseable.
 */
function moneyField(formData: FormData, field: string, currency: CurrencyCode) {
  const raw = text(formData, field);
  if (raw === '') return undefined;
  const minorUnits = Number(raw);
  if (!Number.isSafeInteger(minorUnits)) return null;
  return { minorUnits, currency, scale: getCurrency(currency).scale };
}

export async function issueCardAction(
  _previous: CardActionState,
  formData: FormData,
): Promise<CardActionState> {
  const nickname = text(formData, 'nickname').trim();
  const parsed = issueCardRequestSchema.safeParse({
    accountId: text(formData, 'accountId'),
    kind: text(formData, 'kind'),
    network: text(formData, 'network'),
    ...(nickname ? { nickname } : {}),
  });
  if (!parsed.success) return { ...IDLE, status: 'error', fieldErrors: fieldErrors(parsed.error) };

  try {
    const card = await api<{ panLast4: string }>(CARD_PATHS.issue, {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath('/cards');
    return { status: 'done', message: `Card issued (…${card.panLast4}).`, fieldErrors: {} };
  } catch (error) {
    return failure(error, 'The card could not be issued. Please try again.');
  }
}

export async function blockCardAction(
  _previous: CardActionState,
  formData: FormData,
): Promise<CardActionState> {
  const cardId = text(formData, 'cardId');
  const parsed = blockCardRequestSchema.safeParse({ reason: text(formData, 'reason').trim() });
  if (!parsed.success) return { ...IDLE, status: 'error', fieldErrors: fieldErrors(parsed.error) };

  try {
    await api(CARD_PATHS.block(cardId), {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath(`/cards/${cardId}`);
    revalidatePath('/cards');
    return { status: 'done', message: 'Card blocked.', fieldErrors: {} };
  } catch (error) {
    return failure(error, 'The card could not be blocked. Please try again.');
  }
}

export async function reissueCardAction(
  _previous: CardActionState,
  formData: FormData,
): Promise<CardActionState> {
  const cardId = text(formData, 'cardId');
  const parsed = reissueCardRequestSchema.safeParse({
    reason: text(formData, 'reason'),
    detail: text(formData, 'detail').trim(),
  });
  if (!parsed.success) return { ...IDLE, status: 'error', fieldErrors: fieldErrors(parsed.error) };

  try {
    await api(CARD_PATHS.reissue(cardId), {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath(`/cards/${cardId}`);
    revalidatePath('/cards');
    return { status: 'done', message: 'Replacement card ordered.', fieldErrors: {} };
  } catch (error) {
    return failure(error, 'The card could not be reissued. Please try again.');
  }
}

export async function pinResetAction(
  _previous: CardActionState,
  formData: FormData,
): Promise<CardActionState> {
  const cardId = text(formData, 'cardId');
  try {
    await api(CARD_PATHS.pinReset(cardId), {
      method: 'POST',
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath(`/cards/${cardId}`);
    return {
      status: 'done',
      message: 'PIN reset started — the customer sets the new PIN themselves.',
      fieldErrors: {},
    };
  } catch (error) {
    return failure(error, 'The PIN reset could not be started. Please try again.');
  }
}

const LIMIT_FIELDS = ['perTransaction', 'daily', 'monthly', 'atmDaily', 'contactless'] as const;

export async function updateLimitsAction(
  _previous: CardActionState,
  formData: FormData,
): Promise<CardActionState> {
  const cardId = text(formData, 'cardId');
  const currency = currencySchema.safeParse(text(formData, 'currency'));
  if (!currency.success) {
    return { ...IDLE, status: 'error', message: 'The card currency could not be determined.' };
  }

  const body: Record<string, unknown> = {};
  for (const field of LIMIT_FIELDS) {
    const value = moneyField(formData, field, currency.data);
    if (value === null) {
      return { ...IDLE, status: 'error', fieldErrors: { [field]: 'Enter a whole amount' } };
    }
    if (value !== undefined) body[field] = value;
  }

  const parsed = updateCardLimitsRequestSchema.safeParse(body);
  if (!parsed.success) return { ...IDLE, status: 'error', fieldErrors: fieldErrors(parsed.error) };

  try {
    await api(CARD_PATHS.limits(cardId), { method: 'PATCH', body: parsed.data });
    revalidatePath(`/cards/${cardId}`);
    return { status: 'done', message: 'Limits updated.', fieldErrors: {} };
  } catch (error) {
    return failure(error, 'The limits could not be updated. Please try again.');
  }
}

export async function expireHoldAction(
  _previous: CardActionState,
  formData: FormData,
): Promise<CardActionState> {
  const cardId = text(formData, 'cardId');
  const authorisationId = text(formData, 'authorisationId');
  const parsed = expireHoldRequestSchema.safeParse({ reason: text(formData, 'reason').trim() });
  if (!parsed.success) return { ...IDLE, status: 'error', fieldErrors: fieldErrors(parsed.error) };

  try {
    await api(CARD_PATHS.expireAuthorisation(cardId, authorisationId), {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath(`/cards/${cardId}`);
    return { status: 'done', message: 'Hold expired — funds released.', fieldErrors: {} };
  } catch (error) {
    return failure(error, 'The hold could not be expired. Please try again.');
  }
}
