'use client';

import type { AccountDetail, AccountSummary } from '@icb/contracts';
import { Button, Dialog, Field, Select, Textarea } from '@icb/ui';
import { Snowflake, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';

import { closeAccount, requestFreeze, type AccountActionState } from './actions';

const INITIAL: AccountActionState = { error: null, done: false };

/** Closes the dialog once its action reports success; returns the state's error meanwhile. */
function useCloseOnDone(state: AccountActionState, close: () => void): void {
  const lastState = useRef(state);
  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.done) close();
    }
  }, [state, close]);
}

/**
 * The two irreversible-feeling actions on an account.
 *
 * Freeze is a request routed to the account team (freezing itself is staff-only); close goes
 * straight to the close endpoint, sweeping any residual balance into another account the
 * customer picks. Both ask for a reason because both are the kind of thing a fraudster does
 * silently and a customer does with a story.
 */
export function AccountActions({
  account,
  sweepCandidates,
}: Readonly<{ account: AccountDetail; sweepCandidates: AccountSummary[] }>) {
  const router = useRouter();
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [freezeState, freezeAction, freezePending] = useActionState(requestFreeze, INITIAL);
  const [closeState, closeAction, closePending] = useActionState(closeAccount, INITIAL);

  useCloseOnDone(freezeState, () => setFreezeOpen(false));
  useCloseOnDone(closeState, () => {
    setCloseOpen(false);
    router.push('/accounts');
  });

  if (account.status === 'closed') return null;

  const label = account.nickname ?? account.productName;
  const hasBalance = account.balances.ledger.minorUnits !== 0;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Snowflake size={15} />}
          onClick={() => setFreezeOpen(true)}
        >
          Freeze account
        </Button>
        <Button
          variant="danger"
          size="sm"
          leadingIcon={<Trash2 size={15} />}
          onClick={() => setCloseOpen(true)}
        >
          Close account
        </Button>
      </div>

      <Dialog
        open={freezeOpen}
        onClose={() => setFreezeOpen(false)}
        title="Freeze this account"
        description="While frozen, no money moves in or out. Our team confirms freezes within one working day, by secure message."
      >
        <form action={freezeAction} className="space-y-4">
          <input type="hidden" name="accountId" value={account.id} />
          <input type="hidden" name="accountLabel" value={label} />
          <Field label="Why are you freezing it?" id="freeze-reason">
            <Textarea
              id="freeze-reason"
              name="reason"
              rows={3}
              maxLength={500}
              placeholder="e.g. I think my details have been compromised"
            />
          </Field>
          {freezeState.error ? (
            <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">{freezeState.error}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFreezeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={freezePending}>
              Request freeze
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title={`Close ${label}`}
        description="Closing is permanent. Any remaining balance must move to another of your accounts first."
      >
        <form action={closeAction} className="space-y-4">
          <input type="hidden" name="accountId" value={account.id} />
          {hasBalance && sweepCandidates.length > 0 ? (
            <Field label="Move the remaining balance to" id="close-sweep">
              <Select id="close-sweep" name="sweepToAccountId" required>
                {sweepCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.nickname ?? candidate.productName}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Why are you closing it?" id="close-reason" required>
            <Textarea
              id="close-reason"
              name="reason"
              rows={3}
              minLength={4}
              maxLength={500}
              required
              placeholder="e.g. I no longer need a separate account"
            />
          </Field>
          {closeState.error ? (
            <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">{closeState.error}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCloseOpen(false)}>
              Keep account
            </Button>
            <Button type="submit" variant="danger" loading={closePending}>
              Close account
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
