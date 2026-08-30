import 'server-only';

import type { ApprovalRequest } from '@icb/contracts';

import { api } from '@/lib/api';

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

export function decideApproval(
  approvalId: string,
  body: { decision: 'approve' | 'reject'; reason: string },
): Promise<ApprovalRequest> {
  return api<ApprovalRequest>(`/admin/approvals/${approvalId}/decision`, {
    method: 'POST',
    body,
  });
}
