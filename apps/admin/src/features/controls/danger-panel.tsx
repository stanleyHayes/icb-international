'use client';

import type { SimulationState } from '@icb/contracts';
import { Button, Card, CardBody, CardHeader, Dialog, Input, Switch, formatDate } from '@icb/ui';
import { DatabaseBackup, Zap } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { ActionMessage, IDLE } from './action-feedback';
import { resetDatabaseAction, updateChaosAction } from './actions';
import { rateToPercent, RESET_CONFIRMATION } from './controls.constants';

type Chaos = SimulationState['chaos'];

/**
 * Resilience drills: database latency and random failure injection across the bank.
 *
 * The settings persist server-side; this form edits them. If the platform build has no chaos
 * endpoint yet the action reports that plainly instead of pretending the save happened.
 */
function ChaosControls({ chaos }: Readonly<{ chaos: Chaos }>) {
  const [state, action, pending] = useActionState(updateChaosAction, IDLE);
  const [enabled, setEnabled] = useState(chaos.enabled);
  const baseId = useId();

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="enabled" value={String(enabled)} />

      <div className="flex items-center gap-3">
        <Switch value={enabled} onChange={setEnabled} size="sm" id={`${baseId}-enabled`} />
        <label htmlFor={`${baseId}-enabled`} className="text-sm font-medium">
          Drills enabled
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${baseId}-latency`} className="block text-xs font-medium text-[var(--icb-text-muted)]">
            Database latency (ms)
          </label>
          <Input
            id={`${baseId}-latency`}
            type="number"
            name="databaseLatencyMs"
            defaultValue={chaos.databaseLatencyMs}
            min={0}
            step="50"
            required
            size="sm"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-failure`} className="block text-xs font-medium text-[var(--icb-text-muted)]">
            Random failures (%)
          </label>
          <Input
            id={`${baseId}-failure`}
            type="number"
            name="randomFailureRatePercent"
            defaultValue={rateToPercent(chaos.randomFailureRate)}
            min={0}
            max={100}
            step="0.5"
            required
            size="sm"
            className="mt-1"
          />
        </div>
      </div>

      <Button type="submit" variant="secondary" size="sm" loading={pending} leadingIcon={<Zap size={14} />}>
        Apply drill settings
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}

/**
 * Reset to seed.
 *
 * The typed confirmation is the whole point: the phrase must be keyed deliberately, so a reset
 * can never be the result of a stray click or an autofilled form.
 */
function ResetToSeed({ seededAt }: Readonly<{ seededAt: string | null }>) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [state, action, pending] = useActionState(resetDatabaseAction, IDLE);
  const inputId = useId();
  const armed = confirmation === RESET_CONFIRMATION;

  return (
    <>
      <div className="rounded-[var(--radius-lg)] border border-[var(--icb-danger-border)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--icb-danger-fg)]">Reset to seed</h3>
            <p className="mt-0.5 text-xs text-[var(--icb-text-muted)]">
              Drop every collection and reseed the bank.
              {seededAt ? ` Last seeded ${formatDate(seededAt, 'medium')}.` : ' Never seeded.'}
            </p>
          </div>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setOpen(true)}
            leadingIcon={<DatabaseBackup size={14} />}
          >
            Reset database…
          </Button>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reset the database to its seed state?"
        description="Every customer, account, posting and case created since the seed is destroyed. This cannot be undone."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={`${inputId}-form`} variant="danger" loading={pending} disabled={!armed}>
              Reset database
            </Button>
          </>
        }
      >
        <form id={`${inputId}-form`} action={action} className="space-y-3">
          <label htmlFor={inputId} className="block text-sm font-medium">
            Type <span className="font-mono font-semibold">{RESET_CONFIRMATION}</span> to confirm
          </label>
          <Input
            id={inputId}
            name="confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            autoFocus
          />
          <ActionMessage state={state} />
        </form>
      </Dialog>
    </>
  );
}

export function DangerPanel({ chaos, seededAt }: Readonly<{ chaos: Chaos; seededAt: string | null }>) {
  return (
    <Card>
      <CardHeader
        title="Resilience & reset"
        description="Failure injection, and the escape hatch back to a clean bank."
      />
      <CardBody className="space-y-5">
        <ChaosControls chaos={chaos} />
        <ResetToSeed seededAt={seededAt} />
      </CardBody>
    </Card>
  );
}
