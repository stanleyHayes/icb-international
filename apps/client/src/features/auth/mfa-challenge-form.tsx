'use client';

import { Button, Checkbox, Field, Input, OTPInput } from '@icb/ui';
import { useActionState, useState } from 'react';

import { FormAlert } from './form-alert';
import { verifyMfaAction, type MfaState } from './mfa-actions';

const INITIAL: MfaState = { error: null };

interface MfaChallengeFormProps {
  challengeId: string;
  method: 'totp' | 'sms' | 'recovery_code';
  hint?: string;
}

const METHOD_COPY: Record<MfaChallengeFormProps['method'], { label: string; description: string }> =
  {
    totp: {
      label: 'Authenticator code',
      description: 'Enter the six-digit code from your authenticator app.',
    },
    sms: {
      label: 'Text message code',
      description: 'We sent a six-digit code to your phone.',
    },
    recovery_code: {
      label: 'Recovery code',
      description: 'Enter one of the recovery codes you saved when you set up two-factor authentication.',
    },
  };

/**
 * The second-factor step at sign-in.
 *
 * TOTP and SMS challenges use the digit-grid input; a TOTP challenge also accepts a recovery
 * code, because a lost phone must not mean a lost account. The input switches rather than the
 * page, so the challenge — and its countdown — stays alive.
 */
export function MfaChallengeForm({ challengeId, method, hint }: Readonly<MfaChallengeFormProps>) {
  const [state, action, pending] = useActionState(verifyMfaAction, INITIAL);
  const [useRecovery, setUseRecovery] = useState(method === 'recovery_code');
  const [code, setCode] = useState('');

  const copy = METHOD_COPY[useRecovery ? 'recovery_code' : method];
  const showRecoveryToggle = method === 'totp';

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert message={state.error} />

      <input type="hidden" name="challengeId" value={challengeId} />

      <Field
        label={copy.label}
        description={method === 'sms' && hint ? `${copy.description} (${hint})` : copy.description}
      >
        {useRecovery ? (
          <Input
            name="code"
            autoComplete="off"
            placeholder="e.g. 7f3k-9d2x-qp"
            required
            minLength={6}
            maxLength={16}
          />
        ) : (
          <OTPInput name="code" length={6} value={code} onChange={setCode} />
        )}
      </Field>

      <Checkbox name="trustDevice" label="Trust this device for 30 days" />

      <Button type="submit" size="lg" block loading={pending}>
        {pending ? 'Verifying…' : 'Verify and sign in'}
      </Button>

      {showRecoveryToggle ? (
        <button
          type="button"
          onClick={() => setUseRecovery((value) => !value)}
          className="block w-full text-center text-sm text-[var(--icb-primary)] hover:underline"
        >
          {useRecovery ? 'Use your authenticator instead' : 'Lost your phone? Use a recovery code'}
        </button>
      ) : null}
    </form>
  );
}
