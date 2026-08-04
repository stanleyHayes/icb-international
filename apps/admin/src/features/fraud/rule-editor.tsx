'use client';

import type { RiskRule } from '@icb/contracts';
import { Button } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState, useId } from 'react';

import { updateRuleAction, type FraudActionState } from './actions';

const INITIAL: FraudActionState = { status: 'idle', message: null, fieldErrors: {} };

const inputClass =
  'h-9 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm outline-none focus:border-[var(--icb-primary)]';

/**
 * One rule, editable in place.
 *
 * Parameter inputs keep the type the rule declared — a threshold stays a number, a flag stays a
 * true/false select — so a tuned rule cannot be silently re-typed by a form.
 */
export function RuleEditor({ rule }: Readonly<{ rule: RiskRule }>) {
  const [state, action, pending] = useActionState(updateRuleAction, INITIAL);
  const baseId = useId();
  const parameters = Object.entries(rule.parameters);

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <input type="hidden" name="ruleId" value={rule.id} />
      <input type="hidden" name="currentParameters" value={JSON.stringify(rule.parameters)} />

      {state.message ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}
      {state.status === 'done' ? (
        <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          Rule updated and audited.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={rule.enabled}
            className="h-4 w-4 accent-[var(--icb-primary)]"
          />
          Rule enabled
        </label>
        <div>
          <label htmlFor={`${baseId}-weight`} className="block text-sm font-medium">
            Weight
          </label>
          <input
            id={`${baseId}-weight`}
            name="weight"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={rule.weight}
            className={`mt-1 tabular ${inputClass}`}
          />
        </div>
      </div>

      {parameters.length > 0 ? (
        <fieldset>
          <legend className="text-sm font-medium">Parameters</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {parameters.map(([key, value]) => (
              <div key={key}>
                <label htmlFor={`${baseId}-${key}`} className="block text-xs text-[var(--icb-text-subtle)]">
                  {key.replaceAll('_', ' ')}
                </label>
                {typeof value === 'boolean' ? (
                  <select
                    id={`${baseId}-${key}`}
                    name={`param.${key}`}
                    defaultValue={String(value)}
                    className={`mt-1 ${inputClass}`}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    id={`${baseId}-${key}`}
                    name={`param.${key}`}
                    type={typeof value === 'number' ? 'number' : 'text'}
                    defaultValue={String(value)}
                    className={`mt-1 ${typeof value === 'number' ? 'tabular' : ''} ${inputClass}`}
                  />
                )}
              </div>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div>
        <label htmlFor={`${baseId}-reason`} className="block text-sm font-medium">
          Reason for change
        </label>
        <textarea
          id={`${baseId}-reason`}
          name="reason"
          rows={2}
          required
          minLength={4}
          placeholder="Why is this rule changing?"
          aria-invalid={state.fieldErrors['reason'] ? true : undefined}
          className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--icb-primary)]"
        />
        {state.fieldErrors['reason'] ? (
          <p className="mt-1 text-xs text-[var(--icb-danger-fg)]">{state.fieldErrors['reason']}</p>
        ) : null}
      </div>

      <Button type="submit" loading={pending}>
        {pending ? 'Saving…' : 'Save rule'}
      </Button>
    </form>
  );
}
