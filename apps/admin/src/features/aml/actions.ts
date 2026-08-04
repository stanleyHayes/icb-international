'use server';

import { fileReportRequestSchema, updateAmlAlertRequestSchema } from '@icb/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, api } from '@/lib/api';
import { readSession } from '@/lib/session';

export interface AmlActionState {
  status: 'idle' | 'error' | 'done';
  message: string | null;
  fieldErrors: Record<string, string>;
}

function errorState(error: unknown, fallback: string): AmlActionState {
  return {
    status: 'error',
    message: error instanceof ApiError ? error.problem.detail : fallback,
    fieldErrors: {},
  };
}

/**
 * Move an AML case: assign to the caller, change status, or save the narrative.
 *
 * Assignment always points at the session's staff member — the id comes from the sealed
 * session, never from the form, so a case cannot be assigned to somebody else by editing
 * a hidden input.
 */
export async function updateAlertAction(
  _previous: AmlActionState,
  formData: FormData,
): Promise<AmlActionState> {
  const alertIdValue = formData.get('alertId');
  const alertId = typeof alertIdValue === 'string' ? alertIdValue : '';
  const intent = formData.get('intent');

  const draft: Record<string, unknown> = {};
  if (intent === 'assign') {
    const session = await readSession();
    if (!session) {
      return errorState(null, 'Your session has expired. Sign in again.');
    }
    draft.assignedTo = session.user.userId;
  } else if (intent === 'status') {
    draft.status = formData.get('status');
  } else {
    draft.narrative = formData.get('narrative');
  }

  const parsed = updateAmlAlertRequestSchema.safeParse(draft);
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
    await api(`/admin/aml/alerts/${alertId}`, { method: 'PATCH', body: parsed.data });
    revalidatePath(`/aml/${alertId}`);
    revalidatePath('/aml');
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The case could not be updated. Please try again.');
  }
}

/**
 * File a SAR or CTR draft against an alert.
 *
 * Idempotent on the API side; the narrative minimum (50 characters) is the contract's, because
 * a filing that does not explain itself is not a filing.
 */
export async function fileReportAction(
  _previous: AmlActionState,
  formData: FormData,
): Promise<AmlActionState> {
  const alertIdValue = formData.get('alertId');
  const alertId = typeof alertIdValue === 'string' ? alertIdValue : '';

  const parsed = fileReportRequestSchema.safeParse({
    kind: formData.get('kind'),
    narrative: formData.get('narrative'),
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
    await api(`/admin/aml/alerts/${alertId}/reports`, {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath(`/aml/${alertId}`);
    revalidatePath('/aml');
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The report could not be filed. Please try again.');
  }
}
