'use client';

import type { MfaChallenge } from '@icb/contracts';
import { Button, Dialog } from '@icb/ui';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { useEffect, useId, useState, useTransition } from 'react';

import { requestStepUpAction, verifyStepUpAction } from './actions';

interface StepUpDialogProps {
  open: boolean;
  /** The operation this proof unlocks, e.g. `staff-manage`. Must match the API handler. */
  purpose: string;
  /** Human name of the operation, shown so the operator knows what they are authorising. */
  actionLabel: string;
  onClose: () => void;
  /** Called with the single-use token once the second factor verifies. */
  onVerified: (stepUpToken: string) => void;
}

/**
 * Forced re-authentication for sensitive operations.
 *
 * A login from an hour ago proves identity; this dialog proves presence *now*. It asks the API
 * for a purpose-bound challenge, collects the second-factor code, and hands the caller a
 * single-use token to attach to the sensitive mutation — the pattern every privileged console
 * action follows.
 */
export function StepUpDialog({
  open,
  purpose,
  actionLabel,
  onClose,
  onVerified,
}: Readonly<StepUpDialogProps>) {
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const codeId = useId();

  useEffect(() => {
    if (!open) {
      setChallenge(null);
      setError(null);
      return;
    }
    startTransition(async () => {
      const result = await requestStepUpAction(purpose);
      setChallenge(result.challenge);
      setError(result.error);
    });
  }, [open, purpose]);

  const submit = (formData: FormData) => {
    const codeRaw = formData.get('code');
    const code = typeof codeRaw === 'string' ? codeRaw : '';
    if (!challenge || code.length < 6) {
      setError('Enter the 6-digit code from your authenticator.');
      return;
    }
    startTransition(async () => {
      const result = await verifyStepUpAction(challenge.challengeId, code);
      if (result.stepUpToken) {
        onVerified(result.stepUpToken);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Confirm it's you"
      description={`${actionLabel} is a sensitive operation. Re-authenticate to continue — this confirmation covers this one action only.`}
    >
      <form action={submit} className="space-y-4">
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}

        {challenge ? (
          <div>
            <label htmlFor={codeId} className="block text-sm font-medium">
              Verification code
            </label>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--icb-text-subtle)]">
              <ShieldCheck size={13} aria-hidden="true" />
              {challengeHint(challenge)}
            </p>
            <input
              id={codeId}
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={16}
              className="tabular mt-2 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm tracking-[0.3em] outline-none focus:border-[var(--icb-primary)]"
            />
          </div>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={!challenge}>
            {pending ? 'Verifying…' : 'Confirm'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Where the second-factor code comes from, in one plain sentence. */
function challengeHint(challenge: MfaChallenge): string {
  if (challenge.method !== 'sms') {
    return 'From your authenticator app.';
  }
  return challenge.hint ? `Sent by text message to ${challenge.hint}.` : 'Sent by text message.';
}
