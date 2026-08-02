import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function CallToActionSection() {
  return (
      <section className="mx-auto max-w-[1200px] px-5 py-24">
        <div className="relative overflow-hidden rounded-[var(--radius-2xl)] bg-brand-tile px-8 py-16 text-center sm:px-16">
          <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">
            Open an account in under ten minutes
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--icb-navy-100)]">
            Verify your identity, choose your currency, and start moving money the same day.
          </p>
          <Link
            href="/open-account"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--icb-accent)] px-7 text-base font-semibold text-[var(--icb-navy-900)] transition-colors hover:bg-[var(--icb-gold-400)]"
          >
            Get started
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
  );
}
