'use server';

import type { LoanApplication, LoanDetail, LoanQuote } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { randomUUID } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { draftToMoney, fieldErrorsFrom } from '@/features/form-money';
import { ApiError, api } from '@/lib/api';

export interface QuoteResult {
  quote: LoanQuote | null;
  error: string | null;
}

/**
 * The eligibility check: an indicative quote for an amount and term against a product. It runs
 * the pricing engine without leaving any application behind — browsing should be free.
 */
export async function quoteLoanAction(input: {
  productCode: string;
  amountDraft: string;
  termMonths: number;
  currency: string;
}): Promise<QuoteResult> {
  const amount = draftToMoney(input.amountDraft, input.currency as CurrencyCode);
  if (!amount || amount.minorUnits <= 0) {
    return { quote: null, error: 'Enter an amount such as 5000.00' };
  }
  if (!Number.isInteger(input.termMonths) || input.termMonths < 1 || input.termMonths > 480) {
    return { quote: null, error: 'Choose a term between 1 and 480 months.' };
  }

  try {
    const quote = await api<LoanQuote>('/loans/quote', {
      method: 'POST',
      body: { productCode: input.productCode, amount, termMonths: input.termMonths },
    });
    return { quote, error: null };
  } catch (error) {
    return {
      quote: null,
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'A quote could not be produced for those figures.',
    };
  }
}

export interface ApplyState {
  error: string | null;
  fieldErrors: Record<string, string>;
  applicationId: string | null;
}

const applySchema = z.object({
  productCode: z.string().min(1),
  amount: z.string().min(1, 'Enter an amount'),
  currency: z.string().length(3),
  termMonths: z.coerce.number().int().positive().max(480),
  purpose: z.enum([
    'home_improvement',
    'debt_consolidation',
    'vehicle',
    'education',
    'medical',
    'business',
    'travel',
    'other',
  ]),
  purposeDetail: z.string().max(500).optional(),
  disbursementAccountId: z.string().min(1, 'Choose where the money goes'),
  repaymentAccountId: z.string().min(1, 'Choose the account repayments come from'),
  declaredMonthlyIncome: z.string().min(1, 'Enter your monthly income'),
  declaredMonthlyExpenses: z.string().min(1, 'Enter your monthly expenses'),
  existingCommitments: z.string().min(1, 'Enter your existing loan commitments, or 0'),
});

export async function applyForLoanAction(
  _previous: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const parsed = applySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFrom(parsed.error.issues), applicationId: null };
  }

  const form = parsed.data;
  const currency = form.currency as CurrencyCode;
  const moneyFields = {
    amount: draftToMoney(form.amount, currency),
    declaredMonthlyIncome: draftToMoney(form.declaredMonthlyIncome, currency),
    declaredMonthlyExpenses: draftToMoney(form.declaredMonthlyExpenses, currency),
    existingCommitments: draftToMoney(form.existingCommitments, currency),
  };
  if (Object.values(moneyFields).some((value) => value === null)) {
    return {
      error: 'Enter amounts such as 2500.00.',
      fieldErrors: {},
      applicationId: null,
    };
  }

  try {
    const application = await api<LoanApplication>('/loans/applications', {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: {
        productCode: form.productCode,
        termMonths: form.termMonths,
        purpose: form.purpose,
        disbursementAccountId: form.disbursementAccountId,
        repaymentAccountId: form.repaymentAccountId,
        ...moneyFields,
        ...(form.purposeDetail ? { purposeDetail: form.purposeDetail } : {}),
      },
    });
    revalidateTag('loans', 'max');
    return { error: null, fieldErrors: {}, applicationId: application.id };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'The application could not be submitted. Please try again.',
      fieldErrors: {},
      applicationId: null,
    };
  }
}

export interface LoanActionState {
  error: string | null;
  saved: boolean;
}

/** Accept an approved offer before it expires; accepting is what turns an offer into a loan. */
export async function acceptOfferAction(
  _previous: LoanActionState,
  formData: FormData,
): Promise<LoanActionState> {
  const applicationIdValue = formData.get('applicationId');
  const applicationId = typeof applicationIdValue === 'string' ? applicationIdValue : '';
  if (!applicationId) {
    return { error: 'The application could not be identified.', saved: false };
  }

  try {
    await api<LoanApplication>(`/loans/applications/${applicationId}/accept`, {
      method: 'POST',
      idempotencyKey: randomUUID(),
    });
    revalidateTag('loans', 'max');
    return { error: null, saved: true };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'The offer could not be accepted. Please try again.',
      saved: false,
    };
  }
}

const repaySchema = z.object({
  loanId: z.string().min(1),
  fromAccountId: z.string().min(1, 'Choose an account to pay from'),
  amount: z.string().min(1, 'Enter an amount'),
  currency: z.string().length(3),
  kind: z.enum(['scheduled', 'extra', 'payoff']),
});

/** A repayment: the scheduled instalment, an extra principal reduction, or a full payoff. */
export async function makeRepaymentAction(
  _previous: LoanActionState,
  formData: FormData,
): Promise<LoanActionState> {
  const parsed = repaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the repayment.', saved: false };
  }

  const amount = draftToMoney(parsed.data.amount, parsed.data.currency as CurrencyCode);
  if (!amount || amount.minorUnits <= 0) {
    return { error: 'Enter an amount such as 250.00.', saved: false };
  }

  try {
    await api<LoanDetail>(`/loans/${parsed.data.loanId}/repayments`, {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: { fromAccountId: parsed.data.fromAccountId, amount, kind: parsed.data.kind },
    });
    revalidateTag('loans', 'max');
    revalidateTag('accounts', 'max');
    return { error: null, saved: true };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.problem.detail
          : 'The repayment could not be made. Please try again.',
      saved: false,
    };
  }
}
