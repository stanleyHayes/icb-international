import type { AccountSummary, CursorPage } from '@icb/contracts';
import { Card, CardBody, CardHeader } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { GoalForm } from '@/features/savings/goal-form';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'New savings goal' };

/** Open a savings goal against an account. */
export default async function NewGoalPage() {
  const accountsPage = await api<CursorPage<AccountSummary>>('/accounts?limit=50', {
    tags: ['accounts'],
  });
  const active = accountsPage.items.filter((account) => account.status === 'active');

  return (
    <>
      <Link
        href="/savings"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Savings
      </Link>

      <div className="mt-6 max-w-[560px]">
        <Card>
          <CardHeader
            title="New savings goal"
            description="Name it, set a target, and let round-ups or a standing contribution do the steady work."
          />
          <CardBody className="pt-0">
            <GoalForm accounts={active} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
