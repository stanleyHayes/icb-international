'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';

/** The red inline alert every mutation form shows when the API rejects it. */
export function FormError({ message }: Readonly<{ message: string | null }>) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

/** The green confirmation shown once an action has been recorded. */
export function FormDone({ message }: Readonly<{ message: string }>) {
  return (
    <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
      <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
      {message} Recorded against your staff account.
    </p>
  );
}
