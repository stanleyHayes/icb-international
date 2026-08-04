'use server';

import { decideApprovalRequestSchema } from '@icb/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError } from '@/lib/api';
import {
  decideApproval,
  requestDecisionChallenge,
  verifyDecisionChallenge,
} from '@/features/approvals/api';

export interface ChallengeView {
  id: string;
  method: string;
  hint: string | null;
}

export interface DecisionResult {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string>;
  challenge: ChallengeView | null;
}

export interface DecideInput {
  approvalId: string;
  decision: 'approve' | 'reject';
  reason: string;
}

export interface CompleteInput extends DecideInput {
  challengeId: string;
  code: string;
}

function failure(message: string | null, fieldErrors: Record<string, string> = {}): DecisionResult {
  return { ok: false, message, fieldErrors, challenge: null };
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
 * Step one of a decision: validate the decision and mint the step-up challenge.
 *
 * Four-eyes is a server-side control (the maker can never decide), but the reason is validated
 * here too so a malformed submission never consumes an MFA challenge.
 */
export async function beginDecision(input: DecideInput): Promise<DecisionResult> {
  const { data, fieldErrors } = validate(input);
  if (!data) {
    return failure(null, fieldErrors ?? {});
  }

  try {
    const challenge = await requestDecisionChallenge();
    return {
      ok: true,
      message: null,
      fieldErrors: {},
      challenge: { id: challenge.challengeId, method: challenge.method, hint: challenge.hint ?? null },
    };
  } catch (error) {
    return failure(errorMessage(error, 'The verification challenge could not be started.'));
  }
}

/** Step two: verify the operator's second factor, then record the decision with the proof. */
export async function completeDecision(input: CompleteInput): Promise<DecisionResult> {
  const { data, fieldErrors } = validate(input);
  if (!data) {
    return failure(null, fieldErrors ?? {});
  }

  try {
    const proof = await verifyDecisionChallenge(input.challengeId, input.code);
    await decideApproval(input.approvalId, data, proof.stepUpToken);
    revalidatePath('/approvals');
    revalidatePath(`/approvals/${input.approvalId}`);
    return { ok: true, message: null, fieldErrors: {}, challenge: null };
  } catch (error) {
    return failure(errorMessage(error, 'The decision could not be recorded. Please try again.'));
  }
}
