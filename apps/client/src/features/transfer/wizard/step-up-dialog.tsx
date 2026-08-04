'use client';

import { Button, Dialog, Field, OTPInput } from '@icb/ui';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

import { requestStepUpAction, verifyStepUpAction } from '../wizard-actions';
import type { StepUpChallenge } from './action-types';

/**
 * MFA step-up for high-value transfers.
 *
 * The challenge is requested when the dialog opens, answered with the customer's second factor,
 * and only then is `onVerified` called to release the confirmation. The flow mirrors login MFA
 * but proves presence *now*, at the moment money moves.
 */
export function StepUpDialog({
  open,
  onClose,
  onVerified,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}>) {
  const [challenge, setChallenge] = useState<StepUpChallenge | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setChallenge(null);
      setCode('');
      setError(null);
      return;
    }
    let cancelled = false;
    void requestStepUpAction().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setChallenge(result.data);
      } else {
        setError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function submit(value: string) {
    if (!challenge || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await verifyStepUpAction({ challengeId: challenge.challengeId, code: value });
    setBusy(false);
    if (result.ok) {
      onVerified();
    } else {
      setCode('');
      setError(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Confirm it's you"
      description="This transfer is above your verified limit, so we need a fresh second factor before it can go ahead."
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--icb-navy-50)] text-[var(--icb-primary)]">
          <ShieldCheck size={22} />
        </span>
        {challenge ? (
          <p className="text-center text-sm text-[var(--icb-text-muted)]">
            {challenge.method === 'sms'
              ? `Enter the code we sent to ${challenge.hint ?? 'your phone'}.`
              : 'Enter the code from your authenticator app.'}
          </p>
        ) : (
          <p className="text-sm text-[var(--icb-text-muted)]">Preparing your challenge…</p>
        )}
        <Field label="Verification code">
          <OTPInput
            value={code}
            onChange={setCode}
            onComplete={(value) => void submit(value)}
            disabled={!challenge || busy}
            invalid={error !== null}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
            {error}
          </p>
        ) : null}
        <Button
          variant="secondary"
          block
          disabled={!challenge || code.length < 6 || busy}
          loading={busy}
          onClick={() => void submit(code)}
        >
          Verify and continue
        </Button>
      </div>
    </Dialog>
  );
}
