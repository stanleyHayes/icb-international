'use client';

import { Button, Dialog } from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { deleteBeneficiaryAction } from './actions';

/**
 * Remove a payee, behind an explicit confirm — deleting also removes the destination a saved
 * template might point at.
 */
export function DeleteBeneficiaryButton({
  beneficiaryId,
  name,
}: Readonly<{ beneficiaryId: string; name: string }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = await deleteBeneficiaryAction(beneficiaryId);
    setBusy(false);
    if (result.status === 'error') {
      setError(result.message);
      return;
    }
    setOpen(false);
    router.push('/beneficiaries');
    router.refresh();
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Remove payee
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Remove ${name}?`}
        description="They are removed from your payees immediately. Transfers already sent are unaffected."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Keep payee
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void confirm()}>
              Remove payee
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
