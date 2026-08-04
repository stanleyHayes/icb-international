'use client';

import type { BeneficiaryVerification } from '@icb/contracts';
import { Button, Field, Input, formatDate } from '@icb/ui';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { confirmVerificationAction, sendVerificationDepositsAction } from './actions';

type BusyAction = 'send' | 'confirm' | null;

/**
 * Micro-deposit verification.
 *
 * ICB credits two small amounts to the payee's account; the customer asks the payee what
 * arrived and enters both amounts here. Wrong guesses are budgeted — exhaust the budget and the
 * payee locks until support intervenes. That failure mode is the point of the flow.
 */
export function VerificationPanel({
  beneficiaryId,
  initial,
}: Readonly<{ beneficiaryId: string; initial: BeneficiaryVerification }>) {
  const [state, setState] = useState(initial);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusyAction('send');
    setError(null);
    const result = await sendVerificationDepositsAction(beneficiaryId);
    setBusyAction(null);
    if (result.ok) {
      setState(result.verification);
    } else {
      setError(result.error);
    }
  }

  async function confirm() {
    setBusyAction('confirm');
    setError(null);
    const result = await confirmVerificationAction({
      beneficiaryId,
      firstAmountMinorUnits: Number(first),
      secondAmountMinorUnits: Number(second),
    });
    setBusyAction(null);
    if (result.ok) {
      setState(result.verification);
      setFirst('');
      setSecond('');
      if (result.verification.state !== 'verified') {
        setError('Those amounts do not match what was sent. Check with the payee and try again.');
      }
    } else {
      setError(result.error);
    }
  }

  if (state.state === 'verified') {
    return <VerifiedNotice verifiedAt={state.verifiedAt} />;
  }
  if (state.state === 'locked') {
    return <LockedNotice />;
  }

  const awaitingAmounts = state.state === 'deposits_sent' || state.state === 'failed';

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-sm text-[var(--icb-text-muted)]">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[var(--icb-primary)]" />
        We send two small deposits (under one unit each) to the payee’s account. Ask them what
        arrived, then enter both amounts below to verify the details.
      </p>

      {state.depositsSentAt ? (
        <p className="text-xs text-[var(--icb-text-subtle)]">
          Deposits sent {formatDate(state.depositsSentAt, 'medium')} · {state.attemptsRemaining}{' '}
          attempt{state.attemptsRemaining === 1 ? '' : 's'} remaining
        </p>
      ) : null}

      {awaitingAmounts ? (
        <DepositEntry
          first={first}
          second={second}
          busy={busyAction !== null}
          confirming={busyAction === 'confirm'}
          onFirst={setFirst}
          onSecond={setSecond}
          onConfirm={() => void confirm()}
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
          {error}
        </p>
      ) : null}

      <Button
        variant={state.state === 'not_started' ? 'primary' : 'secondary'}
        disabled={busyAction !== null}
        loading={busyAction === 'send'}
        onClick={() => void send()}
      >
        {state.depositsSentAt ? 'Resend deposits' : 'Send verification deposits'}
      </Button>
    </div>
  );
}

function VerifiedNotice({ verifiedAt }: Readonly<{ verifiedAt: string | null }>) {
  return (
    <p className="flex items-start gap-2 text-sm text-[var(--icb-success-fg)]">
      <BadgeCheck size={17} className="mt-0.5 shrink-0" />
      Verified{verifiedAt ? ` on ${formatDate(verifiedAt, 'medium')}` : ''}. This payee’s account
      details are confirmed.
    </p>
  );
}

function LockedNotice() {
  return (
    <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
      Verification is locked after too many incorrect attempts. Contact support to unlock this
      payee.
    </p>
  );
}

function DepositEntry({
  first,
  second,
  busy,
  confirming,
  onFirst,
  onSecond,
  onConfirm,
}: Readonly<{
  first: string;
  second: string;
  busy: boolean;
  confirming: boolean;
  onFirst: (value: string) => void;
  onSecond: (value: string) => void;
  onConfirm: () => void;
}>) {
  const amountsReady = /^\d{1,2}$/.test(first) && /^\d{1,2}$/.test(second);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First amount (minor units)" required>
          <Input
            value={first}
            onChange={(event) => onFirst(event.target.value.replace(/\D/g, '').slice(0, 2))}
            inputMode="numeric"
            placeholder="e.g. 23"
          />
        </Field>
        <Field label="Second amount (minor units)" required>
          <Input
            value={second}
            onChange={(event) => onSecond(event.target.value.replace(/\D/g, '').slice(0, 2))}
            inputMode="numeric"
            placeholder="e.g. 71"
          />
        </Field>
      </div>
      <Button disabled={!amountsReady || busy} loading={confirming} onClick={onConfirm}>
        Verify amounts
      </Button>
    </div>
  );
}
