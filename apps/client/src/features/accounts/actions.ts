'use server';

import type { AccountDetail, DownloadLink } from '@icb/contracts';
import { revalidateTag } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface AccountActionState {
  error: string | null;
  done: boolean;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

/** Reads a form field as a string; a File (or an absent field) reads as empty. */
function fieldValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/** Renames an account. An empty nickname clears it and the product name shows instead. */
export async function updateNickname(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const accountId = fieldValue(formData, 'accountId');
  const nickname = fieldValue(formData, 'nickname').trim();

  try {
    await api<AccountDetail>(`/accounts/${accountId}`, {
      method: 'PATCH',
      body: { nickname: nickname === '' ? null : nickname.slice(0, 60) },
    });
    revalidateTag('accounts', 'max');
    return { error: null, done: true };
  } catch (error) {
    return { error: errorMessage(error, 'We could not rename the account. Please try again.'), done: false };
  }
}

/**
 * Asks for the account to be frozen.
 *
 * Freezing is a privileged action the API reserves for staff, so the customer-facing flow is a
 * support request that lands in the account queue with everything the agent needs to act on it.
 */
export async function requestFreeze(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const accountId = fieldValue(formData, 'accountId');
  const label = fieldValue(formData, 'accountLabel') || 'account';
  const reason = fieldValue(formData, 'reason').trim();

  try {
    await api('/support/tickets', {
      method: 'POST',
      body: {
        subject: `Freeze request — ${label}`.slice(0, 160),
        category: 'account',
        body: `Please freeze account ${label} (${accountId}).\n\nReason: ${reason || 'Not given.'}`,
        attachments: [],
      },
    });
    return { error: null, done: true };
  } catch (error) {
    return { error: errorMessage(error, 'We could not send the request. Please try again.'), done: false };
  }
}

/** Closes the account, sweeping any residual balance to the chosen account. */
export async function closeAccount(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const accountId = fieldValue(formData, 'accountId');
  const reason = fieldValue(formData, 'reason').trim();
  const sweepTo = fieldValue(formData, 'sweepToAccountId');

  if (reason.length < 4) {
    return { error: 'Tell us briefly why you are closing the account.', done: false };
  }

  try {
    await api<AccountDetail>(`/accounts/${accountId}/close`, {
      method: 'POST',
      body: sweepTo ? { reason, sweepToAccountId: sweepTo } : { reason },
      idempotencyKey: crypto.randomUUID(),
    });
    revalidateTag('accounts', 'max');
    return { error: null, done: true };
  } catch (error) {
    return { error: errorMessage(error, 'We could not close the account. Please try again.'), done: false };
  }
}

/** A fresh signed download link for one statement, opened in a new tab by the caller. */
export async function statementDownloadLink(statementId: string): Promise<string | null> {
  try {
    const link = await api<DownloadLink>(`/statements/${statementId}/download`, {
      tags: ['documents'],
    });
    return link.url;
  } catch {
    return null;
  }
}
