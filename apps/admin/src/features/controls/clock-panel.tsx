'use client';

import type { ClockState } from '@icb/contracts';
import { Button, Card, CardBody, CardHeader, Checkbox, formatDate, formatTime, Input } from '@icb/ui';
import { CalendarClock, Pause, Play, RotateCcw } from 'lucide-react';
import { useActionState, useEffect, useId, useState } from 'react';

import { ActionMessage, IDLE } from './action-feedback';
import { advanceClockAction, freezeClockAction, jumpClockAction, resetClockAction } from './actions';
import { ADVANCE_PRESETS, describeOffset } from './controls.constants';

const TICK_MS = 1000;

/** What the bank believes "now" is, ticking live unless the clock is frozen. */
function SimClock({ clock }: Readonly<{ clock: ClockState }>) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    setElapsedSeconds(0);
  }, [clock.now]);

  useEffect(() => {
    if (clock.frozen) return;
    const timer = setInterval(() => setElapsedSeconds((value) => value + 1), TICK_MS);
    return () => clearInterval(timer);
  }, [clock.frozen]);

  const display = new Date(new Date(clock.now).getTime() + elapsedSeconds * TICK_MS);

  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--icb-navy-950)] px-5 py-4 text-white">
      <p className="text-xs font-medium tracking-[0.1em] text-[var(--icb-navy-300)] uppercase">
        Bank time
      </p>
      <p className="tabular mt-1 font-display text-3xl font-bold tracking-[-0.02em]">
        {formatTime(display)}
        <span className="ml-2 text-base font-medium text-[var(--icb-navy-200)]">
          {formatDate(display, 'long')}
        </span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--icb-navy-200)]">
        <span>{describeOffset(clock.offsetMs)}</span>
        <span aria-hidden="true">·</span>
        <span>{clock.isBusinessDay ? 'Business day' : 'Non-business day'}</span>
        <span aria-hidden="true">·</span>
        <span>Next business date {formatDate(clock.nextBusinessDate)}</span>
        {clock.frozen ? (
          <span className="rounded-full bg-white/10 px-2 py-0.5 font-medium">Frozen</span>
        ) : null}
      </div>
    </div>
  );
}

/** Advance by a preset duration, with end-of-day run for each business day crossed. */
function AdvanceControls() {
  const [state, action, pending] = useActionState(advanceClockAction, IDLE);

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm font-medium">Advance the clock</p>
      <div className="flex flex-wrap gap-2">
        {ADVANCE_PRESETS.map((preset) => (
          <Button
            key={preset.duration}
            type="submit"
            name="duration"
            value={preset.duration}
            variant="secondary"
            size="sm"
            loading={pending}
          >
            +{preset.label}
          </Button>
        ))}
      </div>
      <Checkbox
        name="runEndOfDay"
        defaultChecked
        label="Run end-of-day for each business day crossed"
      />
      <ActionMessage state={state} />
    </form>
  );
}

/** Jump straight to a moment — the days in between never happen. */
function JumpControls() {
  const [state, action, pending] = useActionState(jumpClockAction, IDLE);
  const inputId = useId();

  return (
    <form action={action} className="space-y-3">
      <label htmlFor={inputId} className="block text-sm font-medium">
        Jump to a date and time
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input id={inputId} type="datetime-local" name="to" required className="w-auto" />
        <Button type="submit" variant="secondary" loading={pending} leadingIcon={<CalendarClock size={16} />}>
          Jump
        </Button>
      </div>
      <p className="text-xs text-[var(--icb-text-subtle)]">
        A jump moves the clock without running end-of-day. Use advance to live through the days.
      </p>
      <ActionMessage state={state} />
    </form>
  );
}

/** Freeze / resume, and the escape hatch back to real time. */
function ClockSafetyControls({ frozen }: Readonly<{ frozen: boolean }>) {
  const [freezeState, freezeAction, freezePending] = useActionState(freezeClockAction, IDLE);
  const [resetState, resetFormAction, resetPending] = useActionState(
    async () => resetClockAction(),
    IDLE,
  );

  return (
    <div className="space-y-3 border-t border-[var(--icb-border)] pt-4">
      <div className="flex flex-wrap gap-2">
        <form action={freezeAction}>
          <input type="hidden" name="frozen" value={String(!frozen)} />
          <Button
            type="submit"
            variant="secondary"
            loading={freezePending}
            leadingIcon={frozen ? <Play size={16} /> : <Pause size={16} />}
          >
            {frozen ? 'Resume clock' : 'Freeze clock'}
          </Button>
        </form>
        <form action={resetFormAction}>
          <Button
            type="submit"
            variant="ghost"
            loading={resetPending}
            leadingIcon={<RotateCcw size={16} />}
          >
            Reset to real time
          </Button>
        </form>
      </div>
      <ActionMessage state={freezeState} />
      <ActionMessage state={resetState} />
    </div>
  );
}

/**
 * Time travel.
 *
 * The clock is the one control that changes what every other screen in the bank
 * shows, so it gets the top-left slot and the dark treatment: an operator should never be in
 * doubt about what "now" the bank is living in.
 */
export function ClockPanel({ clock }: Readonly<{ clock: ClockState }>) {
  return (
    <Card>
      <CardHeader
        title="Clock"
        description="What the bank believes now is. Every balance, accrued amount and cut-off reads this."
      />
      <CardBody className="space-y-5">
        <SimClock clock={clock} />
        <AdvanceControls />
        <JumpControls />
        <ClockSafetyControls frozen={clock.frozen} />
      </CardBody>
    </Card>
  );
}
