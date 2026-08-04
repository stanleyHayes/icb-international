'use client';

import { Field, Input } from '@icb/ui';

import type { FormFields, PatchFields } from './beneficiary-form-types';

/** The per-kind account detail inputs for the add-payee form. */
export function PayeeDestinationFields({
  fields,
  patch,
}: Readonly<{ fields: FormFields; patch: PatchFields }>) {
  if (fields.kind === 'icb_customer') {
    return (
      <Field label="ICB account number" required>
        <Input
          value={fields.accountNumber}
          onChange={(event) => patch({ accountNumber: event.target.value.trim() })}
          inputMode="numeric"
          maxLength={10}
          placeholder="10 digits"
          className="font-mono"
        />
      </Field>
    );
  }

  if (fields.kind === 'domestic_bank') {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Sort code" required description="Formatted 00-00-00.">
          <Input
            value={fields.sortCode}
            onChange={(event) => patch({ sortCode: event.target.value })}
            inputMode="numeric"
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
    );
  }

  return (
    <>
      <Field label="IBAN" required>
        <Input
          value={fields.iban}
          onChange={(event) => patch({ iban: event.target.value })}
          maxLength={34}
          className="font-mono"
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="SWIFT / BIC" required>
          <Input
            value={fields.bic}
            onChange={(event) => patch({ bic: event.target.value })}
            minLength={8}
            maxLength={11}
            className="font-mono"
          />
        </Field>
        <Field label="Country" required description="Two-letter code, e.g. DE.">
          <Input
            value={fields.country}
            onChange={(event) => patch({ country: event.target.value.toUpperCase() })}
            maxLength={2}
            className="font-mono uppercase"
          />
        </Field>
      </div>
      <Field label="Bank name">
        <Input
          value={fields.bankName}
          onChange={(event) => patch({ bankName: event.target.value })}
          maxLength={140}
        />
      </Field>
    </>
  );
}
