import { Card } from '@icb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { MacroManager } from '@/features/support/macro-manager';
import type { MacroView } from '@/features/support/types';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Support macros' };

/**
 * The team's saved replies, with usage counts so stale macros are visible.
 */
export default async function MacrosPage() {
  const macros = await api<MacroView[]>('/support/staff/macros');

  return (
    <>
      <Link
        href="/support"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Support inbox
      </Link>

      <header className="mt-4">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Macros</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          {macros.length} saved repl{macros.length === 1 ? 'y' : 'ies'} shared across the support
          team.
        </p>
      </header>

      <Card className="mt-6">
        <div className="p-5">
          <MacroManager macros={macros} />
        </div>
      </Card>
    </>
  );
}
