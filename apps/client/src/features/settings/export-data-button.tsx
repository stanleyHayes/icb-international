'use client';

import type { DownloadLink } from '@icb/contracts';
import { Button } from '@icb/ui';
import { AlertCircle, Download } from 'lucide-react';
import { useState, useTransition } from 'react';

import { exportDataAction } from './security-actions';

/**
 * Data export. The API assembles the export and hands back a signed link with an expiry; the
 * link is shown, not auto-followed, so the customer sees what they are about to download and
 * how long the link lives.
 */
export function ExportDataButton() {
  const [result, setResult] = useState<{ error: string | null; link: DownloadLink | null } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const request = () => {
    startTransition(async () => {
      setResult(await exportDataAction());
    });
  };

  return (
    <div>
      <Button onClick={request} loading={pending} leadingIcon={<Download size={16} />}>
        Request export
      </Button>
      {result?.link ? (
        <p role="status" className="mt-3 text-sm">
          <a
            href={result.link.url}
            className="font-medium text-[var(--icb-primary)] hover:underline"
          >
            Download {result.link.filename}
          </a>{' '}
          <span className="text-[var(--icb-text-subtle)]">
            — link expires {new Date(result.link.expiresAt).toLocaleTimeString('en-GB')}
          </span>
        </p>
      ) : null}
      {result?.error ? (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-[var(--icb-danger-fg)]">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {result.error}
        </p>
      ) : null}
    </div>
  );
}
