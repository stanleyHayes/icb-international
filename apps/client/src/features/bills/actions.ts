'use server';

import type { BillPayment, LinkedBill } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { randomUUID } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { draftToMoney, fieldErrorsFrom } from '@/features/form-money';
import { ApiError, api } from '@/lib/api';

export interface BillActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors: Record<string, string>;
  billId: string | null;
}

const IDLE: BillActionState = { status: 'idle', message: null, fieldErrors: {}, billId: null };

function failure(error: unknown, fallback: string): BillActionState {
  return { ...IDLE, status: 'error', message: error instanceof ApiError ? error.problem.detail : fallback };
}

const linkSchema = z.object({
  billerId: z.string().min(1, 'Choose a biller'),
  customerReference: z.string().min(1, 'Enter your reference with the biller').max(60),
  nickname: z.string().max(60).optional(),
});

export async function linkBillAction(
  _previous: BillActionState,
  formData: FormData,
): Promise<BillActionState> {
  const parsed = linkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...IDLE, status: 'error', fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const { nickname, ...rest } = parsed.data;
  try {
    const bill = await api<LinkedBill>('/bills', {
      method: 'POST',
      body: { ...rest, ...(nickname ? { nickname } : {}) },
    });
    revalidateTag('bills', 'max');
    return { ...IDLE, status: 'success', billId: bill.id };
  } catch (error) {
    return failure(error, 'The bill could not be linked. Please try again.');
  }
}

const paySchema = z.object({
  billId: z.string().min(1),
  fromAccountId: z.string().min(1, 'Choose an account to pay from'),
  amount: z.string().min(1, 'Enter an amount'),
  currency: z.string().length(3),
  scheduledFor: z.string().optional(),
});

export async function payBillAction(
  _previous: BillActionState,
  formData: FormData,
): Promise<BillActionState> {
  const parsed = paySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...IDLE, status: 'error', fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const amount = draftToMoney(parsed.data.amount, parsed.data.currency as CurrencyCode);
  if (!amount || amount.minorUnits <= 0) {
    return {
      ...IDLE,
      status: 'error',
      fieldErrors: { amount: 'Enter an amount such as 85.00' },
    };
  }

  try {
    await api<BillPayment>(`/bills/${parsed.data.billId}/pay`, {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: {
        billId: parsed.data.billId,
        fromAccountId: parsed.data.fromAccountId,
        amount,
        ...(parsed.data.scheduledFor ? { scheduledFor: parsed.data.scheduledFor } : {}),
      },
    });
    revalidateTag('bills', 'max');
    revalidateTag('accounts', 'max');
    return { ...IDLE, status: 'success', message: 'Payment sent', billId: parsed.data.billId };
  } catch (error) {
    return failure(error, 'The payment could not be made. Please try again.');
  }
}

const autopaySchema = z.object({
  billId: z.string().min(1),
  enabled: z.enum(['on', 'off']),
  fromAccountId: z.string().min(1, 'Choose an account to pay from'),
  strategy: z.enum(['full_balance', 'fixed_amount']),
  fixedAmount: z.string().optional(),
  daysBeforeDue: z.coerce.number().int().min(0).max(30),
  capAmount: z.string().optional(),
  currency: z.string().length(3),
});

export async function configureAutopayAction(
  _previous: BillActionState,
  formData: FormData,
): Promise<BillActionState> {
  const parsed = autopaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...IDLE, status: 'error', fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const form = parsed.data;
  const currency = form.currency as CurrencyCode;
  const fixedAmount = form.fixedAmount ? draftToMoney(form.fixedAmount, currency) : null;
  const capAmount = form.capAmount ? draftToMoney(form.capAmount, currency) : null;

  try {
    await api<LinkedBill>(`/bills/${form.billId}/autopay`, {
      method: 'PATCH',
      body: {
        enabled: form.enabled === 'on',
        fromAccountId: form.fromAccountId,
        strategy: form.strategy,
        daysBeforeDue: form.daysBeforeDue,
        ...(fixedAmount ? { fixedAmount } : {}),
        ...(capAmount ? { capAmount } : {}),
      },
    });
    revalidateTag('bills', 'max');
    return { ...IDLE, status: 'success', message: 'Autopay updated', billId: form.billId };
  } catch (error) {
    return failure(error, 'Autopay could not be updated. Please try again.');
  }
}

export async function unlinkBillAction(
  _previous: BillActionState,
  formData: FormData,
): Promise<BillActionState> {
  const billIdValue = formData.get('billId');
  const billId = typeof billIdValue === 'string' ? billIdValue : '';
  if (!billId) {
    return { ...IDLE, status: 'error', message: 'The bill could not be identified.' };
  }

  try {
    await api<void>(`/bills/${billId}`, { method: 'DELETE' });
    revalidateTag('bills', 'max');
    return { ...IDLE, status: 'success', message: 'unlinked' };
  } catch (error) {
    return failure(error, 'The bill could not be removed. Please try again.');
  }
}
