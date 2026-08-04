import type { CardDetail } from '@icb/contracts';
import { Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthorisationsPanel, SpendingPanel } from '@/features/cards/card-panels';
import { CardFace } from '@/features/cards/card-face';
import { FreezeToggle } from '@/features/cards/freeze-toggle';
import { PanReveal } from '@/features/cards/pan-reveal';
import { ReportCardForm } from '@/features/cards/report-card-form';
import { PinForm, TravelNoticeForm } from '@/features/cards/security-forms';
import { ControlsForm, LimitsForm } from '@/features/cards/settings-forms';
import { api } from '@/lib/api';

type Params = Promise<{ cardId: string }>;

export const metadata: Metadata = { title: 'Card' };

/**
 * One card and everything that governs it.
 *
 * Controls and limits are editable in place because they are the reason this screen exists; the
 * read-only detail (network, expiry, issue date) is the smallest panel, not the largest.
 */
export default async function CardDetailPage({ params }: Readonly<{ params: Params }>) {
  const { cardId } = await params;
  const card = await api<CardDetail>(`/cards/${cardId}`, { tags: ['cards'] });
  const retired = card.status !== 'active' && card.status !== 'frozen' && card.status !== 'issued';

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
          {!retired ? (
            <div className="mt-5 space-y-5">
              <FreezeToggle cardId={card.id} frozen={card.frozen} />
              <PanReveal cardId={card.id} />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <header>
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
              {card.nickname ?? `${card.network.toUpperCase()} ${card.kind} card`}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
              <StatusBadge status={card.frozen ? 'frozen' : card.status} />
              Issued {formatDate(card.issuedAt, 'medium')}
              {card.travelNoticeUntil
                ? ` · Travel notice until ${formatDate(card.travelNoticeUntil, 'medium')}`
                : ''}
            </p>
          </header>

          <SpendingPanel card={card} />
          <AuthorisationsPanel cardId={card.id} />

          {!retired ? (
            <>
              <Card>
                <CardHeader
                  title="Spend limits"
                  description="Applied at authorisation. Lower limits take effect on the next payment attempt."
                />
                <CardBody className="pt-0">
                  <LimitsForm card={card} />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Where this card works"
                  description="Each switch is enforced when a payment is authorised, not merely recorded."
                />
                <CardBody className="pt-0">
                  <ControlsForm card={card} />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title={card.pinSet ? 'Change PIN' : 'Set a PIN'}
                  description="Four digits. Never your birthday, never a run like 1234."
                />
                <CardBody className="pt-0">
                  <PinForm cardId={card.id} pinSet={card.pinSet} />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Travel notice"
                  description="Tell us where the card should work abroad, and until when."
                />
                <CardBody className="pt-0">
                  <TravelNoticeForm cardId={card.id} />
                </CardBody>
              </Card>
            </>
          ) : null}

          <DetailsPanel card={card} />

          {!retired ? (
            <Card>
              <CardHeader
                title="Lost, stolen or compromised"
                description="Blocking is immediate and permanent. A replacement keeps your controls and limits."
              />
              <CardBody className="pt-0">
                <ReportCardForm cardId={card.id} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
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
        </dl>
      </CardBody>
    </Card>
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
