'use server';

import type { BankDocument, Statement } from '@icb/contracts';
import { revalidateTag } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface DocumentActionState {
  error: string | null;
  done: boolean;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

/**
 * Issues a balance confirmation or banker's reference letter. The API renders and files the
 * letter immediately, so the documents list is invalidated rather than the response being
 * stitched into local state.
 */
export async function issueLetterAction(
  _previous: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const kind = formData.get('kind');
  const accountId = formData.get('accountId');
  const addressedTo = formData.get('addressedTo');

  if (kind !== 'balance_letter' && kind !== 'reference_letter') {
    return { error: 'Choose the kind of letter you need.', done: false };
  }
  if (kind === 'balance_letter' && typeof accountId !== 'string') {
    return { error: 'A balance confirmation needs the account it confirms.', done: false };
  }

  try {
    await api<BankDocument>('/documents/letters', {
      method: 'POST',
      body: {
        kind,
        ...(typeof accountId === 'string' && accountId !== '' ? { accountId } : {}),
        ...(typeof addressedTo === 'string' && addressedTo.trim() !== ''
          ? { addressedTo: addressedTo.trim() }
          : {}),
      },
      idempotencyKey: crypto.randomUUID(),
    });
    revalidateTag('documents', 'max');
    return { error: null, done: true };
  } catch (error) {
    return { error: errorMessage(error, 'We could not issue that letter. Please try again.'), done: false };
  }
}

/**
 * Generates a statement for an arbitrary window. Statements are generated synchronously by the
 * API and then listed, so the tag is invalidated and the new row appears on the next render.
 */
export async function generateStatementAction(
  _previous: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const accountId = formData.get('accountId');
  const from = formData.get('from');
  const to = formData.get('to');

  if (typeof accountId !== 'string' || typeof from !== 'string' || typeof to !== 'string') {
    return { error: 'Choose an account and a start and end date.', done: false };
  }
  if (from === '' || to === '' || from > to) {
    return { error: 'The start date must be before the end date.', done: false };
  }

  try {
    await api<Statement>('/statements/generate', {
      method: 'POST',
      body: { accountId, from, to },
      idempotencyKey: crypto.randomUUID(),
    });
    revalidateTag('documents', 'max');
    return { error: null, done: true };
  } catch (error) {
    return {
      error: errorMessage(error, 'We could not generate that statement. Please try again.'),
      done: false,
    };
  }
}
