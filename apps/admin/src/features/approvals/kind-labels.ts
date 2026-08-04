import type { ApprovalRequest } from '@icb/contracts';

/** Human labels for the maker-checker kinds; the enum values are wire format, not copy. */
const KIND_LABELS: Record<ApprovalRequest['kind'], string> = {
  manual_posting: 'Manual posting',
  high_value_transfer: 'High-value transfer',
  limit_change: 'Limit change',
  account_closure: 'Account closure',
  loan_override: 'Loan override',
  refund: 'Refund',
  write_off: 'Write-off',
};

export function approvalKindLabel(kind: ApprovalRequest['kind']): string {
  return KIND_LABELS[kind];
}

export const APPROVAL_KIND_OPTIONS = Object.entries(KIND_LABELS).map(([value, label]) => ({
  value,
  label,
}));
