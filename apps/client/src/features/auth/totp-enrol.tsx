'use client';

import type { RecoveryCodes } from '@icb/contracts';
import { Button, Field, OTPInput } from '@icb/ui';
import { Check, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FormAlert } from './form-alert';
import { confirmTotpAction } from './mfa-actions';

interface TotpEnrolProps {
  secret: string;
  qrCodeDataUri: string;
}

type Step = 'scan' | 'confirm' | 'codes';

/**
 * Linking an authenticator, in three honest steps.
 *
 * The QR and the manual key are shown together — one is a convenience for the other. The app
 * proves itself with a live code before anything is enabled, and the recovery codes appear
 * exactly once, with friction ("I have saved these") before they are gone for good.
 */
export function TotpEnrol({ secret, qrCodeDataUri }: Readonly<TotpEnrolProps>) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('scan');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<RecoveryCodes | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await confirmTotpAction(code);
    setBusy(false);
    if (result.ok) {
      setCodes(result.codes);
      setStep('codes');
    } else {
      setError(result.error);
    }
  };

  if (step === 'codes' && codes) {
    return (
      <RecoveryCodePanel
        codes={codes.codes}
        acknowledged={acknowledged}
        onAcknowledge={() => setAcknowledged(true)}
        onDone={() => router.push('/account/security')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <FormAlert message={error} />

      <div className="flex flex-col items-start gap-6 sm:flex-row">
        {/* Data-URI QR code: nothing for an image optimiser to fetch or resize. */}
        <img
          src={qrCodeDataUri}
          alt="QR code to scan with your authenticator app"
          className="h-44 w-44 shrink-0 rounded-[var(--radius-md)] border border-[var(--icb-border)]"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium">1. Add ICB to your authenticator</p>
          <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
            Scan the code with your authenticator app. No camera? Enter this key manually:
          </p>
          <code className="tabular mt-2 block break-all rounded-[var(--radius-md)] bg-[var(--icb-bg-muted)] px-3 py-2 text-sm">
            {secret}
          </code>
        </div>
      </div>

      <Field label="2. Enter the code it shows you" description="Six digits, refreshed every 30 seconds.">
        <OTPInput name="totp-confirm" length={6} value={code} onChange={setCode} />
      </Field>

      <div className="flex gap-2">
        <Button onClick={() => void confirm()} loading={busy} disabled={code.length !== 6}>
          {busy ? 'Checking…' : 'Enable two-factor authentication'}
        </Button>
        <Button variant="ghost" onClick={() => router.push('/account/security')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RecoveryCodePanel({
  codes,
  acknowledged,
  onAcknowledge,
  onDone,
}: Readonly<{
  codes: string[];
  acknowledged: boolean;
  onAcknowledge: () => void;
  onDone: () => void;
}>) {
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium">Two-factor authentication is on.</p>
        <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
          These recovery codes get you back in if you lose your phone. Each works once. This is
          the only time we can show them — we store only their hashes.
        </p>
      </div>

      <ol className="tabular grid grid-cols-2 gap-2 rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-[var(--icb-bg-muted)] p-4 text-sm">
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void copyAll()} leadingIcon={copied ? <Check size={16} /> : <Copy size={16} />}>
          {copied ? 'Copied' : 'Copy all'}
        </Button>
        {acknowledged ? (
          <Button onClick={onDone}>Done</Button>
        ) : (
          <Button variant="primary" onClick={onAcknowledge}>
            I have saved these codes
          </Button>
        )}
      </div>
    </div>
  );
}
