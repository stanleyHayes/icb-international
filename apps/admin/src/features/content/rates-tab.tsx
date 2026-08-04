import type { RateTable } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, EmptyState, formatDate, formatTime } from '@icb/ui';
import { Percent } from 'lucide-react';

import { deleteRateEntryAction } from './rate-actions';
import { RateForm } from './rate-form';
import { RowDeleteButton } from './row-delete-button';
import type { RateEntryView } from './types';

/**
 * The rates tab.
 *
 * Top: the published rate table exactly as the public site serves it, with content overrides
 * already layered on — the read-back. Below: the content-managed entries behind those
 * overrides, where a figure can be corrected without touching the product catalogue.
 */
export function RatesTab({
  table,
  entries,
}: Readonly<{ table: RateTable; entries: RateEntryView[] }>) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[var(--icb-text-muted)]">
          In force since {formatDate(table.effectiveFrom, 'medium')} at{' '}
          {formatTime(table.effectiveFrom)} — as shown on the public site, content overrides
          included.
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <RateCard
            title="Savings"
            description="Standard savings products"
            rows={table.savings.map((item) => ({
              key: item.productCode,
              label: item.name,
              value: `${item.rate}%`,
            }))}
          />
          <RateCard
            title="Term deposits"
            description="By term length"
            rows={table.deposits.map((item) => ({
              key: String(item.termMonths),
              label: `${item.termMonths} months`,
              value: `${item.rate}%`,
              aside: <Amount value={item.minimumAmount} size="sm" />,
            }))}
          />
          <RateCard
            title="Loans"
            description="Indicative range by product"
            rows={table.loans.map((item) => ({
              key: item.productCode,
              label: item.name,
              value: `${item.fromRate}–${item.toRate}%`,
            }))}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Content rate entries"
          description="Overrides layered onto the catalogue's rate schedules, keyed by product code."
        />
        {entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <caption className="sr-only">Content rate entries</caption>
              <thead>
                <tr className="border-y border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Product code
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Rate
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Effective from
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--icb-border)]">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[var(--icb-bg-subtle)]">
                    <td className="px-5 py-3 font-mono text-xs font-medium">
                      {entry.productCode}
                    </td>
                    <td className="px-3 py-3 text-sm">{entry.name}</td>
                    <td className="tabular px-3 py-3 text-right text-sm font-semibold">
                      {entry.rate}%
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--icb-text-subtle)]">
                      {formatDate(entry.effectiveFrom, 'medium')}{' '}
                      {formatTime(entry.effectiveFrom)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <RowDeleteButton
                        action={deleteRateEntryAction}
                        field="entryId"
                        id={entry.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Percent size={20} />}
            title="No rate entries"
            description="The published table is coming straight from the product catalogue."
          />
        )}
      </Card>

      <Card>
        <CardHeader
          title="Save a rate entry"
          description="Upserts by product code — an existing code replaces its entry."
        />
        <CardBody>
          <RateForm />
        </CardBody>
      </Card>
    </div>
  );
}

interface RateRow {
  key: string;
  label: string;
  value: string;
  aside?: React.ReactNode;
}

function RateCard({
  title,
  description,
  rows,
}: Readonly<{ title: string; description: string; rows: RateRow[] }>) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} description={description} />
      {rows.length > 0 ? (
        <ul className="divide-y divide-[var(--icb-border)]">
          {rows.map((row) => (
            <li key={row.key} className="flex items-baseline justify-between gap-4 px-5 py-3">
              <span className="text-sm">{row.label}</span>
              <span className="text-right">
                <span className="tabular text-sm font-semibold">{row.value}</span>
                {row.aside ? (
                  <span className="mt-0.5 block text-xs text-[var(--icb-text-subtle)]">
                    from {row.aside}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 pb-5 text-sm text-[var(--icb-text-subtle)]">Nothing published.</p>
      )}
    </Card>
  );
}
