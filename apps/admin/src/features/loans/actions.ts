'use server';

import { currencySchema } from '@icb/contracts';
import { getCurrency, type CurrencyCode } from '@icb/money';
import { revalidatePath } from 'next/cache';

import { ApiError, api } from '@/lib/api';

import {
  LOAN_PATHS,
  restructureFormSchema,
  staffDecisionFormSchema,
  writeOffFormSchema,
} from './loans.constants';

export interface LoanActionState {
  status: 'idle' | 'error' | 'done';
  message: string | null;
  fieldErrors: Record<string, string>;
}

const IDLE: LoanActionState = { status: 'idle', message: null, fieldErrors: {} };

function fieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return Object.fromEntries(error.issues.map((i) => [i.path.map(String).join('.'), i.message]));
}

function failure(error: unknown, fallback: string): LoanActionState {
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

/** A percentage field arrives as a decimal string; an empty field means "leave it alone". */
function numberField(formData: FormData, field: string): number | undefined {
  const raw = text(formData, field).trim();
  if (raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
}

/** Money arrives from MoneyInput as integer minor units in a hidden field — never a float. */
function moneyField(formData: FormData, field: string, currency: CurrencyCode) {
  const raw = text(formData, field);
  if (raw === '') return undefined;
  const minorUnits = Number(raw);
  if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) return null;
  return { minorUnits, currency, scale: getCurrency(currency).scale };
}

/**
 * Record an underwriting decision.
 *
 * The scorecard's outcome is only a recommendation; whatever the underwriter records here is
 * attributed to them, carries its justification verbatim to the applicant, and is audited.
 */
export async function decideApplicationAction(
  _previous: LoanActionState,
  formData: FormData,
): Promise<LoanActionState> {
  const applicationId = text(formData, 'applicationId');
  const currency = currencySchema.safeParse(text(formData, 'currency'));
  if (!currency.success) {
    return { ...IDLE, status: 'error', message: 'The application currency could not be determined.' };
  }

  const amount = moneyField(formData, 'approvedAmount', currency.data);
  const rate = numberField(formData, 'approvedRate');
  const parsed = staffDecisionFormSchema.safeParse({
    outcome: text(formData, 'outcome'),
    justification: text(formData, 'justification').trim(),
    ...(amount ? { approvedAmount: amount } : {}),
    ...(rate !== undefined ? { approvedRate: rate } : {}),
  });
  if (!parsed.success) return { ...IDLE, status: 'error', fieldErrors: fieldErrors(parsed.error) };

  try {
    await api(LOAN_PATHS.decide(applicationId), {
      method: 'POST',
      body: {
        outcome: parsed.data.outcome,
        reasons: [parsed.data.justification],
        ...(parsed.data.approvedAmount ? { approvedAmount: parsed.data.approvedAmount } : {}),
        ...(parsed.data.approvedRate !== undefined ? { approvedRate: parsed.data.approvedRate } : {}),
      },
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath(`/loans/applications/${applicationId}`);
    revalidatePath('/loans');
    return { status: 'done', message: 'Decision recorded and attributed to you.', fieldErrors: {} };
  } catch (error) {
    return failure(error, 'The decision could not be recorded. Please try again.');
  }
}

export async function disburseLoanAction(
  _previous: LoanActionState,
  formData: FormData,
): Promise<LoanActionState> {
  const loanId = text(formData, 'loanId');
  try {
    await api(LOAN_PATHS.disburse(loanId), {
      method: 'POST',
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath(`/loans/${loanId}`);
    revalidatePath('/loans');
    return { status: 'done', message: 'Loan disbursed to the nominated account.', fieldErrors: {} };
  } catch (error) {
    return failure(error, 'The disbursement could not be completed. Please try again.');
  }
}

export async function restructureLoanAction(
  _previous: LoanActionState,
  formData: FormData,
): Promise<LoanActionState> {
  const loanId = text(formData, 'loanId');
  const termMonths = numberField(formData, 'termMonths');
  const rate = numberField(formData, 'rate');
  const parsed = restructureFormSchema.safeParse({
    ...(termMonths !== undefined ? { termMonths } : {}),
    ...(rate !== undefined ? { rate } : {}),
    reason: text(formData, 'reason').trim(),
  });
  if (!parsed.success) return { ...IDLE, status: 'error', fieldErrors: fieldErrors(parsed.error) };

  try {
    await api(LOAN_PATHS.restructure(loanId), {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath(`/loans/${loanId}`);
    revalidatePath('/loans');
    return { status: 'done', message: 'Loan restructured — a new schedule is in force.', fieldErrors: {} };
  } catch (error) {
    return failure(error, 'The loan could not be restructured. Please try again.');
  }
}

export async function writeOffLoanAction(
  _previous: LoanActionState,
  formData: FormData,
): Promise<LoanActionState> {
  const loanId = text(formData, 'loanId');
  const parsed = writeOffFormSchema.safeParse({ reason: text(formData, 'reason').trim() });
  if (!parsed.success) return { ...IDLE, status: 'error', fieldErrors: fieldErrors(parsed.error) };

  try {
    await api(LOAN_PATHS.writeOff(loanId), {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath(`/loans/${loanId}`);
    revalidatePath('/loans');
    return { status: 'done', message: 'Loan written off.', fieldErrors: {} };
  } catch (error) {
    return failure(error, 'The loan could not be written off. Please try again.');
  }
}
