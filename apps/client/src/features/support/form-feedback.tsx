'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';

import type { SupportActionState } from './actions';

/** Shared inline result line for the support forms. */
export function SupportFeedback({
  state,
  doneText,
}: Readonly<{ state: SupportActionState; doneText: string }>) {
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
