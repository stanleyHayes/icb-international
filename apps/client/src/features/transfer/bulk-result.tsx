'use client';

import type { BulkTransferResult } from '@icb/contracts';
import { Amount, Button, Card, CardBody } from '@icb/ui';
import { CheckCircle2, FileUp } from 'lucide-react';

/** The API's verdict on a submitted batch: accepted, rejected, and the rows that failed. */
export function BulkResult({
  result,
  currency,
  onReset,
}: Readonly<{ result: BulkTransferResult; currency: string; onReset: () => void }>) {
  return (
    <Card>
      <CardBody className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--icb-success-bg)] text-[var(--icb-success-fg)]">
          <CheckCircle2 size={24} />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Batch submitted</h2>
        <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
          {result.accepted} accepted · {result.rejected} rejected · total{' '}
          <Amount value={{ minorUnits: result.totalDebit.minorUnits, currency }} size="sm" />
        </p>
        {result.failures.length > 0 ? (
          <ul className="mx-auto mt-5 max-w-md space-y-2 text-left">
            {result.failures.map((failure) => (
              <li
                key={failure.rowNumber}
                className="rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-2.5 text-sm text-[var(--icb-danger-fg)]"
              >
                Row {failure.rowNumber}: {failure.message} ({failure.code})
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={onReset}>
            <FileUp size={16} />
            Upload another batch
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
