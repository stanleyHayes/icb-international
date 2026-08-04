import type { CardAuthorisation, CardDetail, CursorPage } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { Receipt } from 'lucide-react';

import { api } from '@/lib/api';

/** Remaining allowance against each limit — the number that answers "will my next payment go through". */
export function SpendingPanel({ card }: Readonly<{ card: CardDetail }>) {
  return (
    <Card>
      <CardHeader title="Spending" description="What is left against each limit right now." />
      <CardBody className="pt-0">
        <dl className="space-y-3 text-sm">
          <SpendRow
            label="Today"
            spent={card.spend.todaySpent}
            remaining={card.spend.dailyRemaining}
            limit={card.limits.daily}
          />
          <SpendRow
            label="This month"
            spent={card.spend.monthSpent}
            remaining={card.spend.monthlyRemaining}
            limit={card.limits.monthly}
          />
        </dl>
      </CardBody>
    </Card>
  );
}

function SpendRow({
  label,
  spent,
  remaining,
  limit,
}: Readonly<{
  label: string;
  spent: { minorUnits: number; currency: string; scale: number };
  remaining: { minorUnits: number; currency: string; scale: number };
  limit: { minorUnits: number; currency: string; scale: number };
}>) {
  const used = limit.minorUnits > 0 ? Math.min(1, spent.minorUnits / limit.minorUnits) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-[var(--icb-text-subtle)]">{label}</dt>
        <dd className="text-right">
          <Amount value={spent} size="sm" /> of <Amount value={limit} size="sm" />
        </dd>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--icb-bg-muted)]"
        role="img"
        aria-label={`${Math.round(used * 100)}% of the ${label.toLowerCase()} limit used`}
      >
        <div
          className="h-full rounded-full bg-[var(--icb-primary)]"
          style={{ width: `${Math.max(2, used * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
        <Amount value={remaining} size="sm" /> remaining
      </p>
    </div>
  );
}

/**
 * The authorisation feed for one card, as the network saw it — including declines, with their
 * reasons, because a decline the customer cannot explain reads as a card that does not work.
 */
export async function AuthorisationsPanel({ cardId }: Readonly<{ cardId: string }>) {
  const { items } = await api<CursorPage<CardAuthorisation>>(
    `/cards/${cardId}/authorisations?limit=15`,
    { tags: ['cards'] },
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Card activity"
        description="Every authorisation attempt, including the ones declined."
      />
      {items.length > 0 ? (
        <ul className="divide-y divide-[var(--icb-border)]">
          {items.map((auth) => (
            <li key={auth.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{auth.merchantName}</p>
                <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)] capitalize">
                  {auth.channel.replace('_', ' ')}
                  {auth.country ? ` · ${auth.country}` : ''} · {formatDate(auth.authorisedAt, 'medium')}
                </p>
                {auth.declineReason ? (
                  <p className="mt-1 text-xs text-[var(--icb-danger-fg)]">{auth.declineReason}</p>
                ) : null}
              </div>
              <Amount value={auth.amount} direction="debit" size="sm" />
              <StatusBadge status={auth.status} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Receipt size={20} />}
          title="No activity yet"
          description="Authorisations will appear here the first time the card is used."
        />
      )}
    </Card>
  );
}
