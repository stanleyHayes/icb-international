import { Card, CardBody } from '@icb/ui';
import type { Metadata } from 'next';

import { PageHeader, Section } from '@/components/page-header';
import { BUSINESS_PRODUCTS, PERSONAL_PRODUCTS } from '@/content/products';

export const metadata: Metadata = {
  title: 'Rates & fees',
  description:
    'Every ICB rate and fee in one table, with the basis for each figure stated alongside it.',
};

const SAVINGS_RATES = [
  { product: 'Reserve Savings', balance: 'Any balance', rate: '4.15%', basis: 'AER, variable' },
  { product: 'Reserve Savings', balance: 'Over 50,000', rate: '4.35%', basis: 'AER, variable' },
  { product: 'Everyday Current', balance: 'Any credit balance', rate: '0.25%', basis: 'AER, variable' },
] as const;

const DEPOSIT_RATES = [
  { term: '1 month', minimum: '500', rate: '3.80%' },
  { term: '3 months', minimum: '500', rate: '4.40%' },
  { term: '6 months', minimum: '1,000', rate: '4.85%' },
  { term: '12 months', minimum: '1,000', rate: '5.20%' },
  { term: '24 months', minimum: '5,000', rate: '5.05%' },
  { term: '60 months', minimum: '10,000', rate: '4.75%' },
] as const;

const TRANSFER_FEES = [
  { rail: 'Between your own ICB accounts', speed: 'Instant', fee: 'Free' },
  { rail: 'To another ICB customer', speed: 'Instant', fee: 'Free' },
  { rail: 'Domestic bank transfer', speed: 'Next business day', fee: 'Free' },
  { rail: 'Same-day wire', speed: 'Same day before 16:00 UTC', fee: '12.00 personal · 18.00 business' },
  { rail: 'International (SWIFT)', speed: 'Two business days', fee: '0.35% FX spread, no fixed fee' },
] as const;

/**
 * The rates page.
 *
 * Every figure carries its basis — AER, fixed, representative APR, spread. A page of bare
 * percentages is not disclosure, and this is the page a customer will quote back at us.
 */
export default function RatesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Rates &amp; fees"
        title="Every figure, and what it is measured against"
        standfirst="No introductory rates that revert, no fees that appear at the confirmation screen. If a charge is not on this page, we do not make it."
      />

      <Section title="Savings and credit interest" tone="subtle">
        <RateTable
          caption="Savings and credit interest rates"
          columns={['Product', 'Balance', 'Rate', 'Basis']}
          rows={SAVINGS_RATES.map((r) => [r.product, r.balance, r.rate, r.basis])}
        />
      </Section>

      <Section
        title="Fixed term deposits"
        description="The rate is fixed for the whole term. Breaking early forfeits a share of accrued interest, quoted to the cent before you confirm."
      >
        <RateTable
          caption="Fixed term deposit rates"
          columns={['Term', 'Minimum', 'Rate (fixed)']}
          rows={DEPOSIT_RATES.map((r) => [r.term, r.minimum, r.rate])}
        />
      </Section>

      <Section title="Moving money" tone="subtle">
        <RateTable
          caption="Transfer speeds and fees by rail"
          columns={['Destination', 'Arrives', 'Fee']}
          rows={TRANSFER_FEES.map((r) => [r.rail, r.speed, r.fee])}
        />
        <p className="mt-6 max-w-2xl text-sm text-[var(--icb-text-muted)]">
          Every transfer shows its rail, its fee and its expected arrival before you confirm. A
          payment submitted after a rail&rsquo;s cut-off is dated to the next business day, and we
          tell you so at the point of confirmation rather than afterwards.
        </p>
      </Section>

      <Section title="Product fees">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[...PERSONAL_PRODUCTS, ...BUSINESS_PRODUCTS].map((product) => (
            <Card key={product.slug}>
              <CardBody className="pt-5">
                <h3 className="text-base font-semibold">{product.name}</h3>
                <dl className="mt-4">
                  {product.fees.map((fee) => (
                    <div
                      key={fee.label}
                      className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] py-2 last:border-0"
                    >
                      <dt className="text-sm text-[var(--icb-text-muted)]">{fee.label}</dt>
                      <dd className="tabular text-sm font-semibold">{fee.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}

function RateTable({
  caption,
  columns,
  rows,
}: Readonly<{ caption: string; columns: readonly string[]; rows: readonly (readonly string[])[] }>) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-muted)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
              {columns.map((column) => (
                <th key={column} scope="col" className="px-5 py-2.5 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {rows.map((row) => (
              <tr key={row.join('|')}>
                {row.map((cell, index) => (
                  <td
                    key={cell + String(index)}
                    className={
                      index === 0
                        ? 'px-5 py-3 font-medium'
                        : 'tabular px-5 py-3 text-[var(--icb-text-muted)]'
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
