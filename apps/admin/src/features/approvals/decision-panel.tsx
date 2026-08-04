'use client';

import { Button, Field, Input, RadioGroup, Textarea } from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  beginDecision,
  completeDecision,
  type ChallengeView,
} from '@/features/approvals/actions';

type Step = 'form' | 'challenge' | 'done';

interface PanelState {
  step: Step;
  decision: 'approve' | 'reject';
  reason: string;
  code: string;
  challenge: ChallengeView | null;
  message: string | null;
  fieldErrors: Record<string, string>;
}

const INITIAL: PanelState = {
  step: 'form',
  decision: 'approve',
  reason: '',
  code: '',
  challenge: null,
  message: null,
  fieldErrors: {},
};

function Notice({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] px-4 py-3 text-sm text-[var(--icb-text-muted)]">
      {children}
    </p>
  );
}

/** The decision itself: approve or reject, with the reason the audit trail keeps. */
function DecisionFields({
  state,
  patch,
}: Readonly<{ state: PanelState; patch: (part: Partial<PanelState>) => void }>) {
  return (
    <>
      <Field label="Decision" required>
        <RadioGroup
          name="decision"
          value={state.decision}
          onChange={(value) => patch({ decision: value === 'reject' ? 'reject' : 'approve' })}
          options={[
            { value: 'approve', label: 'Approve' },
            { value: 'reject', label: 'Reject' },
          ]}
        />
      </Field>
      <Field
        label="Reason"
        required
        error={state.fieldErrors.reason}
        description="Recorded in the audit trail with your decision."
      >
        <Textarea
          name="reason"
          value={state.reason}
          onChange={(event) => patch({ reason: event.target.value })}
          rows={3}
        />
      </Field>
    </>
  );
}

/** The fresh second-factor proof the API's StepUpGuard demands for sensitive operations. */
function ChallengeFields({
  state,
  patch,
}: Readonly<{ state: PanelState; patch: (part: Partial<PanelState>) => void }>) {
  const hint = state.challenge?.hint;
  const method = state.challenge?.method ?? 'your second factor';
  return (
    <Field
      label="Verification code"
      required
      error={state.fieldErrors.code}
      description={hint ? `Sent by ${method} to ${hint}.` : `Sent by ${method}.`}
    >
      <Input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={state.code}
        onChange={(event) => patch({ code: event.target.value })}
      />
    </Field>
  );
}

/**
 * The checker's half of maker-checker.
 *
 * Deciding is a sensitive op, so it runs in two steps: the decision itself, then a fresh
 * second-factor proof. The maker deciding their own request is blocked here for clarity and
 * enforced again by the API — the client message exists so the rule is explained, not just felt.
 */
export function DecisionPanel({
  approvalId,
  isSelf,
}: Readonly<{ approvalId: string; isSelf: boolean }>) {
  const router = useRouter();
  const [state, setState] = useState<PanelState>(INITIAL);
  const [pending, startTransition] = useTransition();

  const patch = (part: Partial<PanelState>) => setState((prev) => ({ ...prev, ...part }));

  const submitDecision = () => {
    startTransition(async () => {
      const result = await beginDecision({
        approvalId,
        decision: state.decision,
        reason: state.reason,
      });
      if (result.ok && result.challenge) {
        patch({ step: 'challenge', challenge: result.challenge, message: null, fieldErrors: {} });
      } else {
        patch({ message: result.message, fieldErrors: result.fieldErrors });
      }
    });
  };

  const submitCode = () => {
    const challenge = state.challenge;
    if (!challenge) return;
    startTransition(async () => {
      const result = await completeDecision({
        approvalId,
        decision: state.decision,
        reason: state.reason,
        challengeId: challenge.id,
        code: state.code,
      });
      if (result.ok) {
        patch({ step: 'done', message: null });
        router.refresh();
      } else {
        patch({ message: result.message, fieldErrors: result.fieldErrors });
      }
    });
  };

  if (isSelf) {
    return (
      <Notice>
        You raised this request, so another operator must decide it. Four-eyes requests can never
        be approved by their maker.
      </Notice>
    );
  }
  if (state.step === 'done') {
    return (
      <Notice>Decision recorded. The audit trail now carries your reason and verification.</Notice>
    );
  }

  const confirmLabel =
    state.decision === 'approve' ? 'Confirm approval' : 'Confirm rejection';

  return (
    <div className="space-y-4">
      {state.step === 'form' ? (
        <DecisionFields state={state} patch={patch} />
      ) : (
        <ChallengeFields state={state} patch={patch} />
      )}

      {state.message ? (
        <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
          {state.message}
        </p>
      ) : null}

      <div className="flex gap-2">
        {state.step === 'form' ? (
          <Button type="button" onClick={submitDecision} disabled={pending}>
            {pending ? 'Starting verification…' : 'Continue to verification'}
          </Button>
        ) : (
          <>
            <Button type="button" onClick={submitCode} disabled={pending || state.code.length < 6}>
              {pending ? 'Recording…' : confirmLabel}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => patch({ step: 'form', code: '', message: null })}
              disabled={pending}
            >
              Back
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
