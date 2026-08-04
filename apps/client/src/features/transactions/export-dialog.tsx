'use client';

import type { AccountSummary } from '@icb/contracts';
import { Button, Dialog, Field, Input, Select } from '@icb/ui';
import { Download } from 'lucide-react';
import { useState, useTransition } from 'react';

import { exportTransactions } from './actions';

const FORMATS = [
  { value: 'csv', label: 'CSV — spreadsheet' },
  { value: 'ofx', label: 'OFX — accounting software' },
  { value: 'pdf', label: 'PDF — printable statement of activity' },
] as const;

function defaultFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().slice(0, 10);
}

/**
 * Export the ledger to CSV, OFX or PDF.
 *
 * The action answers with an in-app path and the browser navigates to it; the route handler
 * there streams the file from the API with the session token attached, so the bearer token is
 * never in a URL the browser could leak.
 */
export function ExportDialog({
  accounts,
}: Readonly<{ accounts: Pick<AccountSummary, 'id' | 'nickname' | 'productName'>[] }>) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await exportTransactions(formData);
      if (result.error || !result.downloadPath) {
        setError(result.error ?? 'We could not create the export. Please try again.');
        return;
      }
      setOpen(false);
      window.location.assign(result.downloadPath);
    });
  }

  return (
    <>
      <Button variant="secondary" leadingIcon={<Download size={16} />} onClick={() => setOpen(true)}>
        Export
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Export transactions"
        description="Choose an account and a period. The file is generated from the posted ledger."
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Account" id="export-account">
            <Select id="export-account" name="accountId" required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.nickname ?? account.productName}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" id="export-from">
              <Input id="export-from" name="from" type="date" required defaultValue={defaultFrom()} />
            </Field>
            <Field label="To" id="export-to">
              <Input
                id="export-to"
                name="to"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </Field>
          </div>
          <Field label="Format" id="export-format">
            <Select id="export-format" name="format" required>
              {FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </Select>
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Download
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
