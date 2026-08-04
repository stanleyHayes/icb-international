import type { AccountSummary, CursorPage } from '@icb/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BulkUpload } from '@/features/transfer/bulk-upload';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Bulk upload' };

/** Pay many recipients at once from a CSV — payroll-style batches on the ACH rail. */
export default async function BulkUploadPage() {
  const accountsPage = await api<CursorPage<AccountSummary>>('/accounts?limit=50', {
    tags: ['accounts'],
  });

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
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Bulk upload</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Submit up to 500 domestic payments from a single CSV. Every row is validated before
          anything is sent.
        </p>
      </header>

      <div className="mt-8 max-w-3xl">
        <BulkUpload accounts={accountsPage.items} />
      </div>
    </>
  );
}
