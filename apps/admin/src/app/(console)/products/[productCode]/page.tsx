import type { Product } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CoreDetailsForm } from '@/features/products/core-details-form';
import { EligibilityForm } from '@/features/products/eligibility-form';
import { FeeEditor } from '@/features/products/fee-editor';
import { setActiveAction } from '@/features/products/product-actions';
import { RateForm } from '@/features/products/rate-form';
import { ConfirmAction } from '@/features/support/confirm-action';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Product' };

type Params = Promise<{ productCode: string }>;

/**
 * One product, editable.
 *
 * Copy, pricing, fees and eligibility are separate cards because they change for different
 * reasons and on different cadences — a rate move should never require touching the fee
 * schedule, and the interface keeps them apart the way the catalogue does.
 */
export default async function ProductPage({ params }: Readonly<{ params: Params }>) {
  const { productCode } = await params;
  const product = await api<Product>(`/products/${productCode}`);
  const statusAction = product.active
    ? {
        trigger: 'Retire product',
        variant: 'danger' as const,
        title: `Retire ${product.name}?`,
        description:
          'Retired products disappear from the public catalogue and can no longer be opened. Existing accounts are unaffected.',
        confirm: 'Retire product',
        next: 'false',
        danger: true,
      }
    : {
        trigger: 'Reactivate product',
        variant: 'secondary' as const,
        title: `Reactivate ${product.name}?`,
        description: 'The product returns to the public catalogue and can be opened again.',
        confirm: 'Reactivate',
        next: 'true',
        danger: false,
      };

  return (
    <>
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Products
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">{product.name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            <StatusBadge status={product.active ? 'active' : 'closed'} />
            <span className="capitalize">{product.kind.replaceAll('_', ' ')}</span>
            <span className="font-mono text-xs">{product.code}</span>
            <span>{product.currencies.join(', ')}</span>
          </p>
        </div>
        <ConfirmAction
          triggerLabel={statusAction.trigger}
          triggerVariant={statusAction.variant}
          title={statusAction.title}
          description={statusAction.description}
          confirmLabel={statusAction.confirm}
          danger={statusAction.danger}
          action={setActiveAction}
          fields={{ productCode: product.code, active: statusAction.next }}
        />
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Terms" description="What the account holder signs up to." />
            <CardBody className="pt-0">
              <TermsList product={product} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Details" description="The copy customers read." />
            <CardBody className="pt-0">
              <CoreDetailsForm product={product} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Eligibility"
              description="Who may open this product at application time."
            />
            <CardBody className="pt-0">
              <EligibilityForm product={product} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Rate schedule"
              description="Effective-dated changes; accrual resolves the rate for any day."
            />
            <CardBody className="pt-0">
              <RateForm productCode={product.code} currentRate={product.interestRate} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Fee schedule"
              description="Edited as a set, published with confirmation."
            />
            <CardBody className="pt-0">
              <FeeEditor product={product} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function TermsList({ product }: Readonly<{ product: Product }>) {
  return (
    <dl className="space-y-3 text-sm">
      <TermRow label="Interest rate">
        {product.interestRate === null ? 'None' : `${product.interestRate}%`}
      </TermRow>
      <TermRow label="Monthly fee">
        {product.monthlyFee ? <Amount value={product.monthlyFee} size="sm" /> : 'Free'}
      </TermRow>
      <TermRow label="Minimum opening balance">
        {product.minimumOpeningBalance ? (
          <Amount value={product.minimumOpeningBalance} size="sm" />
        ) : (
          'None'
        )}
      </TermRow>
      <TermRow label="Minimum ongoing balance">
        {product.minimumBalance ? <Amount value={product.minimumBalance} size="sm" /> : 'None'}
      </TermRow>
    </dl>
  );
}

function TermRow({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--icb-text-subtle)]">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
