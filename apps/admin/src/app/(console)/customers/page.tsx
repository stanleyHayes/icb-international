import type { CustomerAdminView, OffsetPage } from '@icb/contracts';
import { Amount, Card, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CustomerSearch } from '@/features/customers/customer-search';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Customers' };

type SearchParams = Promise<{ q?: string; status?: string; riskRating?: string; page?: string }>;

/**
 * Customer search.
 *
 * The query goes in the URL rather than component state so a support agent can paste a link to
 * exactly the result set they are looking at, and a browser refresh does not lose their place.
 */
export default async function CustomersPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const query = new URLSearchParams({ page: params.page ?? '1', limit: '25' });
  if (params.q) query.set('q', params.q);
  if (params.status) query.set('status', params.status);
  if (params.riskRating) query.set('riskRating', params.riskRating);

  const page = await api<OffsetPage<CustomerAdminView>>(`/admin/customers?${query.toString()}`);

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Customers</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Search by name, email, phone or account number.
        </p>
      </header>

      <div className="mt-6">
        <CustomerSearch
          defaultQuery={params.q ?? ''}
          defaultStatus={params.status ?? ''}
          defaultRisk={params.riskRating ?? ''}
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        {page.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <caption className="sr-only">Customer search results</caption>
              <thead>
                <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Tier
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    KYC
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Risk
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Relationship
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    Since
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--icb-border)]">
                {page.items.map((customer) => (
                  <tr key={customer.id} className="hover:bg-[var(--icb-bg-subtle)]">
                    <td className="px-5 py-3">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium hover:underline"
                      >
                        {displayName(customer)}
                      </Link>
                      <p className="text-xs text-[var(--icb-text-subtle)]">{customer.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={customer.status} />
                    </td>
                    <td className="px-3 py-3 text-xs capitalize">{customer.tier}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={customer.kyc.status} />
                    </td>
                    <td className="px-3 py-3 text-xs capitalize">{customer.riskRating}</td>
                    <td className="px-3 py-3 text-right">
                      <Amount value={customer.totalRelationshipValue} size="sm" />
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-[var(--icb-text-subtle)]">
                      {formatDate(customer.memberSince, 'medium')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Users size={20} />}
            title="No customers match"
            description="Try a different name, email, phone number or account number."
          />
        )}
      </Card>

      {page.totalPages > 1 ? (
        <p className="mt-4 text-sm text-[var(--icb-text-subtle)]">
          Page {page.page} of {page.totalPages} · {page.total} customers
        </p>
      ) : null}
    </>
  );
}

/**
 * A customer's display name.
 *
 * Derived here rather than served by the API: it is a presentation concern, and adding it to the
 * contract would mean two places deciding what a business customer is called.
 */
function displayName(customer: CustomerAdminView): string {
  if (customer.type === 'business') {
    return customer.business?.legalName ?? customer.email;
  }
  const first = customer.individual?.firstName ?? '';
  const last = customer.individual?.lastName ?? '';
  return `${first} ${last}`.trim() || customer.email;
}
