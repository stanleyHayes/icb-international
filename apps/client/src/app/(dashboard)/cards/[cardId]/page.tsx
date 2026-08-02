import type { CardDetail } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft, Check, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CardFace } from '@/features/cards/card-face';
import { FreezeToggle } from '@/features/cards/freeze-toggle';
import { api } from '@/lib/api';

type Params = Promise<{ cardId: string }>;

export const metadata: Metadata = { title: 'Card' };

const CHANNEL_LABELS: Readonly<Record<string, string>> = {
  online: 'Online and in-app',
  contactless: 'Contactless',
  atm: 'ATM withdrawals',
  international: 'Outside your country',
  in_store: 'In store (chip and PIN)',
};

/**
 * One card, with its controls and how much of each limit is left.
 *
 * Remaining allowance is shown alongside every limit rather than the limit alone — "2,000 daily"
 * does not tell a customer whether their next payment will go through, and that is the only
 * question they are actually asking.
 */
export default async function CardDetailPage({ params }: Readonly<{ params: Params }>) {
  const { cardId } = await params;
  const card = await api<CardDetail>(`/cards/${cardId}`, { tags: ['cards'] });

  return (
    <>
      <Link
        href="/cards"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        All cards
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[380px_1fr]">
        <div>
          <CardFace card={card} />
          <div className="mt-5">
            <FreezeToggle cardId={card.id} frozen={card.frozen} />
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <header>
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
              {card.nickname ?? `${card.network.toUpperCase()} ${card.kind} card`}
            </h1>
            <p className="mt-1.5 flex items-center gap-2 text-sm text-[var(--icb-text-muted)]">
              <StatusBadge status={card.frozen ? 'frozen' : card.status} />
              Issued {formatDate(card.issuedAt, 'medium')}
            </p>
          </header>

          <SpendingPanel card={card} />
          <ControlsPanel card={card} />
          <DetailsPanel card={card} />
        </div>
      </div>
    </>
  );
}

function SpendingPanel({ card }: Readonly<{ card: CardDetail }>) {
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
          <div className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] pb-3">
            <dt className="text-[var(--icb-text-subtle)]">Per transaction</dt>
            <dd>
              <Amount value={card.limits.perTransaction} size="sm" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--icb-text-subtle)]">Contactless</dt>
            <dd>
              <Amount value={card.limits.contactless} size="sm" />
            </dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}

/** Channels and blocked categories. Each is enforced at authorisation, not merely displayed. */
function ControlsPanel({ card }: Readonly<{ card: CardDetail }>) {
  return (
    <Card>
      <CardHeader
        title="Where this card works"
        description="Each switch is enforced when a payment is authorised, not merely recorded."
      />
      <CardBody className="pt-0">
        <ul className="space-y-2.5">
          {Object.entries(card.controls.channels).map(([channel, enabled]) => (
            <li key={channel} className="flex items-center gap-3 text-sm">
              {enabled ? (
                <Check size={16} className="shrink-0 text-[var(--icb-success)]" aria-hidden="true" />
              ) : (
                <X size={16} className="shrink-0 text-[var(--icb-text-subtle)]" aria-hidden="true" />
              )}
              <span className={enabled ? '' : 'text-[var(--icb-text-subtle)] line-through'}>
                {CHANNEL_LABELS[channel] ?? channel}
              </span>
            </li>
          ))}
        </ul>

        {card.controls.blockedCategories.length > 0 ? (
          <div className="mt-5 border-t border-[var(--icb-border)] pt-4">
            <p className="text-xs font-medium tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
              Blocked categories
            </p>
            <p className="mt-2 text-sm capitalize">
              {card.controls.blockedCategories.map((c) => c.replaceAll('_', ' ')).join(', ')}
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function DetailsPanel({ card }: Readonly<{ card: CardDetail }>) {
  return (
    <Card>
      <CardHeader title="Details" />
      <CardBody className="pt-0">
        <dl className="space-y-3 text-sm">
          <Row label="Card number" value={`•••• •••• •••• ${card.panLast4}`} mono />
          <Row
            label="Expires"
            value={`${String(card.expiryMonth).padStart(2, '0')}/${card.expiryYear}`}
            mono
          />
          <Row label="Network" value={card.network} capitalise />
          <Row label="Type" value={card.kind} capitalise />
          <Row label="PIN" value={card.pinSet ? 'Set' : 'Not set'} />
          <Row
            label="Travel notice"
            value={
              card.travelNoticeUntil
                ? `Until ${formatDate(card.travelNoticeUntil, 'medium')}`
                : 'None'
            }
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
    <div className="border-b border-[var(--icb-border)] pb-3">
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

function Row({
  label,
  value,
  mono = false,
  capitalise = false,
}: Readonly<{ label: string; value: string; mono?: boolean; capitalise?: boolean }>) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className={rowValueClass(mono, capitalise)}>{value}</dd>
    </div>
  );
}

function rowValueClass(mono: boolean, capitalise: boolean): string {
  if (mono) return 'font-mono text-xs';
  return capitalise ? 'capitalize' : '';
}
