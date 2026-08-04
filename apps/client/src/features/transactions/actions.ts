'use server';

import type { CursorPage, DownloadLink, TransactionDetail, TransactionSummary } from '@icb/contracts';
import { revalidateTag } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface TransactionActionState {
  error: string | null;
}

export interface ExportResult {
  error: string | null;
  /** Path on this app that streams the finished export. Null while error is set. */
  downloadPath: string | null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

/** Reads a form field as a string; a File (or an absent field) reads as empty. */
function fieldValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/** Next page of the transactions list, fetched with the same filters as the first. */
export async function loadMoreTransactions(
  queryString: string,
  cursor: string,
): Promise<CursorPage<TransactionSummary>> {
  const separator = queryString ? '&' : '';
  return api<CursorPage<TransactionSummary>>(
    `/transactions?${queryString}${separator}cursor=${encodeURIComponent(cursor)}`,
    { tags: ['transactions'] },
  );
}

/** Saves a note and tags against a transaction. Empty note clears it; tags replace wholesale. */
export async function annotateTransaction(
  _previous: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const transactionId = fieldValue(formData, 'transactionId');
  const noteRaw = fieldValue(formData, 'note').trim();
  const tags = fieldValue(formData, 'tags')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 10);

  try {
    await api<TransactionDetail>(`/transactions/${transactionId}`, {
      method: 'PATCH',
      body: { note: noteRaw === '' ? null : noteRaw.slice(0, 500), tags },
    });
    revalidateTag('transactions', 'max');
    return { error: null };
  } catch (error) {
    return { error: errorMessage(error, 'We could not save your changes. Please try again.') };
  }
}

/**
 * Requests an export and hands back the in-app path that streams it.
 *
 * The API answers with a signed link pointing at the API itself, which the browser cannot use —
 * it carries no bearer token. So the export id is lifted out of the link and the download is
 * proxied through a route handler on this app, which attaches the session token server-side.
 */
export async function exportTransactions(formData: FormData): Promise<ExportResult> {
  const input = parseExportInput(formData);
  if (typeof input === 'string') {
    return { error: input, downloadPath: null };
  }

  try {
    const link = await api<DownloadLink>('/transactions/exports', {
      method: 'POST',
      body: input,
      idempotencyKey: crypto.randomUUID(),
    });
    const exportId = exportIdFromUrl(link.url);
    if (!exportId) {
      return { error: 'The export link was not understood. Please try again.', downloadPath: null };
    }
    return { error: null, downloadPath: `/transactions/exports/${exportId}/download` };
  } catch (error) {
    return {
      error: errorMessage(error, 'We could not create the export. Please try again.'),
      downloadPath: null,
    };
  }
}

/** Validates the export form; returns the request body, or an error message to show. */
function parseExportInput(
  formData: FormData,
): { accountId: string; format: string; from: string; to: string } | string {
  const input = {
    accountId: fieldValue(formData, 'accountId'),
    format: fieldValue(formData, 'format'),
    from: fieldValue(formData, 'from'),
    to: fieldValue(formData, 'to'),
  };
  const valid = input.accountId && ['csv', 'ofx', 'pdf'].includes(input.format) && input.from && input.to;
  return valid ? input : 'Choose an account, a date range and a format.';
}

/** `/v1/transactions/exports/<id>/download` → `<id>`; null for anything unexpected. */
function exportIdFromUrl(url: string): string | null {
  const match = /\/transactions\/exports\/([^/]+)\/download/.exec(url);
  return match?.[1] ?? null;
}
