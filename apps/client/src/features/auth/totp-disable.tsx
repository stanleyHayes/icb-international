'use client';

import { Button, Field, OTPInput } from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FormAlert } from './form-alert';
import { disableTotpAction } from './mfa-actions';

/**
 * Switching two-factor off.
 *
 * It costs a live code from the authenticator being removed — the same proof the API demands —
 * so a hijacked session alone cannot strip the account's second factor.
 */
export function TotpDisable() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const disable = async () => {
    setBusy(true);
    setError(null);
    const result = await disableTotpAction(code);
    setBusy(false);
    if (result.ok) {
      router.push('/account/security');
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Turn off two-factor authentication
      </Button>
    );
  }

  return (
    <div className="space-y-5">
      <FormAlert message={error} />
      <p className="text-sm text-[var(--icb-text-muted)]">
        Enter a code from your authenticator to confirm. Your account will then rely on your
        password alone — we recommend turning this back on.
      </p>
      <Field label="Authenticator code">
        <OTPInput name="totp-disable" length={6} value={code} onChange={setCode} />
      </Field>
      <div className="flex gap-2">
        <Button variant="danger" onClick={() => void disable()} loading={busy} disabled={code.length !== 6}>
          {busy ? 'Turning off…' : 'Confirm: turn off'}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Keep it on
        </Button>
      </div>
    </div>
  );
}
