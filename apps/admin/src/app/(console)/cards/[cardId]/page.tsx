import type { CardAuthorisation, CardDetail, CursorPage } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft, Receipt } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CardActions } from '@/features/cards/card-actions';
import { CARD_PATHS } from '@/features/cards/cards.constants';
import { ExpireHoldButton } from '@/features/cards/expire-hold-button';
import { LimitsForm } from '@/features/cards/limits-form';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Card' };

type Params = Promise<{ cardId: string }>;
type SearchParams = Promise<{ cursor?: string }>;

/** Statuses in which the card can no longer be operated on. */
const TERMINAL_STATUSES = new Set(['cancelled', 'expired']);
/** Statuses in which authorisations are already being declined. */
const BLOCKED_STATUSES = new Set(['frozen', 'lost', 'stolen']);

/**
 * One card.
 *
 * Everything an operator can do to a card lives here: lifecycle actions, limit editing, and the
 * authorisation history with per-hold expiry. Sensitive reveal (full PAN/CVV) is deliberately
 * not offered in the console — support never needs the full number to operate the card.
 */
export default async function CardDetailPage({
  params,
  searchParams,
}: Readonly<{ params: Params; searchParams: SearchParams }>) {
  const { cardId } = await params;
  const { cursor } = await searchParams;
  const card = await api<CardDetail>(CARD_PATHS.detail(cardId));
  const authsQuery = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const authorisations = await api<CursorPage<CardAuthorisation>>(
    `${CARD_PATHS.authorisations(cardId)}${authsQuery}`,
  );

  return (
    <>
      <Link
        href="/cards"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Cards
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            {card.nickname ?? `Card •••• ${card.panLast4}`}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            <StatusBadge status={card.status} />
            <span className="capitalize">
              {card.kind} · {card.network}
            </span>
            <span className="font-mono text-xs">•••• {card.panLast4}</span>
            <span className="text-xs">{card.cardholderName}</span>
          </p>
        </div>
        <CardActions
          cardId={card.id}
          blocked={BLOCKED_STATUSES.has(card.status) || card.frozen}
          terminal={TERMINAL_STATUSES.has(card.status)}
        />
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <AuthorisationsPanel
          cardId={card.id}
          page={authorisations}
          hasCursor={cursor !== undefined}
        />

        <div className="space-y-6">
          <Card>
            <CardHeader title="Limits" description="Enforced server-side on every authorisation." />
            <CardBody className="pt-0">
              <LimitsForm
                cardId={card.id}
                currency={card.limits.perTransaction.currency}
                limits={card.limits}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Spend this period" />
            <CardBody className="pt-0">
              <dl className="space-y-3 text-sm">
                <SpendRow label="Spent today" value={card.spend.todaySpent} />
                <SpendRow label="Spent this month" value={card.spend.monthSpent} />
                <SpendRow label="Daily remaining" value={card.spend.dailyRemaining} />
                <SpendRow label="Monthly remaining" value={card.spend.monthlyRemaining} />
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function AuthorisationsPanel({
  cardId,
  page,
  hasCursor,
}: Readonly<{ cardId: string; page: CursorPage<CardAuthorisation>; hasCursor: boolean }>) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Authorisations"
        description="Open holds can be force-expired; everything is attributed and audited."
      />
      {page.items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Authorisation history for this card</caption>
            <thead>
              <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                <th scope="col" className="px-5 py-2.5 font-medium">Merchant</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">When</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--icb-border)]">
              {page.items.map((auth) => (
                <tr key={auth.id} className="hover:bg-[var(--icb-bg-subtle)]">
                  <td className="px-5 py-3">
                    <p className="font-medium">{auth.merchantName}</p>
                    <p className="text-xs text-[var(--icb-text-subtle)]">
                      MCC {auth.mcc} · {auth.channel.replaceAll('_', ' ')}
                      {auth.declineReason ? ` · ${auth.declineReason}` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={auth.status} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Amount value={auth.amount} size="sm" />
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-[var(--icb-text-subtle)]">
                    {formatDate(auth.authorisedAt, 'medium')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {auth.status === 'approved' ? (
                      <ExpireHoldButton
                        cardId={cardId}
                        authorisationId={auth.id}
                        merchantName={auth.merchantName}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={<Receipt size={20} />}
          title="No authorisations"
          description="This card has not been used yet."
        />
      )}
      {page.hasMore && page.nextCursor ? (
        <p className="border-t border-[var(--icb-border)] px-5 py-3 text-sm">
          <Link
            href={`/cards/${cardId}?cursor=${encodeURIComponent(page.nextCursor)}`}
            className="font-medium text-[var(--icb-primary)] hover:underline"
          >
            Older authorisations
          </Link>
        </p>
      ) : null}
      {hasCursor ? (
        <p className="border-t border-[var(--icb-border)] px-5 py-3 text-sm">
          <Link href={`/cards/${cardId}`} className="font-medium text-[var(--icb-primary)] hover:underline">
            Newest authorisations
          </Link>
        </p>
      ) : null}
    </Card>
  );
}

function SpendRow({ label, value }: Readonly<{ label: string; value: CardDetail['spend']['todaySpent'] }>) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--icb-text-subtle)]">{label}</dt>
      <dd>
        <Amount value={value} size="sm" />
      </dd>
    </div>
  );
}
