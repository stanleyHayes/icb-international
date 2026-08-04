'use client';

import type { FeatureFlag } from '@icb/contracts';
import { Button, formatDate, formatTime } from '@icb/ui';
import { AlertCircle } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { INITIAL_FLAG_STATE, updateFlagAction } from './actions';

const AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'staff', label: 'Staff only' },
  { value: 'beta', label: 'Beta cohort' },
  { value: 'tier_premier_plus', label: 'Premier Plus tier' },
] as const;

/**
 * One feature flag row: what it does, who gets it, and the controls to change that.
 *
 * The switch flips enabled immediately; rollout and audience are staged behind Save so a
 * half-edited rollout never ships by accident.
 */
export function FlagRow({ flag }: Readonly<{ flag: FeatureFlag }>) {
  const [state, action, pending] = useActionState(updateFlagAction, INITIAL_FLAG_STATE);
  const [enabled, setEnabled] = useState(flag.enabled);
  const rolloutId = useId();
  const audienceId = useId();

  const flip = (formData: FormData) => {
    setEnabled(formData.get('enabled') === 'true');
    action(formData);
  };

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-prose">
          <p className="text-sm font-medium">{flag.label}</p>
          <p className="mt-0.5 font-mono text-xs text-[var(--icb-text-subtle)]">{flag.key}</p>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">{flag.description}</p>
          <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
            Updated {formatDate(flag.updatedAt, 'short')} {formatTime(flag.updatedAt)}
          </p>
        </div>

        <form action={flip} className="shrink-0">
          <input type="hidden" name="key" value={flag.key} />
          <input type="hidden" name="enabled" value={String(!enabled)} />
          <Button type="submit" variant={enabled ? 'secondary' : 'primary'} size="sm" loading={pending}>
            {enabled ? 'Disable' : 'Enable'}
          </Button>
        </form>
      </div>

      <form action={action} className="mt-4 flex flex-wrap items-end gap-4 border-t border-[var(--icb-border)] pt-4">
        <input type="hidden" name="key" value={flag.key} />
        <div>
          <label htmlFor={rolloutId} className="block text-xs font-medium">
            Rollout %
          </label>
          <input
            id={rolloutId}
            name="rolloutPercentage"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={flag.rolloutPercentage}
            className="tabular mt-1 h-9 w-24 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm outline-none focus:border-[var(--icb-primary)]"
          />
        </div>
        <div>
          <label htmlFor={audienceId} className="block text-xs font-medium">
            Audience
          </label>
          <select
            id={audienceId}
            name="audience"
            defaultValue={flag.audience}
            className="mt-1 h-9 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm outline-none focus:border-[var(--icb-primary)]"
          >
            {AUDIENCES.map((audience) => (
              <option key={audience.value} value={audience.value}>
                {audience.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary" size="sm" loading={pending}>
          Save rollout
        </Button>
      </form>

      {state.message ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}
    </li>
  );
}
