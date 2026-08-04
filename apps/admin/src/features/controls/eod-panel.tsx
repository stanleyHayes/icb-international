'use client';

import type { EndOfDayReport } from '@icb/contracts';
import { Amount, Button, Card, CardBody, CardHeader, StatusBadge, formatDate, formatTime } from '@icb/ui';
import { CheckCircle2, Play, XCircle } from 'lucide-react';
import { useActionState } from 'react';

import { ActionMessage } from './action-feedback';
import { runEndOfDayAction, type EodState } from './actions';

const INITIAL: EodState = { status: 'idle', message: null, report: null };

interface Step {
  label: string;
  count?: number;
  money?: EndOfDayReport['interestAccrued'];
}

/** The report in pipeline order — the same order the steps actually run overnight. */
function stepsOf(report: EndOfDayReport): Step[] {
  return [
    { label: 'Holds expired', count: report.holdsExpired },
    { label: 'Transfers settled', count: report.transfersSettled },
    { label: 'Interest accrued', money: report.interestAccrued },
    { label: 'Fees charged', money: report.feesCharged },
    { label: 'Loans aged', count: report.loansAged },
    { label: 'Statements generated', count: report.statementsGenerated },
    { label: 'AML alerts raised', count: report.amlAlertsRaised },
  ];
}

function StepList({ report }: Readonly<{ report: EndOfDayReport }>) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--icb-border)]">
      <ol className="divide-y divide-[var(--icb-border)]">
        {stepsOf(report).map((step, index) => (
          <li key={step.label} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="tabular flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--icb-bg-muted)] text-[0.7rem] font-semibold text-[var(--icb-text-muted)]">
              {index + 1}
            </span>
            <span className="flex-1">{step.label}</span>
            {step.money ? (
              <Amount value={step.money} size="sm" />
            ) : (
              <span className="tabular font-medium">{step.count?.toLocaleString('en-US')}</span>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--icb-border)] px-4 py-3">
        <Invariant label="Ledger balanced" passed={report.ledgerBalanced} />
        <Invariant label="Suspense zeroed" passed={report.suspenseZeroed} />
        <span className="ml-auto text-xs text-[var(--icb-text-subtle)]">
          {report.businessDate} · {report.durationMs.toLocaleString('en-US')}ms
        </span>
      </div>
    </div>
  );
}

function Invariant({ label, passed }: Readonly<{ label: string; passed: boolean }>) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium">
      {passed ? (
        <CheckCircle2 size={14} className="text-[var(--icb-success)]" aria-hidden="true" />
      ) : (
        <XCircle size={14} className="text-[var(--icb-danger)]" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

function History({ items }: Readonly<{ items: EndOfDayReport[] }>) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-medium">Recent runs</h3>
      <ul className="mt-2 divide-y divide-[var(--icb-border)]">
        {items.slice(0, 5).map((run) => (
          <li key={run.businessDate} className="flex items-center gap-3 py-2 text-sm">
            <span className="flex-1 font-medium">{formatDate(run.businessDate)}</span>
            <StatusBadge status={run.ledgerBalanced ? 'completed' : 'failed'} />
            <span className="tabular text-xs text-[var(--icb-text-subtle)]">
              {formatTime(run.completedAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * End of day, on demand.
 *
 * The result is shown step by step because that is how an operator reads it: not "a batch ran"
 * but "holds expired, transfers settled, interest and fees posted, books still balanced".
 */
export function EodPanel({ history }: Readonly<{ history: EndOfDayReport[] }>) {
  const [state, action, pending] = useActionState(async () => runEndOfDayAction(), INITIAL);

  return (
    <Card>
      <CardHeader
        title="End of day"
        description="Run the full overnight pipeline now: expiry, settlement, interest, fees, statements, monitoring."
      />
      <CardBody className="space-y-4">
        <form action={action}>
          <Button type="submit" loading={pending} leadingIcon={<Play size={16} />}>
            {pending ? 'Running end of day…' : 'Run end of day now'}
          </Button>
        </form>
        {state.message ? <ActionMessage state={state} /> : null}
        {state.report ? <StepList report={state.report} /> : null}
        <History items={history} />
      </CardBody>
    </Card>
  );
}
