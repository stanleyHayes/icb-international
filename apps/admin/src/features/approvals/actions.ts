'use server';

import { decideApprovalRequestSchema } from '@icb/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError } from '@/lib/api';
import { decideApproval } from '@/features/approvals/api';

export interface DecisionResult {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string>;
}

export interface DecideInput {
  approvalId: string;
  decision: 'approve' | 'reject';
  reason: string;
}

function failure(message: string | null, fieldErrors: Record<string, string> = {}): DecisionResult {
  return { ok: false, message, fieldErrors };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

function validate(input: DecideInput) {
  const parsed = decideApprovalRequestSchema.safeParse({
    decision: input.decision,
    reason: input.reason,
  });
  if (parsed.success) {
    return { data: parsed.data, fieldErrors: null };
  }
  const fieldErrors = Object.fromEntries(
    parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
  );
  return { data: null, fieldErrors };
}

/**
 * Record an approve/reject decision.
 *
 * Four-eyes is a server-side control (the maker can never decide), but the reason is validated
 * here too so a malformed submission never reaches the API.
 */
export async function decide(input: DecideInput): Promise<DecisionResult> {
  const { data, fieldErrors } = validate(input);
  if (!data) {
    return failure(null, fieldErrors ?? {});
  }

  try {
    await decideApproval(input.approvalId, data);
    revalidatePath('/approvals');
    revalidatePath(`/approvals/${input.approvalId}`);
    return { ok: true, message: null, fieldErrors: {} };
  } catch (error) {
    return failure(errorMessage(error, 'The decision could not be recorded. Please try again.'));
  }
}
