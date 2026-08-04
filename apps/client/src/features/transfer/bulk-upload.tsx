'use client';

import type { AccountSummary } from '@icb/contracts';
import {
  Card,
  CardBody,
  CardHeader,
  Field,
  FileDropzone,
  Select,
  maskIdentifier,
} from '@icb/ui';
import { AlertCircle } from 'lucide-react';

import { BulkPreview } from './bulk-preview';
import { BulkResult } from './bulk-result';
import { BULK_CSV_HEADERS } from './transfer.constants';
import { useBulkUpload } from './use-bulk-upload';

/**
 * The bulk-upload flow: drop a CSV, review every parsed row with its validation errors,
 * confirm, then see the API's accepted/rejected tally. Nothing is submitted until the preview
 * is acknowledged.
 */
export function BulkUpload({ accounts }: Readonly<{ accounts: AccountSummary[] }>) {
  const flow = useBulkUpload(accounts);

  if (flow.stage === 'done' && flow.result) {
    return <BulkResult result={flow.result} currency={flow.currency} onReset={flow.reset} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="1 · Choose the paying account"
          description="All rows debit this account, in its currency."
        />
        <CardBody className="pt-0">
          <Field label="From" required>
            <Select
              value={flow.fromAccountId}
              onChange={(event) => flow.setFromAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.nickname ?? account.productName} ·{' '}
                  {maskIdentifier(account.identifiers.number)}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="2 · Upload the CSV"
          description={`Columns, in order: ${BULK_CSV_HEADERS.join(', ')}. Amounts are major units, e.g. 250.00.`}
        />
        <CardBody className="pt-0">
          <FileDropzone
            accept=".csv,text/csv"
            maxFiles={1}
            hint="Drop your CSV here, or browse"
            onChange={(files) => void flow.onFiles(files)}
          />
          {flow.fileError ? (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 text-sm text-[var(--icb-danger-fg)]"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {flow.fileError}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {flow.stage === 'preview' ? (
        <BulkPreview
          rows={flow.rows}
          currency={flow.currency}
          accountLabel={flow.account?.nickname ?? flow.account?.productName ?? ''}
          busy={flow.busy}
          error={flow.error}
          onStartOver={flow.reset}
          onSubmit={() => void flow.submit()}
        />
      ) : null}
    </div>
  );
}
