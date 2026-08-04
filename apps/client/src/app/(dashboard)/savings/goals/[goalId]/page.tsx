import type { AccountSummary, SavingsGoal } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ContributeForm, GoalControls } from '@/features/savings/goal-controls';
import { api } from '@/lib/api';

type Params = Promise<{ goalId: string }>;

export const metadata: Metadata = { title: 'Savings goal' };

/**
 * One goal: progress against both the target and the date, the helpers running on it, and the
 * controls for putting money in.
 */
export default async function GoalDetailPage({ params }: Readonly<{ params: Params }>) {
  const { goalId } = await params;
  const [goal, accounts] = await Promise.all([
    api<SavingsGoal>(`/savings/goals/${goalId}`, { tags: ['savings'] }),
    api<AccountSummary[]>('/accounts', { tags: ['accounts'] }),
  ]);
  const active = accounts.filter((account) => account.status === 'active');
  const percent = Math.round(goal.progress * 100);

  return (
    <>
      <Link
        href="/savings"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Savings
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">{goal.name}</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {goal.targetDate ? `Target date ${formatDate(goal.targetDate, 'medium')}` : 'No target date'}
          </p>
        </div>
        <StatusBadge status={goal.status} />
      </header>

      <Card className="mt-6">
        <CardBody className="py-5">
          <p className="flex items-baseline gap-1.5">
            <Amount value={goal.saved} size="xl" />
            <span className="text-sm text-[var(--icb-text-subtle)]">
              of <Amount value={goal.target} size="sm" />
            </span>
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--icb-bg-muted)]"
            role="img"
            aria-label={`${percent}% of the way to ${goal.name}`}
          >
            <div
              className="h-full rounded-full bg-[var(--icb-primary)]"
              style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
            />
          </div>
          <p className="mt-2.5 text-xs text-[var(--icb-text-subtle)]">
            {goal.requiredMonthly ? (
              <>
                <Amount value={goal.requiredMonthly} size="sm" /> a month hits the date
                {goal.onTrack === false ? ' — currently behind' : ''}
              </>
            ) : (
              `${percent}% saved`
            )}
          </p>
        </CardBody>
      </Card>

      {goal.autoContribution ? (
        <Card className="mt-6">
          <CardHeader title="Automatic contribution" />
          <CardBody className="pt-0">
            <p className="text-sm">
              <Amount value={goal.autoContribution.amount} size="sm" />{' '}
              {goal.autoContribution.frequency}, next on{' '}
              {formatDate(goal.autoContribution.nextRunOn, 'medium')}
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Add money" description="From any of your accounts, any time." />
          <CardBody className="pt-0">
            <ContributeForm goal={goal} accounts={active} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Round-ups and status" />
          <CardBody className="pt-0">
            <GoalControls goal={goal} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
