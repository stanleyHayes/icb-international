import type { Kpi, LedgerIntegrityReport, MonitorEntry } from '@icb/contracts';
import { Amount, Card, CardHeader } from '@icb/ui';
import { ArrowUpRight, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
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
          <p className="font-mono text-[0.68rem] font-medium tracking-[0.16em] text-[var(--icb-text-subtle)] uppercase">
            Bank control room
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.02em]">Operations</h1>
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
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--icb-border)] bg-[var(--icb-surface)] shadow-[var(--shadow-sm)]">
          <div className="h-1 bg-gradient-to-r from-[var(--icb-primary)] via-[var(--icb-accent)] to-[var(--icb-primary)]" />
          <div className="grid sm:grid-cols-2 xl:grid-cols-5">
            {kpis.items.map((kpi) => (
              <div
                key={kpi.key}
                className="group relative min-h-32 border-b border-[var(--icb-border)] px-5 py-5 transition-colors last:border-b-0 hover:bg-[var(--icb-bg-subtle)] sm:border-r sm:[&:nth-child(2n)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2n)]:border-r xl:last:border-r-0"
              >
                <span className="absolute top-5 right-5 h-1.5 w-1.5 rounded-full bg-[var(--icb-border-strong)] transition-colors group-hover:bg-[var(--icb-accent)]" />
                <p className="pr-4 text-xs font-medium tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
                  {kpi.label}
                </p>
                <p className="mt-4">
                  {kpi.format === 'money' && typeof kpi.value === 'object' ? (
                    <Amount value={kpi.value} size="xl" />
                  ) : (
                    <span className="tabular font-display text-[1.75rem] font-bold tracking-[-0.035em]">
                      {typeof kpi.value === 'number' ? kpi.value.toLocaleString('en-US') : '—'}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <Card className="overflow-hidden shadow-[var(--shadow-sm)]">
          <CardHeader
            title="Transaction monitor"
            description="Every posting in the bank, newest first"
            className="border-b border-[var(--icb-border)] bg-[var(--icb-surface)] pb-4"
            action={
              <Link
                href="/monitor"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-[var(--icb-primary)] transition-colors hover:bg-[var(--icb-navy-50)]"
              >
                Open monitor <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            }
          />
          <MonitorTable entries={monitor.items.slice(0, 12)} />
        </Card>

        <LedgerIntegrityCard report={integrity} />
      </div>
    </>
  );
}

function LedgerIntegrityCard({ report }: Readonly<{ report: LedgerIntegrityReport }>) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-xl)] bg-[var(--icb-navy-950)] text-white shadow-[var(--shadow-lg)]">
      <div className="border-b border-white/10 px-5 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-[var(--icb-accent)]">
            <ShieldCheck size={17} aria-hidden="true" />
          </span>
          <h3 className="font-display text-base font-semibold">Ledger integrity</h3>
        </div>
        <p className="mt-3 font-mono text-[0.7rem] leading-relaxed text-[var(--icb-navy-300)]">
          {report.transactionsChecked.toLocaleString('en-US')} transactions ·{' '}
          {report.entriesChecked.toLocaleString('en-US')} entries · {report.durationMs}ms
        </p>
      </div>
      <ul className="divide-y divide-white/10">
        {report.checks.map((check) => (
          <li key={check.name} className="flex items-start gap-3 px-5 py-3.5">
            {check.passed ? (
              <CheckCircle2
                size={16}
                className="mt-0.5 shrink-0 text-[var(--icb-accent)]"
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
              <p className="text-sm font-medium text-white">{check.name}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--icb-navy-300)]">
                {check.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
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
