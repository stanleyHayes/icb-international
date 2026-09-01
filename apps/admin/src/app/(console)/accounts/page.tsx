import type { CustomerAdminView } from '@icb/contracts';
import { Button, Card, CardBody, CardHeader, EmptyState, Input, StatusBadge } from '@icb/ui';
import { Search, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { searchCustomers } from '@/features/accounts/api';
import { AccountLookup } from '@/features/accounts/account-lookup';

export const metadata: Metadata = { title: 'Accounts' };

type SearchParams = Promise<{ q?: string }>;

function displayName(customer: CustomerAdminView): string {
  if (customer.type === 'business') {
    return customer.business?.legalName ?? customer.email;
  }
  const first = customer.individual?.firstName ?? '';
  const last = customer.individual?.lastName ?? '';
  return `${first} ${last}`.trim() || customer.email;
}

function CustomerHits({ customers }: Readonly<{ customers: CustomerAdminView[] }>) {
  if (customers.length === 0) {
    return (
      <EmptyState
        icon={<Search size={20} />}
        title="No matches"
        description="Try a different account number, email, phone number, or name."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <caption className="sr-only">Customers matching the search</caption>
        <thead>
          <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
            <th scope="col" className="px-5 py-2.5 font-medium">
              Customer
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Email
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Status
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Tier
            </th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">
              Accounts
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--icb-border)]">
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-[var(--icb-bg-subtle)]">
              <td className="px-5 py-3">
                <Link href={`/customers/${customer.id}`} className="font-medium hover:underline">
                  {displayName(customer)}
                </Link>
                <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
                  {customer.id.slice(0, 10)}
                </p>
              </td>
              <td className="px-3 py-3 text-xs">{customer.email}</td>
              <td className="px-3 py-3">
                <StatusBadge status={customer.status} />
              </td>
              <td className="px-3 py-3 text-xs capitalize">{customer.tier}</td>
              <td className="px-5 py-3 text-right tabular">{customer.accountCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Account operations start by finding the account.
 *
 * Most operators arrive with an account number quoted over the phone, so the search leans on the
 * customer directory — it matches account-number fragments as well as names, emails and phones.
 * With the account id already in hand, the lookup jumps straight to the account.
 */
export default async function AccountsPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';
  const results = query.length >= 2 ? await searchCustomers(query) : null;

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Accounts</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Find an account to operate on — by account number, IBAN, or the customer behind it.
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Search"
            description="Account number, IBAN, name, email, or phone number"
          />
          <CardBody className="pt-0">
            <form method="get" action="/accounts" className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
                <span className="sr-only">Search accounts</span>
                <Input
                  key={query}
                  type="search"
                  name="q"
                  defaultValue={query}
                  minLength={2}
                  placeholder="e.g. last digits of the account number"
                  startIcon={<Search size={16} />}
                />
              </label>
              <Button type="submit">Search</Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Direct lookup" description="Open an account from its id" />
          <CardBody className="pt-0">
            <AccountLookup />
          </CardBody>
        </Card>
      </div>

      {results ? (
        <Card className="mt-6 overflow-hidden">
          <CardHeader
            title={`${results.total} match${results.total === 1 ? '' : 'es'}`}
            description="Open the customer to see their accounts, then drill into the one you need"
          />
          <CustomerHits customers={results.items} />
        </Card>
      ) : (
        <Card className="mt-6">
          <EmptyState
            icon={<Wallet size={20} />}
            title="Start with a search"
            description="Operations on an account — status, overdraft, product, interest, postings and holds — live on the account page."
          />
        </Card>
      )}
    </>
  );
}
