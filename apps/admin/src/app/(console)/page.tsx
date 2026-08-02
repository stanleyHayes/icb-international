import type { Kpi, LedgerIntegrityReport, MonitorEntry } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader } from '@icb/ui';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { MonitorTable } from '@/components/monitor-table';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function ConsolePage() {
  const [kpis, integrity, monitor] = await Promise.all([
    api<{ items: Kpi[] }>('/admin/kpis'),
    api<LedgerIntegrityReport>('/admin/ledger-integrity'),
    api<{ items: MonitorEntry[] }>('/admin/monitor'),
  ]);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Operations</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            Position, ledger health and live transaction flow.
          </p>
        </div>
        <IntegrityPill report={integrity} />
      </header>

      <section aria-labelledby="kpis" className="mt-8">
        <h2 id="kpis" className="sr-only">
          Key figures
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {kpis.items.map((kpi) => (
            <Card key={kpi.key}>
              <CardBody className="pt-5">
                <p className="text-xs font-medium tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
                  {kpi.label}
                </p>
                <p className="mt-2">
                  {kpi.format === 'money' && typeof kpi.value === 'object' ? (
                    <Amount value={kpi.value} size="xl" />
                  ) : (
                    <span className="tabular font-display text-2xl font-bold tracking-[-0.02em]">
                      {typeof kpi.value === 'number' ? kpi.value.toLocaleString('en-US') : '—'}
                    </span>
                  )}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Transaction monitor"
            description="Every posting in the bank, newest first"
            action={
              <Link
                href="/monitor"
                className="text-sm font-medium text-[var(--icb-primary)] hover:underline"
              >
                Open monitor
              </Link>
            }
          />
          <MonitorTable entries={monitor.items.slice(0, 12)} />
        </Card>

        <Card>
          <CardHeader
            title="Ledger integrity"
            description={`${integrity.transactionsChecked.toLocaleString('en-US')} transactions · ${integrity.entriesChecked.toLocaleString('en-US')} entries · ${integrity.durationMs}ms`}
          />
          <ul className="divide-y divide-[var(--icb-border)]">
            {integrity.checks.map((check) => (
              <li key={check.name} className="flex items-start gap-3 px-5 py-3">
                {check.passed ? (
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0 text-[var(--icb-success)]"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircle
                    size={16}
                    className="mt-0.5 shrink-0 text-[var(--icb-danger)]"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{check.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function IntegrityPill({ report }: Readonly<{ report: LedgerIntegrityReport }>) {
  return (
    <span
      className={
        report.balanced
          ? 'inline-flex items-center gap-2 rounded-full bg-[var(--icb-success-bg)] px-3.5 py-1.5 text-sm font-medium text-[var(--icb-success-fg)] ring-1 ring-[var(--icb-success-border)] ring-inset'
          : 'inline-flex items-center gap-2 rounded-full bg-[var(--icb-danger-bg)] px-3.5 py-1.5 text-sm font-medium text-[var(--icb-danger-fg)] ring-1 ring-[var(--icb-danger-border)] ring-inset'
      }
    >
      {report.balanced ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
      Ledger {report.balanced ? 'balanced' : 'UNBALANCED'}
    </span>
  );
}
