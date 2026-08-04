import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface ActionState {
  status: 'idle' | 'ok' | 'error';
  message: string | null;
}

export const IDLE: ActionState = { status: 'idle', message: null };

export function ok(message: string): ActionState {
  return { status: 'ok', message };
}

export function failed(message: string): ActionState {
  return { status: 'error', message };
}

/**
 * The inline result of a control-room action. Error is `role="alert"` so it is announced;
 * success is a quiet confirmation next to the control that produced it.
 */
export function ActionMessage({ state }: Readonly<{ state: ActionState }>) {
  if (state.status === 'idle' || !state.message) return null;

  const isError = state.status === 'error';
  return (
    <p
      role={isError ? 'alert' : 'status'}
      className={
        isError
          ? 'flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-3.5 py-2.5 text-sm text-[var(--icb-danger-fg)]'
          : 'flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-3.5 py-2.5 text-sm text-[var(--icb-success-fg)]'
      }
    >
      {isError ? (
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
      )}
      {state.message}
    </p>
  );
}
