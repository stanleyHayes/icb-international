import type { Dispute } from '@icb/contracts';
import { Card, CardHeader, EmptyState } from '@icb/ui';
import { Scale } from 'lucide-react';
import type { Metadata } from 'next';

import { DisputeList } from '@/features/support/dispute-list';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Disputes' };

/**
 * The dispute tracker. Every transaction the customer has challenged, with the stage each
 * case has reached — the answer to "what is happening with my money" without a phone call.
 */
export default async function DisputesPage() {
  const { items: disputes } = await api<{ items: Dispute[] }>('/disputes?limit=100', {
    tags: ['disputes'],
  });

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Disputes</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Transactions you have challenged, and where each case stands.
        </p>
      </header>

      <Card className="mt-8 overflow-hidden">
        <CardHeader title="Your cases" />
        {disputes.length > 0 ? (
          <DisputeList disputes={disputes} />
        ) : (
          <EmptyState
            icon={<Scale size={20} />}
            title="No disputes"
            description="If you challenge a card transaction, the case is tracked here from start to finish."
          />
        )}
      </Card>
    </>
  );
}
