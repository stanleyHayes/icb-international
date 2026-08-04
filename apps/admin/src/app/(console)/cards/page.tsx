import type { CardSummary, CursorPage } from '@icb/contracts';
import { Card, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CardSearch } from '@/features/cards/card-search';
import { CARD_PATHS } from '@/features/cards/cards.constants';
import { IssueCardDialog } from '@/features/cards/issue-card-dialog';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Cards' };

interface CardFilters {
  accountId?: string;
  status?: string;
  kind?: string;
  cursor?: string;
}

type SearchParams = Promise<CardFilters>;

/**
 * Card search and listing.
 *
 * Cards are looked up by account because that is how a support conversation arrives — the
 * customer reads out their account, not a card id. Filters and the cursor live in the URL so
 * the exact view can be shared between agents.
 */
export default async function CardsPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const query = buildQuery({ ...params });
  const suffix = query === '' ? '' : `?${query}`;
  const page = await api<CursorPage<CardSummary>>(`${CARD_PATHS.list}${suffix}`);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Cards</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            Search by account to issue, block, reissue or manage limits.
          </p>
        </div>
        <IssueCardDialog {...(params.accountId ? { defaultAccountId: params.accountId } : {})} />
      </header>

      <div className="mt-6">
        <CardSearch
          defaultAccountId={params.accountId ?? ''}
          defaultStatus={params.status ?? ''}
          defaultKind={params.kind ?? ''}
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        {page.items.length > 0 ? (
          <CardTable cards={page.items} />
        ) : (
          <EmptyState
            icon={<CreditCard size={20} />}
            title="No cards found"
            description="Try a different account, status or kind — or issue a new card."
          />
        )}
      </Card>

      {page.hasMore && page.nextCursor ? (
        <p className="mt-4 text-sm">
          <Link
            href={{
              pathname: '/cards',
              query: buildQuery({ ...params, cursor: page.nextCursor }),
            }}
            className="font-medium text-[var(--icb-primary)] hover:underline"
          >
            Next page
          </Link>
        </p>
      ) : null}
    </>
  );
}

/** The raw query string (no leading `?`), or an empty string when unfiltered. */
function buildQuery(filters: CardFilters): string {
  const query = new URLSearchParams();
  if (filters.accountId) query.set('accountId', filters.accountId);
  if (filters.status) query.set('status', filters.status);
  if (filters.kind) query.set('kind', filters.kind);
  if (filters.cursor) query.set('cursor', filters.cursor);
  return query.toString();
}

function CardTable({ cards }: Readonly<{ cards: CardSummary[] }>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <caption className="sr-only">Cards matching the search</caption>
        <thead>
          <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
            <th scope="col" className="px-5 py-2.5 font-medium">Card</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Cardholder</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Kind</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Expiry</th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">Issued</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--icb-border)]">
          {cards.map((card) => (
            <tr key={card.id} className="hover:bg-[var(--icb-bg-subtle)]">
              <td className="px-5 py-3">
                <Link href={`/cards/${card.id}`} className="font-medium hover:underline">
                  {card.nickname ?? `•••• ${card.panLast4}`}
                </Link>
                <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
                  •••• {card.panLast4} · {card.network}
                </p>
              </td>
              <td className="px-3 py-3 text-xs">{card.cardholderName}</td>
              <td className="px-3 py-3 text-xs capitalize">{card.kind}</td>
              <td className="px-3 py-3">
                <StatusBadge status={card.status} />
                {card.frozen ? <StatusBadge status="frozen" className="ml-1" /> : null}
              </td>
              <td className="px-3 py-3 text-xs tabular">
                {String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}
              </td>
              <td className="px-5 py-3 text-right text-xs text-[var(--icb-text-subtle)]">
                {formatDate(card.issuedAt, 'medium')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
