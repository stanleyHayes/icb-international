'use client';

import { Button } from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cancelStandingOrderAction } from './actions';

/** Stop a standing order: future runs cease, history is untouched. */
export function CancelStandingOrderButton({
  standingOrderId,
}: Readonly<{ standingOrderId: string }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const result = await cancelStandingOrderAction(standingOrderId);
    setBusy(false);
    if (result.status === 'done') {
      router.refresh();
    } else {
      setError(result.message ?? 'This standing order could not be cancelled.');
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant="ghost" size="sm" loading={busy} onClick={() => void cancel()}>
        Cancel
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-[var(--icb-danger-fg)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
