import { AlertCircle, CheckCircle2 } from 'lucide-react';

import type { FormState } from './types';

/**
 * Error banner or success line for a content form. Renders nothing while the form is idle,
 * so forms read as quiet until there is something to say.
 */
export function FormStatus({
  state,
  doneMessage,
}: Readonly<{ state: FormState; doneMessage: string }>) {
  if (state.message) {
    return (
      <p role="alert" className="flex items-start gap-2 text-sm text-[var(--icb-danger-fg)]">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        {state.message}
      </p>
    );
  }
  if (state.status === 'done') {
    return (
      <p className="flex items-start gap-2 text-sm text-[var(--icb-success-fg)]">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        {doneMessage}
      </p>
    );
  }
  return null;
}
