'use client';

import type { Scenario, ScenarioRun } from '@icb/contracts';
import { Button, Card, CardBody, CardHeader, StatusBadge } from '@icb/ui';
import { Activity } from 'lucide-react';
import { useActionState } from 'react';

import { ActionMessage } from './action-feedback';
import { runScenarioAction, type ScenarioState } from './actions';
import { ScenarioCard } from './scenario-card';
import { INTENSITIES, TRAFFIC_SCENARIO } from './controls.constants';

const INITIAL: ScenarioState = { status: 'idle', message: null, run: null };

/**
 * Synthetic traffic — background customer activity with no storyline, driven by the high-load
 * scenario. One button per intensity; the result reports how many events were injected.
 */
function TrafficTrigger() {
  const [state, action, pending] = useActionState(runScenarioAction, INITIAL);

  return (
    <form
      action={action}
      className="rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] p-4"
    >
      <input type="hidden" name="name" value={TRAFFIC_SCENARIO} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Activity size={15} className="text-[var(--icb-text-muted)]" aria-hidden="true" />
            Synthetic traffic
          </h3>
          <p className="mt-0.5 text-xs text-[var(--icb-text-muted)]">
            Inject background customer activity — sign-ins, transfers, card swipes — at the chosen
            volume.
          </p>
        </div>
        <div className="flex gap-2">
          {INTENSITIES.map((intensity) => (
            <Button
              key={intensity.value}
              type="submit"
              name="intensity"
              value={intensity.value}
              variant="secondary"
              size="sm"
              loading={pending}
            >
              {intensity.label}
            </Button>
          ))}
        </div>
      </div>
      {state.message ? (
        <div className="mt-3">
          <ActionMessage state={state} />
        </div>
      ) : null}
      {state.run ? (
        <p role="status" className="tabular mt-3 text-xs text-[var(--icb-text-muted)]">
          {state.run.eventsGenerated.toLocaleString('en-US')} events injected · seed{' '}
          <span className="font-mono">{state.run.seed}</span>
        </p>
      ) : null}
    </form>
  );
}

function ActiveRunBanner({ run }: Readonly<{ run: ScenarioRun }>) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--icb-border)] px-4 py-3 text-sm"
    >
      <StatusBadge status={run.status} />
      <span className="font-medium capitalize">{run.name.replaceAll('_', ' ')}</span>
      <span className="tabular text-xs text-[var(--icb-text-subtle)]">
        {run.eventsGenerated.toLocaleString('en-US')} events so far
      </span>
    </div>
  );
}

/**
 * The scenario runner.
 *
 * A run is synchronous, so the result under each card is the finished run — no polling, no
 * half-built bank. The active-run banner covers the rare case of a run started elsewhere.
 */
export function ScenariosPanel({
  scenarios,
  activeRun,
}: Readonly<{ scenarios: Scenario[]; activeRun: ScenarioRun | null }>) {
  return (
    <Card>
      <CardHeader
        title="Scenarios"
        description="Named, repeatable event scripts. The same seed produces the same run."
      />
      <CardBody className="space-y-4">
        <TrafficTrigger />
        {activeRun && activeRun.status === 'running' ? <ActiveRunBanner run={activeRun} /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {scenarios.map((scenario) => (
            <ScenarioCard key={scenario.name} scenario={scenario} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
