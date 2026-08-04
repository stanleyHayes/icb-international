import type { AccountSummary, BankDocument, Statement } from '@icb/contracts';
import { Amount, Card, CardHeader, EmptyState, StatusBadge, cn, formatDate } from '@icb/ui';
import { Download, FileText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { LetterRequestForm } from '@/features/documents/letter-request-form';
import { StatementGenerateForm } from '@/features/documents/statement-generate-form';
import { api } from '@/lib/api';
import type { Route } from 'next';

export const metadata: Metadata = { title: 'Documents' };

const KIND_LABELS: Record<BankDocument['kind'], string> = {
  statement: 'Statement',
  tax_certificate: 'Tax certificate',
  balance_letter: 'Balance confirmation',
  reference_letter: "Banker's reference",
  contract: 'Contract',
};

interface DocumentsData {
  accounts: AccountSummary[];
  statements: Statement[];
  documents: BankDocument[];
}

async function loadDocuments(): Promise<DocumentsData> {
  const [accounts, statements, documents] = await Promise.all([
    api<{ items: AccountSummary[] }>('/accounts', { tags: ['accounts'] }),
    api<{ items: Statement[] }>('/statements', { tags: ['documents'] }),
    api<{ items: BankDocument[] }>('/documents', { tags: ['documents'] }),
  ]);
  return { accounts: accounts.items, statements: statements.items, documents: documents.items };
}

/**
 * Statements, tax certificates and letters.
 *
 * Downloads go through short-lived signed URLs minted per click (see the download route
 * handlers), never through links embedded in the page — a URL in page source would outlive
 * its expiry and leak into browser history.
 */
export default async function DocumentsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ year?: string }> }>) {
  const { year } = await searchParams;
  const { accounts, statements, documents } = await loadDocuments();

  const years = [...new Set(statements.map((s) => s.period.slice(0, 4)))].sort((a, b) =>
    b.localeCompare(a),
  );
  const shown = year === undefined ? statements : statements.filter((s) => s.period.startsWith(year));
  const taxDocuments = documents.filter((d) => d.kind === 'tax_certificate');
  const letters = documents.filter((d) => d.kind !== 'tax_certificate' && d.kind !== 'statement');
  const accountOptions = accounts.map((a) => ({ id: a.id, label: a.nickname ?? a.productName }));

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Documents</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Statements, tax certificates and letters, generated from the ledger itself.
        </p>
      </header>

      <Card className="mt-8 overflow-hidden">
        <CardHeader
          title="Statements"
          description="Opening balance plus credits minus debits equals closing balance, exactly."
        />
        {years.length > 1 ? (
          <nav aria-label="Filter statements by year" className="flex flex-wrap gap-2 px-5 pb-3">
            <YearPill href="/documents" label="All" active={year === undefined} />
            {years.map((y) => (
              <YearPill key={y} href={`/documents?year=${y}`} label={y} active={year === y} />
            ))}
          </nav>
        ) : null}
        {shown.length > 0 ? (
          <StatementTable statements={shown} />
        ) : (
          <EmptyState
            icon={<FileText size={20} />}
            title="No statements for this period"
            description="Your first statement is generated at the end of your first full month — or generate one for any window below."
          />
        )}
        <div className="border-t border-[var(--icb-border)] px-5 py-5">
          <h2 className="text-sm font-medium">Generate a statement</h2>
          <p className="mt-0.5 mb-4 text-xs text-[var(--icb-text-subtle)]">
            Any window you need — for a visa application, a landlord, or your own records.
          </p>
          <StatementGenerateForm accounts={accountOptions} />
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Tax certificates"
          description="Interest and tax summaries for each tax year."
        />
        <DocumentList documents={taxDocuments} emptyTitle="No tax certificates yet"
          emptyDescription="Certificates for each closed tax year will appear here." />
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Letters and certificates"
          description="Balance confirmations and banker's references, issued on request."
        />
        <DocumentList documents={letters} emptyTitle="No letters yet"
          emptyDescription="Letters you request will appear here, signed and dated at issue." />
        <div className="border-t border-[var(--icb-border)] px-5 py-5">
          <h2 className="text-sm font-medium">Request a letter</h2>
          <p className="mt-0.5 mb-4 text-xs text-[var(--icb-text-subtle)]">
            Figures are quoted true at the moment of issue.
          </p>
          <LetterRequestForm accounts={accountOptions} />
        </div>
      </Card>
    </>
  );
}

// `href` is a Route, not a string: callers build `/documents?year=…` query variants, which
// typedRoutes cannot enumerate, so the assertion belongs at the one place that builds them.
function YearPill({ href, label, active }: Readonly<{ href: Route; label: string; active: boolean }>) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-[var(--icb-navy-700)] text-white'
          : 'bg-[var(--icb-bg-muted)] text-[var(--icb-text-muted)] hover:text-[var(--icb-text)]',
      )}
    >
      {label}
    </Link>
  );
}

function StatementTable({ statements }: Readonly<{ statements: Statement[] }>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <caption className="sr-only">Account statements by period</caption>
        <thead>
          <tr className="border-y border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
            <th scope="col" className="px-5 py-2 font-medium">Period</th>
            <th scope="col" className="px-3 py-2 font-medium">Account</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Opening</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Closing</th>
            <th scope="col" className="px-5 py-2 text-right font-medium">
              <span className="sr-only">Download</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--icb-border)]">
          {statements.map((statement) => (
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
                  href={`/documents/statements/${statement.id}/download`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--icb-primary)] hover:underline"
                >
                  <Download size={14} aria-hidden="true" />
                  PDF
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentList({
  documents,
  emptyTitle,
  emptyDescription,
}: Readonly<{ documents: BankDocument[]; emptyTitle: string; emptyDescription: string }>) {
  if (documents.length === 0) {
    return <EmptyState icon={<FileText size={20} />} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <ul className="divide-y divide-[var(--icb-border)]">
      {documents.map((document) => (
        <li key={document.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{document.title}</p>
            <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
              {formatDate(document.createdAt, 'medium')} · {Math.round(document.sizeBytes / 1024)} KB
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StatusBadge status={KIND_LABELS[document.kind]} />
            <a
              href={`/documents/${document.id}/download`}
              aria-label={`Download ${document.title}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--icb-primary)] hover:underline"
            >
              <Download size={14} aria-hidden="true" />
              PDF
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
