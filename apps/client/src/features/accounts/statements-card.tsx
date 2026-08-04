import type { Statement } from '@icb/contracts';
import { Amount, Card, CardHeader, EmptyState, formatDate } from '@icb/ui';
import { FileText } from 'lucide-react';
import Link from 'next/link';

import { api } from '@/lib/api';

import { StatementDownloadButton } from './statement-download-button';

/**
 * Statements for this account, newest first.
 *
 * The statements endpoint lists the customer's whole archive, so the account's own periods are
 * filtered here; the full archive lives in Documents, linked from the card header.
 */
export async function StatementsCard({ accountId }: Readonly<{ accountId: string }>) {
  const { items } = await api<{ items: Statement[] }>('/statements', { tags: ['documents'] });
  const statements = items
    .filter((statement) => statement.accountId === accountId)
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 6);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Statements"
        action={
          <Link
            href="/documents"
            className="text-sm font-medium text-[var(--icb-primary)] hover:underline"
          >
            All documents
          </Link>
        }
      />
      {statements.length > 0 ? (
        <ul className="divide-y divide-[var(--icb-border)]">
          {statements.map((statement) => (
            <li key={statement.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {formatDate(statement.from, 'medium')} – {formatDate(statement.to, 'medium')}
                </p>
                <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                  {statement.transactionCount} transactions · closing{' '}
                  <Amount value={statement.closingBalance} size="sm" />
                </p>
              </div>
              <StatementDownloadButton statementId={statement.id} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<FileText size={20} />}
          title="No statements yet"
          description="Statements are generated monthly and will appear here."
        />
      )}
    </Card>
  );
}
