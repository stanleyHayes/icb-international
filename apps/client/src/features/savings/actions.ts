'use server';

import type { SavingsGoal, TermDeposit } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { randomUUID } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { draftToMoney, fieldErrorsFrom } from '@/features/form-money';
import { ApiError, api } from '@/lib/api';

export interface SavingsActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors: Record<string, string>;
  id: string | null;
}

const IDLE: SavingsActionState = { status: 'idle', message: null, fieldErrors: {}, id: null };

function failure(error: unknown, fallback: string): SavingsActionState {
  return {
    ...IDLE,
    status: 'error',
    message: error instanceof ApiError ? error.problem.detail : fallback,
  };
}

const goalSchema = z.object({
  accountId: z.string().min(1, 'Choose the account this goal saves into'),
  name: z.string().min(1, 'Name the goal').max(80),
  icon: z.string().max(40).default('target'),
  target: z.string().min(1, 'Set a target amount'),
  currency: z.string().length(3),
  targetDate: z.string().optional(),
  roundUpsEnabled: z.enum(['on', 'off']).default('off'),
  autoAmount: z.string().optional(),
  autoFrequency: z.enum(['weekly', 'fortnightly', 'monthly']).default('monthly'),
  autoFromAccountId: z.string().optional(),
});

export async function createGoalAction(
  _previous: SavingsActionState,
  formData: FormData,
): Promise<SavingsActionState> {
  const parsed = goalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...IDLE, status: 'error', fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const form = parsed.data;
  const currency = form.currency as CurrencyCode;
  const target = draftToMoney(form.target, currency);
  if (!target || target.minorUnits <= 0) {
    return { ...IDLE, status: 'error', fieldErrors: { target: 'Enter an amount such as 2000.00' } };
  }

  const autoAmount = form.autoAmount ? draftToMoney(form.autoAmount, currency) : null;
  const autoContribution =
    autoAmount && form.autoFromAccountId
      ? { amount: autoAmount, frequency: form.autoFrequency, fromAccountId: form.autoFromAccountId }
      : undefined;

  try {
    const goal = await api<SavingsGoal>('/savings/goals', {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: {
        accountId: form.accountId,
        name: form.name,
        icon: form.icon,
        target,
        roundUpsEnabled: form.roundUpsEnabled === 'on',
        ...(form.targetDate ? { targetDate: form.targetDate } : {}),
        ...(autoContribution ? { autoContribution } : {}),
      },
    });
    revalidateTag('savings', 'max');
    return { ...IDLE, status: 'success', id: goal.id };
  } catch (error) {
    return failure(error, 'The goal could not be created. Please try again.');
  }
}

const contributeSchema = z.object({
  goalId: z.string().min(1),
  fromAccountId: z.string().min(1, 'Choose an account to move money from'),
  amount: z.string().min(1, 'Enter an amount'),
  currency: z.string().length(3),
});

/** Move money into a goal. Real funds: the source account is debited, the goal account credited. */
export async function contributeAction(
  _previous: SavingsActionState,
  formData: FormData,
): Promise<SavingsActionState> {
  const parsed = contributeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...IDLE, status: 'error', fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const amount = draftToMoney(parsed.data.amount, parsed.data.currency as CurrencyCode);
  if (!amount || amount.minorUnits <= 0) {
    return { ...IDLE, status: 'error', fieldErrors: { amount: 'Enter an amount such as 50.00' } };
  }

  try {
    await api<SavingsGoal>(`/savings/goals/${parsed.data.goalId}/contribute`, {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: { fromAccountId: parsed.data.fromAccountId, amount },
    });
    revalidateTag('savings', 'max');
    revalidateTag('accounts', 'max');
    return { ...IDLE, status: 'success', message: 'Added to the goal', id: parsed.data.goalId };
  } catch (error) {
    return failure(error, 'The contribution could not be made. Please try again.');
  }
}

const updateGoalSchema = z.object({
  goalId: z.string().min(1),
  intent: z.enum(['roundups', 'pause', 'resume', 'cancel']),
  roundUpsEnabled: z.enum(['on', 'off']).optional(),
});

/** Round-up switching and lifecycle: pause, resume, cancel. */
export async function updateGoalAction(
  _previous: SavingsActionState,
  formData: FormData,
): Promise<SavingsActionState> {
  const parsed = updateGoalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...IDLE, status: 'error', message: 'The change could not be read.' };
  }

  const { goalId, intent, roundUpsEnabled } = parsed.data;
  try {
    if (intent === 'cancel') {
      await api<void>(`/savings/goals/${goalId}`, { method: 'DELETE' });
    } else {
      const body =
        intent === 'roundups'
          ? { roundUpsEnabled: roundUpsEnabled === 'on' }
          : { status: intent === 'pause' ? 'paused' : 'active' };
      await api<SavingsGoal>(`/savings/goals/${goalId}`, { method: 'PATCH', body });
    }
    revalidateTag('savings', 'max');
    return { ...IDLE, status: 'success', message: intent === 'cancel' ? 'deleted' : 'saved', id: goalId };
  } catch (error) {
    return failure(error, 'The goal could not be updated. Please try again.');
  }
}

const depositSchema = z.object({
  fromAccountId: z.string().min(1, 'Choose an account to fund the deposit from'),
  principal: z.string().min(1, 'Enter an amount'),
  currency: z.string().length(3),
  termMonths: z.coerce.number().int().positive().max(120),
  maturityInstruction: z.enum(['rollover_principal', 'rollover_all', 'transfer_out']),
  rolloverAccountId: z.string().optional(),
});

export async function openDepositAction(
  _previous: SavingsActionState,
  formData: FormData,
): Promise<SavingsActionState> {
  const parsed = depositSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...IDLE, status: 'error', fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const form = parsed.data;
  const principal = draftToMoney(form.principal, form.currency as CurrencyCode);
  if (!principal || principal.minorUnits <= 0) {
    return { ...IDLE, status: 'error', fieldErrors: { principal: 'Enter an amount such as 5000.00' } };
  }

  try {
    const deposit = await api<TermDeposit>('/savings/deposits', {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: {
        fromAccountId: form.fromAccountId,
        principal,
        termMonths: form.termMonths,
        maturityInstruction: form.maturityInstruction,
        ...(form.rolloverAccountId ? { rolloverAccountId: form.rolloverAccountId } : {}),
      },
    });
    revalidateTag('savings', 'max');
    revalidateTag('accounts', 'max');
    return { ...IDLE, status: 'success', id: deposit.id };
  } catch (error) {
    return failure(error, 'The deposit could not be opened. Please try again.');
  }
}

/** Execute the early break at the price already shown by the break quote. */
export async function breakDepositAction(
  _previous: SavingsActionState,
  formData: FormData,
): Promise<SavingsActionState> {
  const depositIdValue = formData.get('depositId');
  const depositId = typeof depositIdValue === 'string' ? depositIdValue : '';
  if (!depositId) {
    return { ...IDLE, status: 'error', message: 'The deposit could not be identified.' };
  }

  try {
    await api<TermDeposit>(`/savings/deposits/${depositId}/break`, {
      method: 'POST',
      idempotencyKey: randomUUID(),
    });
    revalidateTag('savings', 'max');
    revalidateTag('accounts', 'max');
    return { ...IDLE, status: 'success', message: 'Deposit broken', id: depositId };
  } catch (error) {
    return failure(error, 'The deposit could not be broken. Please try again.');
  }
}
