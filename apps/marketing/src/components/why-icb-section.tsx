import { Card, CardBody } from '@icb/ui';
import { Globe2, Layers, ShieldCheck, Zap } from 'lucide-react';

const PILLARS = [
  {
    icon: Layers,
    title: 'A real double-entry core',
    body: 'Every movement is two balanced postings, immutable once written. Your statement is the ledger, not a summary of it.',
  },
  {
    icon: Zap,
    title: 'Money that moves when it says',
    body: 'Instant between ICB accounts. Same-day wires before 16:00. Every transfer quotes its rail, fee and arrival before you confirm.',
  },
  {
    icon: Globe2,
    title: 'Fifteen currencies, one account',
    body: 'Hold, convert and send in USD, EUR, GBP, GHS and eleven more. Rates shown mid-market with the spread stated, not buried.',
  },
  {
    icon: ShieldCheck,
    title: 'Controls that actually decline',
    body: 'Freeze a card, block a category, cap a channel. Every switch is enforced at authorisation, not just displayed.',
  },
] as const;

/** The four claims ICB makes about itself, each one checkable in the product. */
export function WhyIcbSection() {
  return (
      <section className="mx-auto max-w-[1200px] px-5 py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--icb-accent)] uppercase">
            Why ICB
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Built the way a bank should be built
          </h2>
          <p className="mt-4 text-lg text-[var(--icb-text-muted)]">
            Most banking apps are a pretty layer over a spreadsheet. ICB is a ledger first, and the
            interface is what the ledger looks like.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {PILLARS.map((pillar) => (
            <Card key={pillar.title} className="transition-shadow hover:shadow-[var(--shadow-md)]">
              <CardBody className="pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-navy-50)] text-[var(--icb-primary)]">
                  <pillar.icon size={20} />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                  {pillar.body}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
  );
}
