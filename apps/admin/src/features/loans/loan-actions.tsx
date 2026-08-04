'use client';

import { Button, Dialog } from '@icb/ui';
import { HandCoins, PencilLine, Trash2 } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { FormDone, FormError } from '@/features/cards/form-feedback';

import {
  disburseLoanAction,
  restructureLoanAction,
  writeOffLoanAction,
  type LoanActionState,
} from './actions';

const INITIAL: LoanActionState = { status: 'idle', message: null, fieldErrors: {} };

const INPUT_CLASS =
  'mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm outline-none focus:border-[var(--icb-primary)]';
const TEXTAREA_CLASS =
  'mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--icb-primary)]';

interface LoanActionsProps {
  readonly loanId: string;
  readonly canDisburse: boolean;
  readonly canRestructure: boolean;
  readonly canWriteOff: boolean;
}

/** The lifecycle operations on one loan, each confirmed and audited. */
export function LoanActions({ loanId, canDisburse, canRestructure, canWriteOff }: LoanActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {canDisburse ? <DisburseButton loanId={loanId} /> : null}
      {canRestructure ? <RestructureButton loanId={loanId} /> : null}
      {canWriteOff ? <WriteOffButton loanId={loanId} /> : null}
    </div>
  );
}

function useDialog() {
  const [open, setOpen] = useState(false);
  return { open, show: () => setOpen(true), hide: () => setOpen(false) };
}

function DisburseButton({ loanId }: Readonly<{ loanId: string }>) {
  const dialog = useDialog();
  const [state, action, pending] = useActionState(disburseLoanAction, INITIAL);

  return (
    <>
      <Button type="button" size="sm" leadingIcon={<HandCoins size={15} />} onClick={dialog.show}>
        Disburse
      </Button>
      <Dialog
        open={dialog.open}
        onClose={dialog.hide}
        title="Disburse this loan?"
        description="The principal is credited to the nominated account as a real ledger posting. This cannot be undone — only repaid."
      >
        {state.status === 'done' ? (
          <FormDone message={state.message ?? 'Loan disbursed.'} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="loanId" value={loanId} />
            <FormError message={state.message} />
            <Button type="submit" block loading={pending}>
              {pending ? 'Disbursing…' : 'Confirm disbursement'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

function RestructureButton({ loanId }: Readonly<{ loanId: string }>) {
  const dialog = useDialog();
  const [state, action, pending] = useActionState(restructureLoanAction, INITIAL);
  const termId = useId();
  const rateId = useId();

  return (
    <>
      <Button type="button" variant="secondary" size="sm" leadingIcon={<PencilLine size={15} />} onClick={dialog.show}>
        Restructure
      </Button>
      <Dialog
        open={dialog.open}
        onClose={dialog.hide}
        title="Restructure this loan?"
        description="A new amortisation schedule replaces the current one. Blank fields keep their existing values."
      >
        {state.status === 'done' ? (
          <FormDone message={state.message ?? 'Loan restructured.'} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="loanId" value={loanId} />
            <FormError message={state.message} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id={termId}
                name="termMonths"
                label="New term (months)"
                error={state.fieldErrors['termMonths']}
              />
              <NumberField id={rateId} name="rate" label="New rate %" step="0.01" error={state.fieldErrors['rate']} />
            </div>
            <ReasonField error={state.fieldErrors['reason']} />
            <Button type="submit" block loading={pending}>
              {pending ? 'Restructuring…' : 'Confirm restructure'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

function WriteOffButton({ loanId }: Readonly<{ loanId: string }>) {
  const dialog = useDialog();
  const [state, action, pending] = useActionState(writeOffLoanAction, INITIAL);

  return (
    <>
      <Button type="button" variant="danger" size="sm" leadingIcon={<Trash2 size={15} />} onClick={dialog.show}>
        Write off
      </Button>
      <Dialog
        open={dialog.open}
        onClose={dialog.hide}
        title="Write off this loan?"
        description="The outstanding balance moves to loss provisioning and collections activity stops. This is a terminal, audited action."
      >
        {state.status === 'done' ? (
          <FormDone message={state.message ?? 'Loan written off.'} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="loanId" value={loanId} />
            <FormError message={state.message} />
            <ReasonField error={state.fieldErrors['reason']} />
            <Button type="submit" variant="danger" block loading={pending}>
              {pending ? 'Writing off…' : 'Confirm write-off'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

function NumberField({
  id,
  name,
  label,
  step = '1',
  error,
}: Readonly<{ id: string; name: string; label: string; step?: string; error?: string | undefined }>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        min="0"
        step={step}
        aria-invalid={error ? true : undefined}
        className={INPUT_CLASS}
      />
      {error ? <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">{error}</p> : null}
    </div>
  );
}

function ReasonField({ error }: Readonly<{ error?: string | undefined }>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        Reason
      </label>
      <textarea
        id={id}
        name="reason"
        rows={3}
        required
        placeholder="Why is this action being taken?"
        aria-invalid={error ? true : undefined}
        className={TEXTAREA_CLASS}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">{error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
          Written to the audit trail against your account.
        </p>
      )}
    </div>
  );
}
