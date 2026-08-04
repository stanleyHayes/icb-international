'use client';

import type { TransactionDetail } from '@icb/contracts';
import { Button, Dialog, Field, Input, Textarea } from '@icb/ui';
import { Pencil } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';

import { annotateTransaction, type TransactionActionState } from './actions';

const INITIAL: TransactionActionState = { error: null };

/**
 * Notes and tags on a transaction.
 *
 * Tags are typed comma-separated — the affordance a statement's worth of transactions can
 * actually sustain — and saved through the annotate endpoint, which replaces the set wholesale.
 */
export function AnnotationEditor({
  transaction,
}: Readonly<{ transaction: TransactionDetail }>) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(annotateTransaction, INITIAL);
  const lastState = useRef(state);

  // Close only after a save has actually succeeded — not on open, when state is still initial.
  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.error === null) setOpen(false);
    }
  }, [state]);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<Pencil size={14} />}
        onClick={() => setOpen(true)}
      >
        {transaction.note || transaction.tags.length > 0 ? 'Edit notes & tags' : 'Add notes & tags'}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Notes & tags"
        description={transaction.description}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="transactionId" value={transaction.id} />
          <Field label="Note" id="annotation-note" description="Only you can see this.">
            <Textarea
              id="annotation-note"
              name="note"
              rows={3}
              maxLength={500}
              defaultValue={transaction.note ?? ''}
              placeholder="e.g. Reimbursed by Sam on the 12th"
            />
          </Field>
          <Field label="Tags" id="annotation-tags" description="Comma-separated, up to 10.">
            <Input
              id="annotation-tags"
              name="tags"
              maxLength={200}
              defaultValue={transaction.tags.join(', ')}
              placeholder="e.g. holiday, shared, reclaim"
            />
          </Field>
          {state.error ? (
            <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
              {state.error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
