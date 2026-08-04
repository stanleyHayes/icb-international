import type { AccountSummary, CursorPage, TransferTemplate } from '@icb/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { TemplateManager } from '@/features/transfer/template-manager';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Transfer templates' };

/** Saved transfer terms, re-runnable in one tap — every use still goes through quote + confirm. */
export default async function TemplatesPage() {
  const [templates, accountsPage] = await Promise.all([
    api<TransferTemplate[]>('/transfer-templates', { tags: ['transfer-templates'] }),
    api<CursorPage<AccountSummary>>('/accounts?limit=50', { tags: ['accounts'] }),
  ]);

  return (
    <>
      <Link
        href="/transfer"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Move money
      </Link>

      <header className="mt-4">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Templates</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Saved transfer terms you can re-run without retyping. Each use is still quoted and
          confirmed before money moves.
        </p>
      </header>

      <div className="mt-8">
        <TemplateManager templates={templates} accounts={accountsPage.items} />
      </div>
    </>
  );
}
