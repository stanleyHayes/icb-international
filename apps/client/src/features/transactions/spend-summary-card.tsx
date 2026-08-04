import type { SpendByCategory } from '@icb/contracts';
import { Card, CardBody, KpiStatTile } from '@icb/ui';
import Link from 'next/link';

import { api } from '@/lib/api';

/** ISO dates for the current and previous calendar months. */
function monthWindows(): { current: { from: string; to: string }; previous: { from: string; to: string } } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const previousEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return {
    current: { from: iso(start), to: iso(now) },
    previous: { from: iso(previousStart), to: iso(previousEnd) },
  };
}

/**
 * This month's spend against last month's.
 *
 * Scoped to the primary account's currency so a multi-currency customer never sees sterling and
 * dollars added together — adding across currencies is how a dashboard lies.
 */
export async function SpendSummaryCard({ currency }: Readonly<{ currency: string }>) {
  const windows = monthWindows();
  const [current, previous] = await Promise.all([
    api<SpendByCategory>(
      `/transactions/analytics/spend-by-category?currency=${currency}&from=${windows.current.from}&to=${windows.current.to}`,
      { tags: ['transactions'] },
    ),
    api<SpendByCategory>(
      `/transactions/analytics/spend-by-category?currency=${currency}&from=${windows.previous.from}&to=${windows.previous.to}`,
      { tags: ['transactions'] },
    ),
  ]);

  return (
    <Card>
      <CardBody className="pt-5">
        <KpiStatTile
          label="Spent this month"
          value={current.total}
          previousValue={previous.total}
          comparisonBasis="vs last month"
          direction="debit"
          emptyText="No spending yet this month"
        />
        <p className="mt-3 text-sm">
          <Link href="/transactions?direction=debit" className="font-medium text-[var(--icb-primary)] hover:underline">
            See where it went
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
