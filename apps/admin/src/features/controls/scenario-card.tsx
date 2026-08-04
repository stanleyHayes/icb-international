'use client';

import type { Scenario } from '@icb/contracts';
import { Button, Input, Select, StatusBadge } from '@icb/ui';
import { Play } from 'lucide-react';
import { useActionState, useId } from 'react';

import { ActionMessage } from './action-feedback';
import { runScenarioAction, type ScenarioState } from './actions';
import { INTENSITIES, SCENARIO_LABELS } from './controls.constants';

const INITIAL: ScenarioState = { status: 'idle', message: null, run: null };

function RunResult({ state }: Readonly<{ state: ScenarioState }>) {
  if (state.message) return <ActionMessage state={state} />;
  if (!state.run) return null;

  const run = state.run;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] px-3.5 py-2.5 text-xs"
    >
      <StatusBadge status={run.status} />
      <span className="tabular font-medium">
        {run.eventsGenerated.toLocaleString('en-US')} events
      </span>
      <span className="text-[var(--icb-text-subtle)]">
        seed <span className="font-mono">{run.seed}</span> · {run.intensity}
      </span>
      {run.error ? <span className="text-[var(--icb-danger-fg)]">{run.error}</span> : null}
    </div>
  );
}

/**
 * One named scenario.
 *
 * The seed is optional and deliberate: the same seed replays the same scenario exactly, which
 * is how a failure becomes reproducible rather than anecdotal.
 */
export function ScenarioCard({ scenario }: Readonly<{ scenario: Scenario }>) {
  const [state, action, pending] = useActionState(runScenarioAction, INITIAL);
  const baseId = useId();

  return (
    <form
      action={action}
      className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--icb-border)] p-4"
    >
      <input type="hidden" name="name" value={scenario.name} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {SCENARIO_LABELS[scenario.name] ?? scenario.label}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--icb-text-muted)]">{scenario.description}</p>
        </div>
        <span className="tabular shrink-0 rounded-full bg-[var(--icb-bg-muted)] px-2 py-0.5 text-xs text-[var(--icb-text-muted)]">
          ~{scenario.estimatedEvents.toLocaleString('en-US')} events
        </span>
      </div>

      {scenario.affects.length > 0 ? (
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Areas affected">
          {scenario.affects.map((area) => (
            <li
              key={area}
              className="rounded-full bg-[var(--icb-bg-muted)] px-2 py-0.5 text-[0.7rem] text-[var(--icb-text-subtle)] capitalize"
            >
              {area.replaceAll('_', ' ')}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${baseId}-intensity`} className="block text-xs font-medium text-[var(--icb-text-muted)]">
            Intensity
          </label>
          <Select id={`${baseId}-intensity`} name="intensity" defaultValue="normal" size="sm" className="mt-1">
            {INTENSITIES.map((intensity) => (
              <option key={intensity.value} value={intensity.value}>
                {intensity.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={`${baseId}-seed`} className="block text-xs font-medium text-[var(--icb-text-muted)]">
            Seed (optional)
          </label>
          <Input
            id={`${baseId}-seed`}
            name="seed"
            placeholder="repeatable run"
            maxLength={64}
            size="sm"
            className="mt-1"
          />
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        <Button type="submit" variant="secondary" size="sm" loading={pending} leadingIcon={<Play size={14} />}>
          {pending ? 'Running…' : 'Run scenario'}
        </Button>
        <RunResult state={state} />
      </div>
    </form>
  );
}
