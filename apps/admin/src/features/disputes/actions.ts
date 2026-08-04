'use server';

import { advanceDisputeRequestSchema } from '@icb/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface DisputeActionState {
  status: 'idle' | 'error' | 'done';
  message: string | null;
  fieldErrors: Record<string, string>;
}

/**
 * Advance a dispute to its next stage.
 *
 * This is the action that grants provisional credit and settles outcomes, so the note is
 * mandatory — the contract enforces it, and the API attributes the move to the session's
 * staff member, never to a form field.
 */
export async function advanceDisputeAction(
  _previous: DisputeActionState,
  formData: FormData,
): Promise<DisputeActionState> {
  const disputeIdValue = formData.get('disputeId');
  const disputeId = typeof disputeIdValue === 'string' ? disputeIdValue : '';
  const outcome = formData.get('outcome');

  const parsed = advanceDisputeRequestSchema.safeParse({
    stage: formData.get('stage'),
    note: formData.get('note'),
    ...(typeof outcome === 'string' && outcome ? { outcome } : {}),
    ...(formData.get('grantProvisionalCredit') === 'on'
      ? { grantProvisionalCredit: true }
      : {}),
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
    await api(`/disputes/${disputeId}/advance`, { method: 'POST', body: parsed.data });
    revalidatePath(`/disputes/${disputeId}`);
    revalidatePath('/disputes');
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof ApiError
          ? error.problem.detail
          : 'The dispute could not be advanced. Please try again.',
      fieldErrors: {},
    };
  }
}
