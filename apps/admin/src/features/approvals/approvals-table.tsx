'use client';

import type { ApprovalRequest } from '@icb/contracts';
import {
  Amount,
  DataTable,
  EmptyState,
  StatusBadge,
  formatDate,
  type ColumnDef,
} from '@icb/ui';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { ExpiryCountdown } from '@/features/approvals/expiry-countdown';
import { approvalKindLabel } from '@/features/approvals/kind-labels';

const columns: ColumnDef<ApprovalRequest, unknown>[] = [
  {
    id: 'summary',
    header: 'Request',
    cell: ({ row }) => (
      <div className="max-w-[340px]">
        <Link
          href={`/approvals/${row.original.id}`}
          className="font-medium break-words hover:underline"
        >
          {row.original.summary}
        </Link>
        <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
          {row.original.id.slice(0, 10)}
        </p>
      </div>
    ),
  },
  {
    id: 'kind',
    accessorKey: 'kind',
    header: 'Kind',
    cell: ({ row }) => (
      <span className="text-xs whitespace-nowrap">{approvalKindLabel(row.original.kind)}</span>
    ),
  },
  {
    id: 'amount',
    header: 'Amount',
    cell: ({ row }) =>
      row.original.amount ? (
        <Amount value={row.original.amount} size="sm" />
      ) : (
        <span className="text-[var(--icb-text-subtle)]">—</span>
      ),
  },
  {
    id: 'requestedBy',
    accessorKey: 'requestedBy',
    header: 'Maker',
    cell: ({ row }) => <span className="text-xs">{row.original.requestedBy}</span>,
  },
  {
    id: 'requestedAt',
    accessorKey: 'requestedAt',
    header: 'Raised',
    cell: ({ row }) => (
      <span className="text-xs whitespace-nowrap">{formatDate(row.original.requestedAt, 'medium')}</span>
    ),
  },
  {
    id: 'expiresAt',
    accessorKey: 'expiresAt',
    header: 'Deadline',
    cell: ({ row }) =>
      row.original.status === 'pending' ? (
        <ExpiryCountdown expiresAt={row.original.expiresAt} />
      ) : (
        <span className="text-xs text-[var(--icb-text-subtle)]">
          {formatDate(row.original.expiresAt, 'medium')}
        </span>
      ),
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

/**
 * The unified maker-checker queue: every privileged action waiting on a second pair of eyes,
 * regardless of which domain raised it.
 */
export function ApprovalsTable({ approvals }: Readonly<{ approvals: ApprovalRequest[] }>) {
  return (
    <DataTable
      columns={columns}
      data={approvals}
      getRowId={(row) => row.id}
      emptyState={
        <EmptyState
          icon={<ShieldCheck size={20} />}
          title="Nothing waiting for review"
          description="Approval requests raised by operators will appear here."
        />
      }
    />
  );
}
