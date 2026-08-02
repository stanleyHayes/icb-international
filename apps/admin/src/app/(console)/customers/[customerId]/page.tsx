import type { CustomerAdminView } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { api } from '@/lib/api';

type Params = Promise<{ customerId: string }>;

export const metadata: Metadata = { title: 'Customer' };

/**
 * The customer 360.
 *
 * Everything a support agent needs on one screen so they are not switching tabs while a customer
 * waits: identity, standing, verification state, relationship value and risk posture.
 */
export default async function CustomerDetailPage({ params }: Readonly<{ params: Params }>) {
  const { customerId } = await params;
  const customer = await api<CustomerAdminView>(`/admin/customers/${customerId}`);

  return (
    <>
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        All customers
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            {displayName(customer)}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            {customer.email}
            <StatusBadge status={customer.status} />
            <span className="capitalize">{customer.tier} tier</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
            Relationship value
          </p>
          <p className="mt-1">
            <Amount value={customer.totalRelationshipValue} size="xl" />
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Identity" />
          <CardBody className="pt-0">
            <dl className="space-y-3 text-sm">
              <Row label="Customer id" value={customer.id} mono />
              <Row label="Type" value={customer.type} capitalise />
              <Row label="Email" value={customer.email} />
              <Row label="Phone" value={customer.phone} mono />
              <Row
                label="Address"
                value={
                  customer.residentialAddress
                    ? `${customer.residentialAddress.line1}, ${customer.residentialAddress.city}, ${customer.residentialAddress.country}`
                    : 'Not provided'
                }
              />
              <Row label="Customer since" value={formatDate(customer.memberSince, 'long')} />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Verification and risk" />
          <CardBody className="pt-0">
            <dl className="space-y-3 text-sm">
              <Row
                label="KYC status"
                value={<StatusBadge status={customer.kyc.status} />}
                raw
              />
              <Row label="KYC tier" value={customer.kyc.level ?? 'Not assigned'} capitalise />
              <Row
                label="Verified"
                value={
                  customer.kyc.verifiedAt
                    ? formatDate(customer.kyc.verifiedAt, 'medium')
                    : 'Not verified'
                }
              />
              <Row
                label="Next review"
                value={
                  customer.kyc.nextReviewAt
                    ? formatDate(customer.kyc.nextReviewAt, 'medium')
                    : 'Not scheduled'
                }
              />
              <Row label="Risk rating" value={customer.riskRating} capitalise />
              <Row label="Open accounts" value={String(customer.accountCount)} />
            </dl>
          </CardBody>
        </Card>
      </div>

      {customer.flags.length > 0 ? (
        <Card className="mt-6">
          <CardHeader title="Flags" description="Raised by staff or by the risk engine" />
          <ul className="divide-y divide-[var(--icb-border)]">
            {customer.flags.map((flag) => (
              <li key={flag.code} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium">{flag.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                    Raised by {flag.raisedBy} on {formatDate(flag.raisedAt, 'medium')}
                  </p>
                </div>
                <StatusBadge status={flag.severity} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function Row({
  label,
  value,
  mono = false,
  capitalise = false,
  raw = false,
}: Readonly<{
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  capitalise?: boolean;
  raw?: boolean;
}>) {
  const className = [
    'text-right break-all',
    mono ? 'font-mono text-xs' : '',
    capitalise && !raw ? 'capitalize' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  );
}

/** Presentation-only, so it lives here rather than in the contract. */
function displayName(customer: CustomerAdminView): string {
  if (customer.type === 'business') {
    return customer.business?.legalName ?? customer.email;
  }
  const first = customer.individual?.firstName ?? '';
  const last = customer.individual?.lastName ?? '';
  return `${first} ${last}`.trim() || customer.email;
}
