import type { Beneficiary, BeneficiaryVerification } from '@icb/contracts';
import { Card, CardBody, CardHeader, formatDate, formatTime } from '@icb/ui';
import { ArrowLeft, ArrowLeftRight, BadgeCheck, Clock3 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import {
  destinationKindLabel,
  inCoolingOff,
  railForBeneficiary,
} from '@/features/beneficiaries/beneficiaries.helpers';
import { EditNicknameForm } from '@/features/beneficiaries/edit-nickname-form';
import { PayeeDetailsCard, PayeeRemoveCard } from '@/features/beneficiaries/payee-cards';
import { VerificationPanel } from '@/features/beneficiaries/verification-panel';
import { api } from '@/lib/api';

type Params = Promise<{ beneficiaryId: string }>;

export async function generateMetadata({
  params,
}: Readonly<{ params: Params }>): Promise<Metadata> {
  const { beneficiaryId } = await params;
  const payee = await api<Beneficiary>(`/beneficiaries/${beneficiaryId}`, {
    tags: ['beneficiaries'],
  });
  return { title: payee.nickname ?? payee.name };
}

/** One payee: their details, cooling-off state, verification flow, and housekeeping. */
export default async function BeneficiaryDetailPage({
  params,
}: Readonly<{ params: Params }>) {
  const { beneficiaryId } = await params;
  const [payee, verification] = await Promise.all([
    api<Beneficiary>(`/beneficiaries/${beneficiaryId}`, { tags: ['beneficiaries'] }),
    api<BeneficiaryVerification>(`/beneficiaries/${beneficiaryId}/verify`, {
      tags: ['beneficiaries'],
    }),
  ]);

  const rail = railForBeneficiary(payee);
  const verifiable = payee.destination.kind !== 'icb_customer';

  return (
    <>
      <Link
        href="/beneficiaries"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Payees
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            {payee.nickname ?? payee.name}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            {destinationKindLabel(payee)} ·{' '}
            <span className="font-mono">{payee.displayIdentifier}</span>
            {payee.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--icb-success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--icb-success-fg)]">
                <BadgeCheck size={12} aria-hidden="true" />
                Verified
              </span>
            ) : null}
          </p>
        </div>
        {rail ? (
          <Link
            href={`/transfer/new?rail=${rail}&payee=${payee.id}`}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)]"
          >
            <ArrowLeftRight size={16} />
            Pay {payee.nickname ?? payee.name}
          </Link>
        ) : null}
      </header>

      {inCoolingOff(payee) && payee.coolingOffUntil ? (
        <p
          role="status"
          className="mt-6 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-warning-border)] bg-[var(--icb-warning-bg)] px-4 py-3 text-sm text-[var(--icb-warning-fg)]"
        >
          <Clock3 size={16} className="mt-0.5 shrink-0" />
          New payee cooling-off: transfers to {payee.name} are limited until{' '}
          {formatDate(payee.coolingOffUntil, 'medium')} · {formatTime(payee.coolingOffUntil)}.
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          {verifiable ? (
            <Card>
              <CardHeader
                title="Account verification"
                description="Confirm these details really belong to who you think they do."
              />
              <CardBody className="pt-0">
                <VerificationPanel beneficiaryId={payee.id} initial={verification} />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Nickname" />
            <CardBody className="pt-0">
              <EditNicknameForm beneficiaryId={payee.id} initialNickname={payee.nickname ?? ''} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <PayeeDetailsCard payee={payee} />
          <PayeeRemoveCard payee={payee} />
        </div>
      </div>
    </>
  );
}
