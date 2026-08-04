'use client';

import { Field, Input, RadioGroup, Select } from '@icb/ui';

import { FREQUENCY_OPTIONS } from '../transfer.constants';
import type { ScheduleDraft } from './draft-types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * When the transfer runs: immediately, once on a future date, or on an RRULE-backed recurrence.
 * The schedule is only attached at confirmation — the quote prices the first execution.
 */
export function ScheduleFields({
  draft,
  onChange,
}: Readonly<{ draft: ScheduleDraft; onChange: (patch: Partial<ScheduleDraft>) => void }>) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium">When</legend>
      <RadioGroup
        name="schedule-mode"
        value={draft.mode}
        onChange={(mode) =>
          onChange({
            mode: mode as ScheduleDraft['mode'],
            ...(mode !== 'now' && !draft.startsOn ? { startsOn: todayIso() } : {}),
          })
        }
        options={[
          { value: 'now', label: 'Now', description: 'Executed as soon as you confirm.' },
          { value: 'later', label: 'On a date', description: 'A single future-dated transfer.' },
          { value: 'recurring', label: 'Repeating', description: 'A standing schedule you can cancel any time.' },
        ]}
      />

      {draft.mode !== 'now' ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={draft.mode === 'later' ? 'Date' : 'First run'} required>
            <Input
              type="date"
              value={draft.startsOn}
              min={todayIso()}
              onChange={(event) => onChange({ startsOn: event.target.value })}
            />
          </Field>
          {draft.mode === 'recurring' ? (
            <Field label="Repeats" required>
              <Select
                value={draft.frequency}
                onChange={(event) =>
                  onChange({ frequency: event.target.value as ScheduleDraft['frequency'] })
                }
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {draft.mode === 'recurring' ? (
            <Field label="Until" description="Leave empty to run until you cancel.">
              <Input
                type="date"
                value={draft.endsOn}
                min={draft.startsOn || todayIso()}
                onChange={(event) => onChange({ endsOn: event.target.value })}
              />
            </Field>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
