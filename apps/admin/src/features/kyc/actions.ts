'use server';

import { kycDecisionRequestSchema } from '@icb/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface DecisionState {
  status: 'idle' | 'error' | 'decided';
  message: string | null;
  fieldErrors: Record<string, string>;
}

/**
 * Record a KYC decision.
 *
 * The reason is mandatory and validated by the shared schema, not by this form: a decision that
 * changes what a customer is allowed to do with their money has to carry its justification into
 * the audit trail, and the API is where that is enforced.
 */
export async function decideAction(
  _previous: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const caseId = String(formData.get('caseId') ?? '');
  const grantedLevel = formData.get('grantedLevel');

  const parsed = kycDecisionRequestSchema.safeParse({
    outcome: formData.get('outcome'),
    reason: formData.get('reason'),
    ...(grantedLevel ? { grantedLevel } : {}),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: null,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    };
  }

  try {
    await api(`/kyc/cases/${caseId}/decision`, { method: 'POST', body: parsed.data });
    revalidatePath(`/kyc/${caseId}`);
    revalidatePath('/kyc');
    return { status: 'decided', message: null, fieldErrors: {} };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof ApiError
          ? error.problem.detail
          : 'The decision could not be recorded. Please try again.',
      fieldErrors: {},
    };
  }
}
