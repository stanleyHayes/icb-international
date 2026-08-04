'use client';

import type { Product } from '@icb/contracts';
import { Button, Field, Input, Textarea } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState } from 'react';

import { updateCoreAction } from './product-actions';
import { IDLE } from './types';

/** The customer-facing copy of the product — what the public site and the app say about it. */
export function CoreDetailsForm({ product }: Readonly<{ product: Product }>) {
  const [state, action, pending] = useActionState(updateCoreAction, IDLE);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productCode" value={product.code} />

      {state.status === 'done' ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]"
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          Saved.
        </p>
      ) : null}
      {state.message ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-[var(--icb-danger-fg)]">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <Field label="Name" error={state.fieldErrors['name']} required>
        <Input name="name" defaultValue={product.name} required />
      </Field>
      <Field label="Tagline" error={state.fieldErrors['tagline']} required>
        <Input name="tagline" defaultValue={product.tagline} required />
      </Field>
      <Field label="Description" error={state.fieldErrors['description']} required>
        <Textarea name="description" rows={4} defaultValue={product.description} required />
      </Field>
      <Field
        label="Features"
        error={state.fieldErrors['features']}
        description="One per line, as they appear on the public site."
      >
        <Textarea name="features" rows={4} defaultValue={product.features.join('\n')} />
      </Field>
      <Field label="Display order" error={state.fieldErrors['displayOrder']}>
        <Input name="displayOrder" type="number" min={0} defaultValue={product.displayOrder} />
      </Field>

      <Button type="submit" loading={pending}>
        {pending ? 'Saving…' : 'Save details'}
      </Button>
    </form>
  );
}
