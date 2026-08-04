'use client';

import type { CurrencyCode } from '@icb/money';
import { Field, MoneyInput } from '@icb/ui';
import { useState, type ReactNode } from 'react';

interface MoneyFieldProps {
  readonly name: string;
  readonly label: string;
  readonly currency: CurrencyCode;
  readonly defaultMinorUnits?: number | null;
  readonly description?: ReactNode;
  readonly error?: string;
}

/**
 * A money form field for server-action forms.
 *
 * `MoneyInput` is controlled, but the console's forms post plain `FormData`, so the integer
 * minor units are mirrored into a hidden input — the wire value is never a float (N3) and no
 * parsing happens in the action beyond an int check. Empty means "not set" (null).
 */
export function MoneyField({
  name,
  label,
  currency,
  defaultMinorUnits = null,
  description,
  error,
}: Readonly<MoneyFieldProps>) {
  const [value, setValue] = useState<number | null>(defaultMinorUnits);

  return (
    <Field
      label={label}
      {...(description !== undefined ? { description } : {})}
      {...(error !== undefined ? { error } : {})}
    >
      <MoneyInput value={value} onChange={setValue} currency={currency} />
      <input type="hidden" name={name} value={value ?? ''} />
    </Field>
  );
}
