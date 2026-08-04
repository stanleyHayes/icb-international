import type { AccountSummary } from '@icb/contracts';
import { Card, CardBody, CardHeader } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { IssueCardForm } from '@/features/cards/issue-card-form';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'New card' };

/** Issue a virtual card instantly, or order a physical debit card against an account. */
export default async function NewCardPage() {
  const accounts = await api<AccountSummary[]>('/accounts', { tags: ['accounts'] });
  const eligible = accounts.filter((account) => account.status === 'active');

  return (
    <>
      <Link
        href="/cards"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        All cards
      </Link>

      <div className="mt-6 max-w-[520px]">
        <Card>
          <CardHeader
            title="New card"
            description="A virtual card works the moment it is issued. A physical card is posted to you."
          />
          <CardBody className="pt-0">
            <IssueCardForm accounts={eligible} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
