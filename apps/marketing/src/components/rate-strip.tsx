const RATES = [
  { label: 'Reserve Savings', value: '4.15%', note: 'AER, variable' },
  { label: '12-month deposit', value: '5.20%', note: 'fixed' },
  { label: 'Personal loan', value: 'from 8.9%', note: 'representative APR' },
  { label: 'International transfer', value: '0.35%', note: 'spread, no fixed fee' },
] as const;

/**
 * Headline rates.
 *
 * Every figure states its basis — AER, fixed, representative APR — because a rate without its
 * basis is not information, it is decoration.
 */
export function RateStrip() {
  return (
    <section
      aria-label="Headline rates"
      className="border-b border-[var(--icb-border)] bg-[var(--icb-navy-900)]"
    >
      <div className="mx-auto max-w-[1200px] px-5 py-8">
        <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {RATES.map((rate) => (
            <div key={rate.label}>
              <dt className="text-xs font-medium tracking-[0.1em] text-[var(--icb-navy-300)] uppercase">
                {rate.label}
              </dt>
              <dd className="mt-2 flex items-baseline gap-2">
                <span className="tabular font-display text-2xl font-bold text-white">
                  {rate.value}
                </span>
                <span className="text-xs text-[var(--icb-navy-300)]">{rate.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
