'use client';

import type { RailProfile } from '@icb/contracts';
import { Button, Card, CardBody, CardHeader, Input, Switch } from '@icb/ui';
import { Save } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { ActionMessage, IDLE } from './action-feedback';
import { updateRailAction } from './actions';
import { RAIL_LABELS, rateToPercent } from './controls.constants';

function NumericField({
  id,
  name,
  label,
  defaultValue,
  step,
  min = 0,
}: Readonly<{ id: string; name: string; label: string; defaultValue: number; step: string; min?: number }>) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--icb-text-muted)]">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        name={name}
        defaultValue={defaultValue}
        min={min}
        step={step}
        required
        size="sm"
        className="mt-1"
      />
    </div>
  );
}

/** One rail's runtime profile: latency band, failure rate, settlement behaviour. */
function RailRow({ rail }: Readonly<{ rail: RailProfile }>) {
  const [state, action, pending] = useActionState(updateRailAction, IDLE);
  const [enabled, setEnabled] = useState(rail.enabled);
  const baseId = useId();
  const fieldId = (name: string) => `${baseId}-${name}`;

  return (
    <form
      action={action}
      className="rounded-[var(--radius-lg)] border border-[var(--icb-border)] p-4"
    >
      <input type="hidden" name="rail" value={rail.rail} />
      <input type="hidden" name="enabled" value={String(enabled)} />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Switch
            value={enabled}
            onChange={setEnabled}
            size="sm"
            id={fieldId('enabled')}
          />
          <label htmlFor={fieldId('enabled')} className="text-sm font-semibold">
            {RAIL_LABELS[rail.rail] ?? rail.rail}
          </label>
        </div>
        <Button type="submit" variant="secondary" size="sm" loading={pending} leadingIcon={<Save size={14} />}>
          Save
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <NumericField id={fieldId('min')} name="minLatencyMs" label="Min latency (ms)" defaultValue={rail.minLatencyMs} step="50" />
        <NumericField id={fieldId('max')} name="maxLatencyMs" label="Max latency (ms)" defaultValue={rail.maxLatencyMs} step="50" />
        <NumericField id={fieldId('failure')} name="failureRatePercent" label="Failure rate (%)" defaultValue={rateToPercent(rail.failureRate)} step="0.5" />
        <NumericField id={fieldId('settle')} name="settlementDelayHours" label="Settlement delay (h)" defaultValue={rail.settlementDelayHours} step="0.5" />
        <div>
          <label htmlFor={fieldId('cutoff')} className="block text-xs font-medium text-[var(--icb-text-muted)]">
            Cut-off time
          </label>
          <Input
            id={fieldId('cutoff')}
            type="time"
            name="cutOffTime"
            defaultValue={rail.cutOffTime ?? ''}
            size="sm"
            className="mt-1"
          />
        </div>
      </div>

      {rail.failureCodes.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Weighted failure codes">
          {rail.failureCodes.map((code) => (
            <li
              key={code.code}
              className="rounded-full bg-[var(--icb-bg-muted)] px-2.5 py-1 text-xs text-[var(--icb-text-muted)]"
            >
              {code.label} <span className="tabular text-[var(--icb-text-subtle)]">×{code.weight}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 empty:mt-0">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

/**
 * The rail profile editor.
 *
 * This is how a failure path is demonstrated on demand: raise a rail's failure rate, send a
 * payment, and the weighted return codes below are what come back. Failure codes are shown
 * read-only — their weights are tuned in the platform, not per demonstration.
 */
export function RailsEditor({ rails }: Readonly<{ rails: RailProfile[] }>) {
  return (
    <Card>
      <CardHeader
        title="Payment rails"
        description="Latency, failure rate and settlement behaviour per rail. Changes apply to the next transaction."
      />
      <CardBody className="space-y-3">
        {rails.map((rail) => (
          <RailRow key={rail.rail} rail={rail} />
        ))}
      </CardBody>
    </Card>
  );
}
