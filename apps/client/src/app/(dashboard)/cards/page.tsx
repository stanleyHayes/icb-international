import type { CardSummary, CursorPage } from '@icb/contracts';
import { Card, CardBody, EmptyState, StatusBadge } from '@icb/ui';
import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CardFace } from '@/features/cards/card-face';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Cards' };

export default async function CardsPage() {
  const { items } = await api<CursorPage<CardSummary>>('/cards', { tags: ['cards'] });

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Cards</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Freeze, set limits and control where each card works. Every control is applied at
          authorisation, not just recorded.
        </p>
      </header>

      {items.length > 0 ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {items.map((card) => (
            <Link
              key={card.id}
              href={`/cards/${card.id}`}
              className="group rounded-[var(--radius-xl)] focus-visible:outline-2"
            >
              <CardFace card={card} className="transition-transform group-hover:-translate-y-0.5" />
              <Card className="mt-3">
                <CardBody className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {card.nickname ?? `${card.network.toUpperCase()} ${card.kind}`}
                    </p>
                    <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
                      •••• {card.panLast4}
                    </p>
                  </div>
                  <StatusBadge status={card.frozen ? 'frozen' : card.status} />
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="mt-8">
          <EmptyState
            icon={<CreditCard size={20} />}
            title="No cards yet"
            description="Issue a virtual card and start using it immediately, or order a physical one."
          />
        </Card>
      )}
    </>
  );
}
