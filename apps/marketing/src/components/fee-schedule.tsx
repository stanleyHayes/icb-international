import { Card, CardBody, Reveal } from '@icb/ui';

import { Section } from '@/components/page-header';
import { RateTable } from '@/components/rate-table';
import { BUSINESS_PRODUCTS } from '@/content/products-business';
import { PERSONAL_PRODUCTS } from '@/content/products';

const TRANSFER_FEES = [
  { rail: 'Between your own ICB accounts', speed: 'Instant', fee: 'Free' },
  { rail: 'To another ICB customer', speed: 'Instant', fee: 'Free' },
  { rail: 'Domestic bank transfer', speed: 'Next business day', fee: 'Free' },
  { rail: 'Same-day wire', speed: 'Same day before 16:00 UTC', fee: '12.00 personal · 18.00 business' },
  { rail: 'International (SWIFT)', speed: 'Two business days', fee: '0.35% FX spread, no fixed fee' },
] as const;

/**
 * The fee schedule: what moving money costs on each rail, and the per-product fee cards.
 * Fees are not yet published by the API, so this section renders the curated figures every
 * product page already quotes.
 */
export function FeeSchedule() {
  return (
    <>
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
          {[...PERSONAL_PRODUCTS, ...BUSINESS_PRODUCTS].map((product, index) => (
            <Reveal key={product.slug} delay={Math.min(index, 4) * 60}>
              <Card>
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
            </Reveal>
          ))}
        </div>
      </Section>
    </>
  );
}
