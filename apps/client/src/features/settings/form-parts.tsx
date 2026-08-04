'use client';

import { Button } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

import type { SettingsActionState } from './profile-actions';

/** Shared inline result line for the settings forms. */
export function SettingsFeedback({
  state,
  doneText,
}: Readonly<{ state: SettingsActionState; doneText: string }>) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-start gap-1.5 text-sm text-[var(--icb-danger-fg)]">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.done) {
    return (
      <p role="status" className="flex items-start gap-1.5 text-sm text-[var(--icb-success-fg)]">
        <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
        {doneText}
      </p>
    );
  }
  return null;
}

interface SubmitRowProps {
  pending: boolean;
  label: string;
  state: SettingsActionState;
  doneText: string;
}

/** Button + feedback on one row, the same across every settings form. */
export function SubmitRow({ pending, label, state, doneText }: Readonly<SubmitRowProps>) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button type="submit" loading={pending}>
        {label}
      </Button>
      <SettingsFeedback state={state} doneText={doneText} />
    </div>
  );
}
