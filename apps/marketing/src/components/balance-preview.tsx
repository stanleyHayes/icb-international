import { Amount, Card, IcbMark, StatusBadge, maskIdentifier } from '@icb/ui';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

const ACTIVITY = [
  { label: 'Salary — Meridian Group', date: 'Today', minorUnits: 840_000, direction: 'credit' },
  { label: 'Meridian Properties — rent', date: 'Yesterday', minorUnits: 221_759, direction: 'debit' },
  { label: 'Palm Grove Supermarket', date: 'Yesterday', minorUnits: 8_642, direction: 'debit' },
  { label: 'Transfer to Reserve Savings', date: '29 Jul', minorUnits: 25_000, direction: 'debit' },
] as const;

/**
 * A static, honest preview of the product.
 *
 * The figures match the seeded demo account exactly, so what a visitor sees here is what they
 * find after signing in — a marketing screenshot that lies about the product is a promise the
 * product then breaks.
 */
export function BalancePreview() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[var(--radius-2xl)] bg-brand-tile opacity-[0.06]"
      />

      <Card className="overflow-hidden shadow-[var(--shadow-xl)]">
        <div className="bg-brand-tile px-6 py-7 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-[0.12em] text-[var(--icb-navy-200)] uppercase">
                Everyday Current
              </p>
              <p className="mt-1 font-mono text-xs text-[var(--icb-navy-200)]">
                {maskIdentifier('1544819806')} · USD
              </p>
            </div>
            <IcbMark className="h-7 w-7 text-white/90" id="preview" />
          </div>

          <p className="tabular mt-6 font-display text-4xl font-bold tracking-[-0.02em]">
            $16,768.27
          </p>
          <p className="mt-1.5 text-sm text-[var(--icb-navy-200)]">
            Available $17,268.27 · includes $500.00 arranged overdraft
          </p>
        </div>

        <ul className="divide-y divide-[var(--icb-border)]">
          {ACTIVITY.map((item) => (
            <li key={item.label} className="flex items-center gap-3.5 px-5 py-3.5">
              <span
                aria-hidden="true"
                className={
                  item.direction === 'credit'
                    ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--icb-success-bg)] text-[var(--icb-success-fg)]'
                    : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--icb-bg-muted)] text-[var(--icb-text-muted)]'
                }
              >
                {item.direction === 'credit' ? (
                  <ArrowDownLeft size={15} />
                ) : (
                  <ArrowUpRight size={15} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.label}</p>
                <p className="text-xs text-[var(--icb-text-subtle)]">{item.date}</p>
              </div>

              <Amount
                value={{ minorUnits: item.minorUnits, currency: 'USD' }}
                direction={item.direction}
                size="sm"
              />
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] px-5 py-3">
          <span className="text-xs text-[var(--icb-text-muted)]">Ledger reconciled 14:58 UTC</span>
          <StatusBadge status="balanced" />
        </div>
      </Card>
    </div>
  );
}
