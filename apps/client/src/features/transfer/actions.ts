'use server';

import type { TransferSummary } from '@icb/contracts';
import { getScale, type CurrencyCode } from '@icb/money';
import { randomUUID } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { ApiError, api } from '@/lib/api';

export interface TransferState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  transfer: TransferSummary | null;
  fieldErrors: Record<string, string>;
}

/** Local idle state. A 'use server' module may only *export* async functions. */
const IDLE: TransferState = { status: 'idle', message: null, transfer: null, fieldErrors: {} };

/**
 * Amounts arrive from the form as decimal strings and are parsed to integer minor units here,
 * on the server, before they touch anything. Parsing at the boundary is what keeps floating
 * point out of the money path entirely (agent_plan.md N3).
 */
const formSchema = z.object({
  fromAccountId: z.string().min(1, 'Choose an account to send from'),
  destinationKind: z.enum(['own_account', 'icb_customer']),
  toAccountId: z.string().optional(),
  toAccountNumber: z.string().optional(),
  amount: z
    .string()
    .min(1, 'Enter an amount')
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount such as 250.00'),
  currency: z.string().length(3),
  reference: z.string().max(140).optional(),
});

export async function createTransferAction(
  _previous: TransferState,
  formData: FormData,
): Promise<TransferState> {
  const parsed = formSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ...IDLE,
      status: 'error',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    };
  }

  const form = parsed.data;
  const currency = form.currency as CurrencyCode;
  const destination = buildDestination(form);

  if (!destination) {
    return {
      ...IDLE,
      status: 'error',
      fieldErrors: { toAccountNumber: 'Choose or enter a destination account' },
    };
  }

  try {
    const transfer = await api<TransferSummary>('/transfers', {
      method: 'POST',
      // A fresh key per submission: a network retry replays safely, a second deliberate transfer
      // is a new instruction and gets a new key.
      idempotencyKey: randomUUID(),
      body: {
        fromAccountId: form.fromAccountId,
        destination,
        amount: {
          minorUnits: toMinorUnits(form.amount, currency),
          currency,
          scale: getScale(currency),
        },
        ...(form.reference ? { reference: form.reference } : {}),
        saveBeneficiary: false,
      },
    });

    // Balances, the statement, and the transfer list all changed; invalidate exactly those.
    revalidateTag('accounts', 'max');
    revalidateTag('transactions', 'max');
    revalidateTag('transfers', 'max');

    return { status: 'success', message: null, transfer, fieldErrors: {} };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ...IDLE, status: 'error', message: error.problem.detail };
    }
    return {
      ...IDLE,
      status: 'error',
      message: 'The transfer could not be completed. Please try again.',
    };
  }
}

function buildDestination(form: z.infer<typeof formSchema>) {
  if (form.destinationKind === 'own_account' && form.toAccountId) {
    return { kind: 'own_account' as const, accountId: form.toAccountId };
  }
  if (form.destinationKind === 'icb_customer' && form.toAccountNumber) {
    return { kind: 'icb_customer' as const, accountNumber: form.toAccountNumber };
  }
  return null;
}

/** Digit-string to minor units. No float ever appears. */
function toMinorUnits(amount: string, currency: CurrencyCode): number {
  const scale = getScale(currency);
  const [whole = '0', fraction = ''] = amount.split('.');
  return Number(`${whole}${fraction.padEnd(scale, '0')}`);
}
