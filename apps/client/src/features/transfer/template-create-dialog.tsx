'use client';

import type { AccountSummary } from '@icb/contracts';
import {
  Button,
  Dialog,
  Field,
  Input,
  MoneyInput,
  RadioGroup,
  Select,
  maskIdentifier,
} from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { saveTemplateAction } from './template-actions';

type DestinationKind = 'icb_customer' | 'domestic_bank';

interface TemplateFields {
  name: string;
  holderName: string;
  accountNumber: string;
  sortCode: string;
  reference: string;
}

function destinationValid(kind: DestinationKind, fields: TemplateFields): boolean {
  if (kind === 'icb_customer') {
    return /^\d{10}$/.test(fields.accountNumber);
  }
  return (
    fields.holderName.trim().length > 0 &&
    /^\d{2}-\d{2}-\d{2}$/.test(fields.sortCode) &&
    fields.accountNumber.trim().length >= 6
  );
}

/**
 * Create a template by hand. Templates capture terms, not a moment — the quote and confirm
 * steps still run every time one is used.
 */
export function TemplateCreateDialog({
  accounts,
  open,
  onClose,
}: Readonly<{ accounts: AccountSummary[]; open: boolean; onClose: () => void }>) {
  const router = useRouter();
  const [fields, setFields] = useState<TemplateFields>({
    name: '',
    holderName: '',
    accountNumber: '',
    sortCode: '',
    reference: '',
  });
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? '');
  const [kind, setKind] = useState<DestinationKind>('icb_customer');
  const [amountMinorUnits, setAmountMinorUnits] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (changes: Partial<TemplateFields>) =>
    setFields((current) => ({ ...current, ...changes }));
  const currency = accounts.find((a) => a.id === fromAccountId)?.currency ?? 'USD';
  const ready = fields.name.trim().length > 0 && destinationValid(kind, fields);

  async function save() {
    setBusy(true);
    setError(null);
    const destination =
      kind === 'icb_customer'
        ? ({ kind, accountNumber: fields.accountNumber } as const)
        : ({
            kind,
            accountHolderName: fields.holderName.trim(),
            sortCode: fields.sortCode,
            accountNumber: fields.accountNumber.trim(),
          } as const);
    const result = await saveTemplateAction({
      name: fields.name.trim(),
      fromAccountId,
      destination,
      amountMinorUnits,
      currency,
      ...(fields.reference.trim() ? { reference: fields.reference.trim() } : {}),
    });
    setBusy(false);
    if (result.ok) {
      router.refresh();
      onClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New template" size="lg">
      <div className="space-y-5">
        {error ? (
          <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
            {error}
          </p>
        ) : null}

        <Field label="Template name" required>
          <Input
            value={fields.name}
            onChange={(event) => patch({ name: event.target.value })}
            maxLength={60}
            placeholder="e.g. Monthly rent"
          />
        </Field>

        <Field label="From account" required>
          <Select value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.nickname ?? account.productName} ·{' '}
                {maskIdentifier(account.identifiers.number)}
              </option>
            ))}
          </Select>
        </Field>

        <RadioGroup
          name="template-destination-kind"
          value={kind}
          onChange={(value) => setKind(value as DestinationKind)}
          options={[
            { value: 'icb_customer', label: 'ICB customer' },
            { value: 'domestic_bank', label: 'Another bank (domestic)' },
          ]}
        />

        <TemplateDestinationFields kind={kind} fields={fields} patch={patch} />

        <Field label="Amount" description="Leave empty to enter it each time.">
          <MoneyInput value={amountMinorUnits} onChange={setAmountMinorUnits} currency={currency} />
        </Field>

        <Field label="Reference">
          <Input
            value={fields.reference}
            onChange={(event) => patch({ reference: event.target.value })}
            maxLength={140}
          />
        </Field>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={!ready || busy} loading={busy} onClick={() => void save()}>
            Save template
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function TemplateDestinationFields({
  kind,
  fields,
  patch,
}: Readonly<{
  kind: DestinationKind;
  fields: TemplateFields;
  patch: (changes: Partial<TemplateFields>) => void;
}>) {
  if (kind === 'icb_customer') {
    return (
      <Field label="ICB account number" required>
        <Input
          value={fields.accountNumber}
          onChange={(event) => patch({ accountNumber: event.target.value.trim() })}
          inputMode="numeric"
          maxLength={10}
          className="font-mono"
        />
      </Field>
    );
  }
  return (
    <>
      <Field label="Account holder name" required>
        <Input
          value={fields.holderName}
          onChange={(event) => patch({ holderName: event.target.value })}
          maxLength={140}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Sort code" required>
          <Input
            value={fields.sortCode}
            onChange={(event) => patch({ sortCode: event.target.value })}
            placeholder="00-00-00"
            maxLength={8}
            className="font-mono"
          />
        </Field>
        <Field label="Account number" required>
          <Input
            value={fields.accountNumber}
            onChange={(event) => patch({ accountNumber: event.target.value.trim() })}
            inputMode="numeric"
            maxLength={20}
            className="font-mono"
          />
        </Field>
      </div>
    </>
  );
}
