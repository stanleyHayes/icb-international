import { AlertCircle } from 'lucide-react';

/**
 * The one form-level error banner used across every auth screen.
 *
 * `role="alert"` so a failed submit is announced without focus moving — the user's hands stay
 * on the field they were about to fix.
 */
export function FormAlert({ id, message }: Readonly<{ id?: string; message: string | null }>) {
  if (!message) {
    return null;
  }
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

/** One inline validation message, associated with its input for screen readers. */
export function FieldError({ id, message }: Readonly<{ id: string; message?: string }>) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
      {message}
    </p>
  );
}
