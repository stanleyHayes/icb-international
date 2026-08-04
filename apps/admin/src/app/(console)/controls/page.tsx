import type { EndOfDayReport, Scenario, SimulationState } from '@icb/contracts';
import { formatDate } from '@icb/ui';
import type { Metadata } from 'next';

import { ClockPanel } from '@/features/controls/clock-panel';
import { DangerPanel } from '@/features/controls/danger-panel';
import { EodPanel } from '@/features/controls/eod-panel';
import { RailsEditor } from '@/features/controls/rails-editor';
import { ScenariosPanel } from '@/features/controls/scenarios-panel';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Bank controls' };

/**
 * The operations control room.
 *
 * Super-admin only, enforced by the API: the business date, end-of-day on demand, rail
 * behaviour, resilience drills, scenarios and the reset hatch. Everything on this page mutates
 * shared bank state, so every control revalidates the page after it runs — what you see after an
 * action is the state the action produced, not the state you left.
 */
export default async function ControlsPage() {
  const [state, scenarios, eodHistory] = await Promise.all([
    api<SimulationState>('/simulation/state'),
    api<{ items: Scenario[] }>('/simulation/scenarios'),
    api<{ items: EndOfDayReport[] }>('/simulation/eod'),
  ]);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Bank controls</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            Business date, batch pipelines, rails, resilience drills and scenarios.
            {state.seededAt ? ` Seeded ${formatDate(state.seededAt, 'medium')}.` : ''}
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <ClockPanel clock={state.clock} />
        <EodPanel history={eodHistory.items} />
      </div>

      <div className="mt-6">
        <RailsEditor rails={state.rails} />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <ScenariosPanel scenarios={scenarios.items} activeRun={state.activeScenario} />
        <DangerPanel chaos={state.chaos} seededAt={state.seededAt} />
      </div>
    </>
  );
}
