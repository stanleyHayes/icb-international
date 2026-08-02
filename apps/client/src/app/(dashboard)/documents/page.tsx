import type { BankDocument, Statement } from '@icb/contracts';
import { Amount, Card, CardHeader, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { Download, FileText } from 'lucide-react';
import type { Metadata } from 'next';

import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Documents' };

/**
 * Statements and letters.
 *
 * Each statement shows the arithmetic that produced it — opening, credits, debits, closing —
 * because a statement whose numbers cannot be checked against each other is a picture of a
 * balance rather than an account of one.
 */
export default async function DocumentsPage() {
  const [statements, documents] = await Promise.all([
    api<{ items: Statement[] }>('/statements', { tags: ['documents'] }),
    api<{ items: BankDocument[] }>('/documents', { tags: ['documents'] }),
  ]);

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Documents</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Statements, letters and tax documents, generated from the ledger itself.
        </p>
      </header>

      <Card className="mt-8 overflow-hidden">
        <CardHeader
          title="Statements"
          description="Opening balance plus credits minus debits equals closing balance, exactly."
        />
        {statements.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <caption className="sr-only">Account statements by period</caption>
              <thead>
                <tr className="border-y border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                  <th scope="col" className="px-5 py-2 font-medium">
                    Period
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Account
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Opening
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Closing
                  </th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">
                    <span className="sr-only">Download</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--icb-border)]">
                {statements.items.map((statement) => (
                  <tr key={statement.id} className="hover:bg-[var(--icb-bg-subtle)]">
                    <td className="px-5 py-3">
                      <p className="font-medium">{statement.period}</p>
                      <p className="text-xs text-[var(--icb-text-subtle)]">
                        {statement.transactionCount} transactions
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs">{statement.accountLabel}</td>
                    <td className="px-3 py-3 text-right">
                      <Amount value={statement.openingBalance} size="sm" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Amount value={statement.closingBalance} size="sm" />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <a
                        href={`/api/statements/${statement.id}/download`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--icb-primary)] hover:underline"
                      >
                        <Download size={14} />
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<FileText size={20} />}
            title="No statements yet"
            description="Your first statement is generated at the end of your first full month."
          />
        )}
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Letters and certificates" />
        {documents.items.length > 0 ? (
          <ul className="divide-y divide-[var(--icb-border)]">
            {documents.items.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{document.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                    {formatDate(document.createdAt, 'medium')} ·{' '}
                    {Math.round(document.sizeBytes / 1024)} KB
                  </p>
                </div>
                <StatusBadge status={document.kind.replaceAll('_', ' ')} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<FileText size={20} />}
            title="No documents"
            description="Balance confirmations and reference letters you request will appear here."
          />
        )}
      </Card>
    </>
  );
}
