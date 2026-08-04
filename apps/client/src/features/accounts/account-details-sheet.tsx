'use client';

import type { AccountDetail } from '@icb/contracts';
import { Button, Sheet, groupIdentifier, maskIdentifier } from '@icb/ui';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface DetailRow {
  label: string;
  value: string;
  /** Sensitive values start masked and can be revealed in place. */
  sensitive?: boolean;
}

/**
 * Everything needed to pay into this account, behind one button.
 *
 * The IBAN starts masked — it is the piece most often read over a shoulder — and every row
 * copies to the clipboard with a labelled button, so the sheet is fully keyboard-operable.
 */
export function AccountDetailsSheet({ account }: Readonly<{ account: AccountDetail }>) {
  const [open, setOpen] = useState(false);

  const rows: DetailRow[] = [
    { label: 'Account number', value: account.identifiers.number },
    { label: 'Sort code', value: account.identifiers.sortCode },
    { label: 'IBAN', value: groupIdentifier(account.identifiers.iban), sensitive: true },
    { label: 'SWIFT / BIC', value: account.identifiers.bic },
    { label: 'Currency', value: account.currency },
  ];

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Account details
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Account details">
        <p className="px-6 text-sm text-[var(--icb-text-muted)]">
          Share these to receive a payment into {account.nickname ?? account.productName}.
        </p>
        <dl className="mt-4 divide-y divide-[var(--icb-border)] px-6 pb-6">
          {rows.map((row) => (
            <CopyableRow key={row.label} row={row} />
          ))}
        </dl>
      </Sheet>
    </>
  );
}

function CopyableRow({ row }: Readonly<{ row: DetailRow }>) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const shown = row.sensitive === true && !revealed ? maskIdentifier(row.value) : row.value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(row.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="shrink-0 text-sm text-[var(--icb-text-subtle)]">{row.label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-mono text-sm">{shown}</span>
        {row.sensitive === true ? (
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? `Hide ${row.label}` : `Reveal ${row.label}`}
            aria-pressed={revealed}
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--icb-text-subtle)] transition-colors hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]"
          >
            {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void copy();
          }}
          aria-label={`Copy ${row.label}`}
          className="rounded-[var(--radius-sm)] p-1.5 text-[var(--icb-text-subtle)] transition-colors hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]"
        >
          {copied ? <Check size={15} className="text-[var(--icb-success-fg)]" /> : <Copy size={15} />}
        </button>
      </dd>
    </div>
  );
}
