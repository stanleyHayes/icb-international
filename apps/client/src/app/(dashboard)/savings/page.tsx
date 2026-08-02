import type { SavingsGoal, TermDeposit } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { PiggyBank, Target } from 'lucide-react';
import type { Metadata } from 'next';

import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Savings' };

/**
 * Goals and term deposits.
 *
 * A goal shows progress against a *date* as well as a target, because "62% of the way there" is
 * only useful if you also know whether that is ahead of or behind where you need to be.
 */
export default async function SavingsPage() {
  const [goals, deposits] = await Promise.all([
    api<{ items: SavingsGoal[] }>('/savings/goals', { tags: ['savings'] }),
    api<{ items: TermDeposit[] }>('/savings/deposits', { tags: ['savings'] }),
  ]);

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Savings</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Goals you are working towards, and money locked in for a fixed return.
        </p>
      </header>

      <section aria-labelledby="goals" className="mt-8">
        <h2 id="goals" className="font-display text-xl font-bold tracking-[-0.02em]">
          Goals
        </h2>

        {goals.items.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {goals.items.map((goal) => (
              <Card key={goal.id}>
                <CardBody className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{goal.name}</h3>
                      <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                        {goal.targetDate
                          ? `Target ${formatDate(goal.targetDate, 'medium')}`
                          : 'No target date'}
                      </p>
                    </div>
                    <StatusBadge status={goal.status} />
                  </div>

                  <p className="mt-4 flex items-baseline gap-1.5">
                    <Amount value={goal.saved} size="xl" />
                    <span className="text-sm text-[var(--icb-text-subtle)]">
                      of <Amount value={goal.target} size="sm" />
                    </span>
                  </p>

                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--icb-bg-muted)]"
                    role="img"
                    aria-label={`${Math.round(goal.progress * 100)}% of the way to ${goal.name}`}
                  >
                    <div
                      className="h-full rounded-full bg-[var(--icb-primary)]"
                      style={{ width: `${Math.max(2, Math.min(100, goal.progress * 100))}%` }}
                    />
                  </div>

                  <p className="mt-2.5 text-xs text-[var(--icb-text-subtle)]">
                    {goal.requiredMonthly ? (
                      <>
                        <Amount value={goal.requiredMonthly} size="sm" /> a month to hit the date
                        {goal.onTrack === false ? ' — currently behind' : ''}
                      </>
                    ) : (
                      `${Math.round(goal.progress * 100)}% saved`
                    )}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4">
            <EmptyState
              icon={<Target size={20} />}
              title="No goals yet"
              description="Name something you are saving for, set a target and a date, and we will tell you what it takes each month."
            />
          </Card>
        )}
      </section>

      <section aria-labelledby="deposits" className="mt-10">
        <h2 id="deposits" className="font-display text-xl font-bold tracking-[-0.02em]">
          Fixed term deposits
        </h2>

        {deposits.items.length > 0 ? (
          <Card className="mt-4 overflow-hidden">
            <ul className="divide-y divide-[var(--icb-border)]">
              {deposits.items.map((deposit) => (
                <li key={deposit.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {deposit.termMonths}-month deposit at {deposit.rate}%
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-[var(--icb-text-subtle)]">
                      {deposit.reference} · matures {formatDate(deposit.maturesOn, 'medium')}
                    </p>
                  </div>
                  <div className="text-right">
                    <Amount value={deposit.principal} size="lg" />
                    <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                      <Amount value={deposit.accruedInterest} size="sm" /> interest accrued
                    </p>
                  </div>
                  <StatusBadge status={deposit.status} />
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="mt-4">
            <EmptyState
              icon={<PiggyBank size={20} />}
              title="No term deposits"
              description="Lock money away for a fixed rate. Terms from one month to five years, with the early-break penalty quoted before you commit."
            />
          </Card>
        )}
      </section>
    </>
  );
}
