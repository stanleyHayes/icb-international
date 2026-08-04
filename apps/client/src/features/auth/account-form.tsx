'use client';

import type { Product } from '@icb/contracts';
import { Button, Field, Input, RadioGroup, Select } from '@icb/ui';
import { useActionState, useState } from 'react';

import { FormAlert } from './form-alert';
import { openAccountAction } from './onboarding-actions';
import type { AuthFormState } from './password-actions';

const INITIAL: AuthFormState = { error: null, fieldErrors: {}, done: false };

/**
 * The last onboarding step: open the first account.
 *
 * Identity is already on its way to review; the account opens now with entry-tier limits and
 * the limits lift automatically when verification clears. The customer is never asked to wait
 * in a lobby.
 */
export function AccountForm({ products }: Readonly<{ products: Product[] }>) {
  const [state, action, pending] = useActionState(openAccountAction, INITIAL);
  const [productCode, setProductCode] = useState(products[0]?.code ?? '');

  const product = products.find((candidate) => candidate.code === productCode);

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormAlert message={state.error} />

      <Field label="Account type" error={state.fieldErrors['productCode']} required>
        <RadioGroup
          name="productCode"
          value={productCode}
          onChange={setProductCode}
          options={products.map((candidate) => ({
            value: candidate.code,
            label: candidate.name,
            description: candidate.tagline,
          }))}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Currency" error={state.fieldErrors['currency']} required>
          <Select name="currency">
            {(product?.currencies ?? []).map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Nickname"
          description="Optional — how this account appears to you."
          error={state.fieldErrors['nickname']}
        >
          <Input name="nickname" maxLength={60} placeholder="Everyday" />
        </Field>
      </div>

      <Button type="submit" size="lg" loading={pending} disabled={productCode === ''}>
        {pending ? 'Opening…' : 'Open account'}
      </Button>
    </form>
  );
}
