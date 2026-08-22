import { Reveal } from '@icb/ui';
import Image from 'next/image';

import heroWindow from '@/assets/imagery/hero-window.webp';

/**
 * A breath between the two densest bands on the home page.
 *
 * `WhyIcbSection` is four claim cards and `TransparencySection` is a table; back to back they are
 * the longest unbroken stretch of text on the site. This puts a person between them and says the
 * one thing the surrounding sections keep implying but never state plainly — that the ledger is
 * the customer's, not the bank's.
 *
 * The copy is deliberately short. Everything it could elaborate on is already argued, with
 * figures, immediately above and below.
 */
export function CustomerBand() {
  return (
    <section className="border-y border-[var(--icb-border)] bg-[var(--icb-bg-subtle)]">
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-20 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <Reveal>
          <div className="relative aspect-[3/2] overflow-hidden rounded-[var(--radius-2xl)]">
            <Image
              src={heroWindow}
              alt="An ICB customer at the window of her office in Accra, early morning."
              fill
              sizes="(max-width: 1024px) 100vw, 600px"
              placeholder="blur"
              className="object-cover"
            />
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              The statement is the ledger
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[var(--icb-text-muted)]">
              Not a summary of it, not a nightly export that agrees with it most of the time. When
              you open your account you are reading the same double-entry record the bank closes its
              books on.
            </p>
            <p className="mt-4 leading-relaxed text-[var(--icb-text-muted)]">
              That is the whole design, and everything else on this page follows from it — why a
              rate has to state its basis, why a transfer quotes its rail and fee before you
              confirm, and why a balance never disagrees with the movements that produced it.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
