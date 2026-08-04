'use client';

import type { Product } from '@icb/contracts';
import { Button, Checkbox, Field, Input, Select } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState } from 'react';

import { saveEligibilityAction } from './catalogue-actions';
import { IDLE } from './types';

/**
 * Eligibility rules.
 *
 * These gate who may open the product at application time, so the form states every rule
 * explicitly — "no restriction" is a chosen value, not a blank the operator forgot to fill.
 */
export function EligibilityForm({ product }: Readonly<{ product: Product }>) {
  const [state, action, pending] = useActionState(saveEligibilityAction, IDLE);
  const eligibility = product.eligibility;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productCode" value={product.code} />

      {state.status === 'done' ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]"
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          Eligibility rules saved.
        </p>
      ) : null}
      {state.message ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-[var(--icb-danger-fg)]">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Minimum age"
          error={state.fieldErrors['minimumAge']}
          description="Empty means no age restriction."
        >
          <Input
            name="minimumAge"
            type="number"
            min={0}
            max={120}
            defaultValue={eligibility.minimumAge ?? ''}
          />
        </Field>
        <Field label="Minimum KYC tier" error={state.fieldErrors['minimumKycLevel']}>
          <Select name="minimumKycLevel" defaultValue={eligibility.minimumKycLevel ?? ''}>
            <option value="">No requirement</option>
            <option value="tier_1">Tier 1</option>
            <option value="tier_2">Tier 2</option>
            <option value="tier_3">Tier 3</option>
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox name="residentsOnly" label="Residents only" defaultChecked={eligibility.residentsOnly} />
        <Checkbox
          name="businessOnly"
          label="Business customers only"
          defaultChecked={eligibility.businessOnly}
        />
      </div>

      <Button type="submit" loading={pending}>
        {pending ? 'Saving…' : 'Save eligibility'}
      </Button>
    </form>
  );
}
