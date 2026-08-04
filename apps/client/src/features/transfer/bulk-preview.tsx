'use client';

import { Button, Card, CardBody, CardHeader, formatMoney } from '@icb/ui';

import type { ParsedBulkRow } from './bulk-csv';

interface BulkPreviewProps {
  rows: ParsedBulkRow[];
  currency: string;
  accountLabel: string;
  busy: boolean;
  error: string | null;
  onStartOver: () => void;
  onSubmit: () => void;
}

/**
 * The pre-submission review: every parsed row, invalid ones highlighted, the batch total, and
 * the submit gate. Nothing reaches the API until this view is acknowledged.
 */
export function BulkPreview({
  rows,
  currency,
  accountLabel,
  busy,
  error,
  onStartOver,
  onSubmit,
}: Readonly<BulkPreviewProps>) {
  const invalidCount = rows.filter((row) => row.error !== null).length;
  const totalMinorUnits = rows.reduce((sum, row) => sum + (row.amountMinorUnits ?? 0), 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={`3 · Review ${rows.length} payment${rows.length === 1 ? '' : 's'}`}
        description={`Total ${formatMoney({ minorUnits: totalMinorUnits, currency })} from ${accountLabel}.`}
      />
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[var(--icb-bg-muted)] text-left text-xs text-[var(--icb-text-subtle)]">
            <tr>
              <th scope="col" className="px-5 py-2 font-medium">
                #
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Recipient
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Account
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Amount
              </th>
              <th scope="col" className="px-5 py-2 font-medium">
                Issue
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {rows.map((row) => (
              <tr key={row.rowNumber} className={row.error ? 'bg-[var(--icb-danger-bg)]' : ''}>
                <td className="px-5 py-2.5 text-[var(--icb-text-subtle)]">{row.rowNumber}</td>
                <td className="px-3 py-2.5">{row.accountHolderName || '—'}</td>
                <td className="px-3 py-2.5 font-mono text-xs">
                  {row.sortCode} {row.accountNumber}
                </td>
                <td className="px-3 py-2.5 text-right tabular">
                  {row.amountMinorUnits !== null
                    ? formatMoney({ minorUnits: row.amountMinorUnits, currency })
                    : '—'}
                </td>
                <td className="px-5 py-2.5 text-xs text-[var(--icb-danger-fg)]">{row.error ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CardBody className="space-y-4 border-t border-[var(--icb-border)]">
        {invalidCount > 0 ? (
          <p role="alert" className="text-sm font-medium text-[var(--icb-danger-fg)]">
            {invalidCount} row{invalidCount === 1 ? '' : 's'} cannot be submitted. Fix the file and
            upload it again.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onStartOver} disabled={busy}>
            Start over
          </Button>
          <Button disabled={invalidCount > 0 || busy} loading={busy} onClick={onSubmit}>
            {busy ? 'Submitting…' : `Submit ${rows.length} payments`}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
