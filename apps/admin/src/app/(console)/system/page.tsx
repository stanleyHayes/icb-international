import type { LedgerIntegrityReport } from '@icb/contracts';
import { Card, CardBody, CardHeader, StatusBadge } from '@icb/ui';
import { CheckCircle2, Clock, Database, XCircle } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { api } from '@/lib/api';
import { isNotFound } from '@/lib/guards';

export const metadata: Metadata = { title: 'System' };

interface Liveness {
  status: string;
  uptimeSeconds: number;
  bank: string;
}

interface Readiness {
  status: 'ready' | 'not_ready';
  database: string;
  serverTime: string;
  businessDate: string;
}

interface QueueDepth {
  name: string;
  waiting: number;
  active: number;
  failed: number;
  completed: number;
}

/**
 * System health.
 *
 * Liveness and readiness come from the API's public probes; queue depths come from the
 * consolidated admin health endpoint. When that endpoint is not deployed the queues panel says
 * so plainly — an ops page that guesses is worse than one that admits a gap.
 */
export default async function SystemPage() {
  const [liveness, readiness, integrity, queues] = await Promise.all([
    api<Liveness>('/health', { anonymous: true }),
    api<Readiness>('/health/ready', { anonymous: true }),
    api<LedgerIntegrityReport>('/admin/ledger-integrity'),
    loadQueues(),
  ]);

  const healthy = readiness.status === 'ready' && readiness.database === 'connected';

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">System</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            Platform health, queues and jobs for {liveness.bank}.
          </p>
        </div>
        <StatusBadge status={healthy ? 'healthy' : 'degraded'} />
      </header>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <HealthCard
          icon={<Database size={16} aria-hidden="true" />}
          title="Service"
          ok={healthy}
          lines={[
            `Readiness: ${readiness.status.replace('_', ' ')}`,
            `Database: ${readiness.database}`,
            `Uptime: ${formatUptime(liveness.uptimeSeconds)}`,
          ]}
        />
        <HealthCard
          icon={<Clock size={16} aria-hidden="true" />}
          title="Bank clock"
          ok
          lines={[
            `Business date: ${readiness.businessDate}`,
            `As of: ${readiness.serverTime.slice(0, 19).replace('T', ' ')} UTC`,
          ]}
        />
        <HealthCard
          icon={
            integrity.balanced ? (
              <CheckCircle2 size={16} aria-hidden="true" />
            ) : (
              <XCircle size={16} aria-hidden="true" />
            )
          }
          title="Ledger"
          ok={integrity.balanced}
          lines={[
            integrity.balanced ? 'Books balanced' : 'BOOKS UNBALANCED',
            `${integrity.transactionsChecked.toLocaleString('en-US')} transactions checked`,
            `${integrity.entriesChecked.toLocaleString('en-US')} entries checked`,
          ]}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Queues" description="Waiting, active, failed and completed jobs." />
          {queues ? (
            <QueueTable queues={queues} />
          ) : (
            <CardBody>
              <p className="text-sm text-[var(--icb-text-muted)]">
                Queue telemetry is not available yet — the consolidated health endpoint
                (<code className="font-mono text-xs">GET /admin/health</code>) has not been
                deployed. DLQ replay and job history land with it.
              </p>
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader title="Administration" />
          <ul className="divide-y divide-[var(--icb-border)]">
            <SystemLink
              href="/system/flags"
              title="Feature flags"
              detail="Rollouts, audiences and kill switches"
            />
            <SystemLink
              href="/audit"
              title="Audit trail"
              detail="Searchable, hash-chained event log"
            />
            <SystemLink href="/staff" title="Staff" detail="Operators, roles and access" />
          </ul>
        </Card>
      </div>
    </>
  );
}

function HealthCard({
  icon,
  title,
  ok,
  lines,
}: Readonly<{ icon: React.ReactNode; title: string; ok: boolean; lines: string[] }>) {
  return (
    <Card>
      <CardBody className="pt-5">
        <p className="flex items-center gap-2 text-xs font-medium tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
          <span className={ok ? 'text-[var(--icb-success-fg)]' : 'text-[var(--icb-danger-fg)]'}>
            {icon}
          </span>
          {title}
        </p>
        <ul className="mt-3 space-y-1">
          {lines.map((line) => (
            <li key={line} className="text-sm">
              {line}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function QueueTable({ queues }: Readonly<{ queues: QueueDepth[] }>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">Job queue depths</caption>
        <thead>
          <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
            <th scope="col" className="px-5 py-2.5 font-medium">Queue</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Waiting</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Active</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Failed</th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">Completed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--icb-border)]">
          {queues.map((queue) => (
            <tr key={queue.name} className="hover:bg-[var(--icb-bg-subtle)]">
              <td className="px-5 py-2.5 font-mono text-xs">{queue.name}</td>
              <td className="tabular px-3 py-2.5 text-right">{queue.waiting}</td>
              <td className="tabular px-3 py-2.5 text-right">{queue.active}</td>
              <td
                className={`tabular px-3 py-2.5 text-right ${queue.failed > 0 ? 'font-semibold text-[var(--icb-danger-fg)]' : ''}`}
              >
                {queue.failed}
              </td>
              <td className="tabular px-5 py-2.5 text-right">{queue.completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SystemLink({
  href,
  title,
  detail,
}: Readonly<{ href: Route; title: string; detail: string }>) {
  return (
    <li>
      <Link href={href} className="block px-5 py-3.5 transition-colors hover:bg-[var(--icb-bg-subtle)]">
        <p className="text-sm font-medium text-[var(--icb-primary)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">{detail}</p>
      </Link>
    </li>
  );
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** Queue depths from the consolidated health endpoint; `null` while that endpoint is pending. */
async function loadQueues(): Promise<QueueDepth[] | null> {
  try {
    const health = await api<{ queues: QueueDepth[] }>('/admin/health');
    return health.queues;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}
