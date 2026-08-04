'use client';

import type { TransferTemplate } from '@icb/contracts';
import { Amount, Button, Dialog, formatDate } from '@icb/ui';
import { ArrowRight, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { describeDestination } from './destination';
import { deleteTemplateAction } from './template-actions';

/**
 * Template rows with re-run and delete. Deleting a template never touches transfers made from
 * it, so the confirm dialog is light.
 */
export function TemplateList({ templates }: Readonly<{ templates: TransferTemplate[] }>) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<TransferTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleting) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await deleteTemplateAction(deleting.id);
    setBusy(false);
    if (result.ok) {
      setDeleting(null);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <ul className="divide-y divide-[var(--icb-border)]">
        {templates.map((template) => (
          <li key={template.id} className="flex items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{template.name}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--icb-text-subtle)]">
                {describeDestination(template.destination)} · used {template.useCount} time
                {template.useCount === 1 ? '' : 's'}
                {template.lastUsedAt ? ` · last ${formatDate(template.lastUsedAt, 'medium')}` : ''}
              </p>
            </div>
            {template.amount ? <Amount value={template.amount} size="sm" /> : null}
            <Link
              href={`/transfer/new?templateId=${template.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--icb-border-strong)] px-3 text-[0.8125rem] font-medium transition-colors hover:bg-[var(--icb-bg-muted)]"
            >
              Use
              <ArrowRight size={14} />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete template ${template.name}`}
              onClick={() => setDeleting(template)}
            >
              <Trash2 size={16} />
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description="The template is removed. Transfers already made from it are unaffected."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>
              Keep template
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void confirmDelete()}>
              Delete
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
