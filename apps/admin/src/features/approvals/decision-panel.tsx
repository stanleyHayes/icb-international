'use client';

import { Button, Field, RadioGroup, Textarea } from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { decide } from '@/features/approvals/actions';

interface PanelState {
  decision: 'approve' | 'reject';
  reason: string;
  done: boolean;
  message: string | null;
  fieldErrors: Record<string, string>;
}

const INITIAL: PanelState = {
  decision: 'approve',
  reason: '',
  done: false,
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

/**
 * The checker's half of maker-checker.
 *
 * The maker deciding their own request is blocked here for clarity and enforced again by the
 * API — the client message exists so the rule is explained, not just felt.
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
      const result = await decide({
        approvalId,
        decision: state.decision,
        reason: state.reason,
      });
      if (result.ok) {
        patch({ done: true, message: null });
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
  if (state.done) {
    return <Notice>Decision recorded. The audit trail now carries your reason.</Notice>;
  }

  const confirmLabel = state.decision === 'approve' ? 'Confirm approval' : 'Confirm rejection';

  return (
    <div className="space-y-4">
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

      {state.message ? (
        <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
          {state.message}
        </p>
      ) : null}

      <Button type="button" onClick={submitDecision} disabled={pending}>
        {pending ? 'Recording…' : confirmLabel}
      </Button>
    </div>
  );
}
