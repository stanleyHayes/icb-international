'use server';

import { randomUUID } from 'node:crypto';

import {
  manualPostingRequestSchema,
  setAccountStatusRequestSchema,
  setOverdraftRequestSchema,
} from '@icb/contracts';
import { getScale, type CurrencyCode } from '@icb/money';
import { revalidatePath } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface OpResult {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string>;
}

const REASON_MIN = 4;

function ok(message: string | null = null): OpResult {
  return { ok: true, message, fieldErrors: {} };
}

function failure(message: string | null, fieldErrors: Record<string, string> = {}): OpResult {
  return { ok: false, message, fieldErrors };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

function reasonError(reason: string, minimum: number = REASON_MIN): OpResult | null {
  return reason.trim().length < minimum
    ? failure(null, { reason: `Give a reason of at least ${minimum} characters.` })
    : null;
}

function refreshAccount(accountId: string): void {
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath('/approvals');
}

export interface StatusInput {
  accountId: string;
  status: string;
  reason: string;
}

/** Lifecycle transition — freeze, unfreeze, dormancy, administrative closure. */
export async function setAccountStatus(input: StatusInput): Promise<OpResult> {
  const parsed = setAccountStatusRequestSchema.safeParse({
    status: input.status,
    reason: input.reason,
  });
  if (!parsed.success) {
    return failure(null, { reason: 'Give a reason of at least 4 characters.' });
  }
  try {
    await api(`/admin/accounts/${input.accountId}/status`, { method: 'POST', body: parsed.data });
    refreshAccount(input.accountId);
    return ok('Status updated.');
  } catch (error) {
    return failure(errorMessage(error, 'The status could not be updated.'));
  }
}

export interface OverdraftInput {
  accountId: string;
  currency: CurrencyCode;
  minorUnits: number;
  reason: string;
}

/** Overdraft limit decision; the API state machine owns what the new limit implies. */
export async function setOverdraftLimit(input: OverdraftInput): Promise<OpResult> {
  const parsed = setOverdraftRequestSchema.safeParse({
    limit: {
      minorUnits: input.minorUnits,
      currency: input.currency,
      scale: getScale(input.currency),
    },
    reason: input.reason,
  });
  if (!parsed.success) {
    return failure(null, { reason: 'Give a reason of at least 4 characters.' });
  }
  try {
    await api(`/admin/accounts/${input.accountId}/overdraft`, {
      method: 'POST',
      body: parsed.data,
    });
    refreshAccount(input.accountId);
    return ok('Overdraft limit updated.');
  } catch (error) {
    return failure(errorMessage(error, 'The overdraft limit could not be updated.'));
  }
}

export interface ProductChangeInput {
  accountId: string;
  productCode: string;
  reason: string;
}

/** Move the account to a different product. Reason is mandatory — this rewrites terms. */
export async function changeProduct(input: ProductChangeInput): Promise<OpResult> {
  const invalid = reasonError(input.reason);
  if (invalid) return invalid;
  try {
    await api(`/admin/accounts/${input.accountId}/product`, {
      method: 'POST',
      body: { productCode: input.productCode, reason: input.reason },
    });
    refreshAccount(input.accountId);
    return ok('Product change submitted.');
  } catch (error) {
    return failure(errorMessage(error, 'The product change could not be submitted.'));
  }
}

export interface InterestOverrideInput {
  accountId: string;
  /** Annual nominal rate as a percentage; `null` clears the override back to the product rate. */
  rate: number | null;
  reason: string;
}

export async function setInterestOverride(input: InterestOverrideInput): Promise<OpResult> {
  const invalid = reasonError(input.reason);
  if (invalid) return invalid;
  if (input.rate !== null && (input.rate < 0 || input.rate > 100)) {
    return failure(null, { rate: 'Enter a rate between 0 and 100.' });
  }
  try {
    await api(`/admin/accounts/${input.accountId}/interest-override`, {
      method: 'POST',
      body: { rate: input.rate, reason: input.reason },
    });
    refreshAccount(input.accountId);
    return ok(input.rate === null ? 'Interest override cleared.' : 'Interest override applied.');
  } catch (error) {
    return failure(errorMessage(error, 'The interest override could not be applied.'));
  }
}

export interface HoldExpireInput {
  accountId: string;
  holdId: string;
  reason: string;
}

/** Release a hold before its natural expiry — for example a merchant who abandoned a sale. */
export async function forceExpireHold(input: HoldExpireInput): Promise<OpResult> {
  const invalid = reasonError(input.reason);
  if (invalid) return invalid;
  try {
    await api(`/admin/accounts/${input.accountId}/holds/${input.holdId}/force-expire`, {
      method: 'POST',
      body: { reason: input.reason },
    });
    refreshAccount(input.accountId);
    return ok('Hold released.');
  } catch (error) {
    return failure(errorMessage(error, 'The hold could not be released.'));
  }
}

export interface ManualPostingInput {
  accountId: string;
  currency: CurrencyCode;
  direction: 'debit' | 'credit';
  minorUnits: number;
  contraAccountCode: string;
  description: string;
  reason: string;
}

/**
 * Manual credit/debit.
 *
 * A posting this powerful never takes effect on one operator's say-so: submitting it raises an
 * approval request, and a second operator's decision is what posts it. The idempotency key makes
 * a retried submission replay rather than duplicate (N6).
 */
export async function submitManualPosting(input: ManualPostingInput): Promise<OpResult> {
  const parsed = manualPostingRequestSchema.safeParse({
    accountId: input.accountId,
    direction: input.direction,
    amount: {
      minorUnits: input.minorUnits,
      currency: input.currency,
      scale: getScale(input.currency),
    },
    contraAccountCode: input.contraAccountCode,
    description: input.description,
    reason: input.reason,
  });
  if (!parsed.success) {
    return failure(
      null,
      Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    );
  }
  try {
    await api('/admin/postings', {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: randomUUID(),
    });
    revalidatePath('/approvals');
    return ok('Submitted. A second operator must approve it before it posts.');
  } catch (error) {
    return failure(errorMessage(error, 'The posting could not be submitted.'));
  }
}
