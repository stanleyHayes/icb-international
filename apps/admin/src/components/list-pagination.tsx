'use client';

import { Pagination } from '@icb/ui';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function ListPagination({
  page,
  totalPages,
  total,
  itemLabel,
}: Readonly<{
  page: number;
  totalPages: number;
  total: number;
  itemLabel: string;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function goToPage(target: number) {
    const query = new URLSearchParams(searchParams.toString());
    query.set('page', String(target));
    router.push(`${pathname}?${query.toString()}` as Route, { scroll: false });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-surface)] px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <p className="text-xs text-[var(--icb-text-subtle)]">
        <span className="font-semibold text-[var(--icb-text)]">
          {total.toLocaleString('en-US')}
        </span>{' '}
        {itemLabel} · Page {page} of {totalPages}
      </p>
      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
