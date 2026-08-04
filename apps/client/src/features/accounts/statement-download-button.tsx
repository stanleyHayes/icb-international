'use client';

import { Download } from 'lucide-react';
import { useState, useTransition } from 'react';

import { statementDownloadLink } from './actions';

/**
 * Downloads one statement.
 *
 * The signed link is minted on demand by the server action (each link is short-lived), then
 * opened in a new tab so the customer keeps their place on the page.
 */
export function StatementDownloadButton({ statementId }: Readonly<{ statementId: string }>) {
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function download() {
    setError(false);
    startTransition(async () => {
      const url = await statementDownloadLink(statementId);
      if (url === null) {
        setError(true);
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={download}
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--icb-primary)] hover:underline disabled:opacity-50"
      >
        <Download size={14} />
        {pending ? 'Preparing…' : 'PDF'}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-[var(--icb-danger-fg)]">
          Unavailable — try again
        </span>
      ) : null}
    </span>
  );
}
