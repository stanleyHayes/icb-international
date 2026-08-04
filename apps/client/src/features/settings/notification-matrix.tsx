'use client';

import type { NotificationPreference } from '@icb/contracts';
import { Button, Field, Input, Switch } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState, useTransition } from 'react';

import { saveNotificationPrefsAction, type QuietHoursInput } from './notification-actions';

const CHANNELS = [
  { key: 'inApp', label: 'In-app' },
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'Text' },
  { key: 'push', label: 'Push' },
] as const;

type ChannelKey = (typeof CHANNELS)[number]['key'];

function eventLabel(event: string): string {
  return event.charAt(0).toUpperCase() + event.slice(1).replaceAll('_', ' ');
}

/**
 * The notification matrix: every event type against every channel, plus quiet hours.
 *
 * The matrix edits locally and saves as one write, because the server stores it as one
 * document — a per-cell autosave would leave it half-switched if the connection dropped.
 */
export function NotificationMatrix({
  preferences,
  quietHours,
}: Readonly<{
  preferences: readonly NotificationPreference[];
  quietHours: QuietHoursInput | null;
}>) {
  const [rows, setRows] = useState<NotificationPreference[]>([...preferences]);
  const [quiet, setQuiet] = useState<QuietHoursInput>(
    quietHours ?? { enabled: false, from: '22:00', to: '07:00' },
  );
  const [feedback, setFeedback] = useState<{ error: string | null; done: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (event: string, channel: ChannelKey, value: boolean) => {
    setRows((current) =>
      current.map((row) => (row.event === event ? { ...row, [channel]: value } : row)),
    );
  };

  const save = () => {
    setFeedback(null);
    startTransition(async () => {
      setFeedback(
        await saveNotificationPrefsAction({
          preferences: rows,
          quietHours: quiet.enabled ? quiet : { ...quiet, enabled: false },
        }),
      );
    });
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Notification preferences by event and channel</caption>
          <thead>
            <tr className="border-b border-[var(--icb-border)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
              <th scope="col" className="py-2 pr-4 font-medium">Event</th>
              {CHANNELS.map((channel) => (
                <th key={channel.key} scope="col" className="px-2 py-2 text-center font-medium">
                  {channel.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {rows.map((row) => (
              <tr key={row.event}>
                <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                  {eventLabel(row.event)}
                </th>
                {CHANNELS.map((channel) => (
                  <td key={channel.key} className="px-2 py-2.5 text-center">
                    {/* Switch takes no aria-label; a wrapping label names it (buttons are labelable). */}
                    <label className="inline-flex">
                      <span className="sr-only">
                        {eventLabel(row.event)} by {channel.label}
                      </span>
                      <Switch
                        size="sm"
                        value={row[channel.key]}
                        onChange={(value) => toggle(row.event, channel.key, value)}
                      />
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <QuietHoursSection quiet={quiet} onChange={setQuiet} />

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={save} loading={pending}>
          Save preferences
        </Button>
        {feedback?.error ? (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-[var(--icb-danger-fg)]">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {feedback.error}
          </p>
        ) : null}
        {feedback?.done ? (
          <p role="status" className="flex items-start gap-1.5 text-sm text-[var(--icb-success-fg)]">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
            Preferences saved.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Quiet hours: an enable switch plus the window, disabled until switched on. */
function QuietHoursSection({
  quiet,
  onChange,
}: Readonly<{ quiet: QuietHoursInput; onChange: (next: QuietHoursInput) => void }>) {
  return (
    <fieldset className="mt-8 border-t border-[var(--icb-border)] pt-6">
      <legend className="text-sm font-medium">Quiet hours</legend>
      <p className="mt-1 text-xs text-[var(--icb-text-subtle)]">
        Non-urgent notifications hold until the window ends. Security alerts always come
        through.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="inline-flex items-center gap-2 text-sm">
          <Switch
            value={quiet.enabled}
            onChange={(value) => onChange({ ...quiet, enabled: value })}
          />
          Enable quiet hours
        </label>
        <Field label="From">
          <Input
            type="time"
            value={quiet.from}
            disabled={!quiet.enabled}
            onChange={(event) => onChange({ ...quiet, from: event.target.value })}
          />
        </Field>
        <Field label="To">
          <Input
            type="time"
            value={quiet.to}
            disabled={!quiet.enabled}
            onChange={(event) => onChange({ ...quiet, to: event.target.value })}
          />
        </Field>
      </div>
    </fieldset>
  );
}
