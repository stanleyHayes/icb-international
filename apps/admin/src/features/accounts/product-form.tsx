'use client';

import { Button, Field, Select, Textarea } from '@icb/ui';
import { useState } from 'react';

import { changeProduct } from '@/features/accounts/actions';
import { OpMessage, useOpForm } from '@/features/accounts/use-op-form';

export interface ProductOption {
  code: string;
  name: string;
}

/**
 * Move the account to another product of the same kind and currency — the page filters the
 * catalogue, so an operator can never be offered an incompatible product.
 */
export function ProductForm({
  accountId,
  products,
}: Readonly<{ accountId: string; products: ProductOption[] }>) {
  const [productCode, setProductCode] = useState('');
  const [reason, setReason] = useState('');
  const form = useOpForm(changeProduct);

  if (products.length === 0) {
    return (
      <p className="text-sm text-[var(--icb-text-subtle)]">
        No alternative products are available for this account.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit({ accountId, productCode, reason });
      }}
    >
      <Field label="New product" required>
        <Select
          name="productCode"
          value={productCode}
          onChange={(event) => setProductCode(event.target.value)}
          required
        >
          <option value="" disabled>
            Choose a product
          </option>
          {products.map((product) => (
            <option key={product.code} value={product.code}>
              {product.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reason" required error={form.fieldErrors.reason}>
        <Textarea
          name="reason"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <OpMessage done={form.done} message={form.message} />
      <Button type="submit" disabled={form.pending || productCode === ''}>
        {form.pending ? 'Submitting…' : 'Change product'}
      </Button>
    </form>
  );
}
