'use client';

import { Button, Dialog } from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cancelTransferAction } from './actions';

/**
 * Cancel control for a transfer the API still allows to be cancelled. Confirmation is explicit
 * — a cancel is itself a money-affecting instruction.
 */
export function CancelTransferButton({ transferId }: Readonly<{ transferId: string }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = await cancelTransferAction(transferId);
    setBusy(false);
    if (result.status === 'done') {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'This transfer could not be cancelled.');
    }
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Cancel transfer
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel this transfer?"
        description="The instruction is withdrawn before execution. Any held funds are released back to your available balance."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Keep transfer
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void confirm()}>
              Cancel transfer
            </Button>
          </>
        }
      >
        {error ? (
          <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
            {error}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
