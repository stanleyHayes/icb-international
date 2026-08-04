import type { Product } from '@icb/contracts';
import { Amount, Card, EmptyState, StatusBadge } from '@icb/ui';
import { Package, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Products' };

/**
 * The product catalogue, including retired products — staff see everything, ordered as the
 * public site orders them.
 */
export default async function ProductsPage() {
  const products = await api<Product[]>('/admin/products');
  const sorted = [...products].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Products</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {products.length} product{products.length === 1 ? '' : 's'} in the catalogue ·{' '}
            {products.filter((product) => product.active).length} active
          </p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)]"
        >
          <Plus size={15} aria-hidden="true" />
          New product
        </Link>
      </header>

      <Card className="mt-6 overflow-hidden">
        {sorted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <caption className="sr-only">Product catalogue</caption>
              <thead>
                <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Kind
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Rate
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Monthly fee
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Currencies
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--icb-border)]">
                {sorted.map((product) => (
                  <tr key={product.code} className="hover:bg-[var(--icb-bg-subtle)]">
                    <td className="max-w-[300px] px-5 py-3">
                      <Link
                        href={`/products/${product.code}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
                        {product.code}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs capitalize">
                      {product.kind.replaceAll('_', ' ')}
                    </td>
                    <td className="tabular px-3 py-3 text-right text-xs">
                      {product.interestRate === null ? '—' : `${product.interestRate}%`}
                    </td>
                    <td className="px-3 py-3 text-right text-xs">
                      {product.monthlyFee ? (
                        <Amount value={product.monthlyFee} size="sm" />
                      ) : (
                        <span className="text-[var(--icb-text-subtle)]">Free</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--icb-text-subtle)]">
                      {product.currencies.join(', ')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <StatusBadge status={product.active ? 'active' : 'closed'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Package size={20} />}
            title="No products"
            description="The catalogue is empty."
          />
        )}
      </Card>
    </>
  );
}
