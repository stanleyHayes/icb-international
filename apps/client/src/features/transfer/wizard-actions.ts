'use server';

import {
  transferQuoteRequestSchema,
  type TransferDetail,
  type TransferQuote,
} from '@icb/contracts';
import { randomUUID } from 'node:crypto';
import { revalidateTag } from 'next/cache';

import { ApiError, api } from '@/lib/api';

import { toWireMoney } from './destination';
import type {
  ActionResult,
  ConfirmInput,
  ConfirmOutput,
  QuoteInput,
  QuoteOutput,
} from './wizard/action-types';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

/**
 * Price a transfer without committing to it.
 *
 * The quote is single-use and short-lived; the wizard shows the customer the TTL countdown and
 * re-quotes rather than letting a stale rate through.
 */
export async function requestQuoteAction(input: QuoteInput): Promise<ActionResult<QuoteOutput>> {
  const body = {
    fromAccountId: input.fromAccountId,
    destination: input.destination,
    amount: toWireMoney(input.amountMinorUnits, input.currency),
    amountSide: 'debit' as const,
    rail: input.rail,
    ...(input.reference ? { reference: input.reference } : {}),
  };

  const parsed = transferQuoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: 'Some transfer details are incomplete. Check the form and try again.' };
  }

  try {
    const quote = await api<TransferQuote>('/transfers/quotes', {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: parsed.data,
    });
    return { ok: true, data: quote };
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'We could not price this transfer. Please try again.') };
  }
}

/**
 * Execute a quoted transfer.
 *
 * A fresh idempotency key per confirmation: a retried submission replays the same instruction,
 * a second deliberate send is a new one.
 */
export async function confirmTransferAction(
  input: ConfirmInput,
): Promise<ActionResult<ConfirmOutput>> {
  try {
    const transfer = await api<TransferDetail>('/transfers', {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: {
        quoteId: input.quoteId,
        fromAccountId: input.fromAccountId,
        destination: input.destination,
        amount: toWireMoney(input.amountMinorUnits, input.currency),
        ...(input.reference ? { reference: input.reference } : {}),
        ...(input.schedule ? { schedule: input.schedule } : {}),
        saveBeneficiary: input.saveBeneficiary,
      },
    });

    if (input.templateName) {
      await saveTemplateQuietly(input);
    }

    revalidateTag('accounts', 'max');
    revalidateTag('transactions', 'max');
    revalidateTag('transfers', 'max');
    revalidateTag('beneficiaries', 'max');

    return { ok: true, data: { transfer } };
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'The transfer could not be completed. Please try again.') };
  }
}

/** Template saving is best-effort: it must never fail a transfer that already succeeded. */
async function saveTemplateQuietly(input: ConfirmInput): Promise<void> {
  try {
    await api('/transfer-templates', {
      method: 'POST',
      body: {
        name: input.templateName,
        fromAccountId: input.fromAccountId,
        destination: input.destination,
        amount: toWireMoney(input.amountMinorUnits, input.currency),
        ...(input.reference ? { reference: input.reference } : {}),
      },
    });
    revalidateTag('transfer-templates', 'max');
  } catch {
    // Deliberately swallowed — the receipt reports the transfer, not the template.
  }
}
