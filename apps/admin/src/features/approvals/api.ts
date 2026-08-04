import 'server-only';

import type { ApprovalRequest, MfaChallenge, StepUpToken } from '@icb/contracts';

import { api } from '@/lib/api';

/** Matches the API's `STEP_UP_PURPOSES.approvalDecide`; the contract enum lags behind it. */
export const APPROVAL_DECIDE_PURPOSE = 'approval-decide';

export interface ApprovalFilter {
  status?: string | undefined;
  kind?: string | undefined;
}

export function listApprovals(filter: ApprovalFilter): Promise<ApprovalRequest[]> {
  const query = new URLSearchParams();
  if (filter.status) query.set('status', filter.status);
  if (filter.kind) query.set('kind', filter.kind);
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return api<ApprovalRequest[]>(`/admin/approvals${suffix}`);
}

export function getApproval(approvalId: string): Promise<ApprovalRequest> {
  return api<ApprovalRequest>(`/admin/approvals/${approvalId}`);
}

/** Mint the MFA challenge that precedes a decision; the code arrives over the staff MFA rail. */
export function requestDecisionChallenge(): Promise<MfaChallenge> {
  return api<MfaChallenge>('/auth/step-up', {
    method: 'POST',
    body: { purpose: APPROVAL_DECIDE_PURPOSE },
  });
}

export function verifyDecisionChallenge(challengeId: string, code: string): Promise<StepUpToken> {
  return api<StepUpToken>('/auth/step-up/verify', {
    method: 'POST',
    body: { challengeId, code },
  });
}

/** The StepUpGuard demands the fresh proof on `x-step-up-token`; `lib/api` attaches it. */
export function decideApproval(
  approvalId: string,
  body: { decision: 'approve' | 'reject'; reason: string },
  stepUpToken: string,
): Promise<ApprovalRequest> {
  return api<ApprovalRequest>(`/admin/approvals/${approvalId}/decision`, {
    method: 'POST',
    body,
    stepUpToken,
  });
}
