import type { BalanceHistory } from '@icb/contracts';
import { BalanceAreaChart, Card, CardHeader } from '@icb/ui';

import { api } from '@/lib/api';

/**
 * Closing balance per day, from the ledger's own history.
 *
 * The chart shows where the balance has been, not a projection — a bank that charts the future
 * is guessing with the customer's money.
 */
export async function BalanceHistoryCard({ accountId }: Readonly<{ accountId: string }>) {
  const history = await api<BalanceHistory>(
    `/accounts/${accountId}/balance-history?granularity=day`,
    { tags: ['accounts'] },
  );

  return (
    <Card>
      <CardHeader title="Balance history" description="Daily closing balance." />
      <div className="px-5 pb-5">
        <BalanceAreaChart
          points={history.points.map((point) => ({
            date: point.date,
            minorUnits: point.closing.minorUnits,
          }))}
          currency={history.currency}
          label="Balance over time"
          emptyTitle="No history yet"
          emptyDescription="The balance history builds up as transactions post."
        />
      </div>
    </Card>
  );
}
