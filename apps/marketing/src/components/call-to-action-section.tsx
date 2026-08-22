import { Reveal } from '@icb/ui';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import ctaConversation from '@/assets/imagery/cta-conversation.webp';

/**
 * The closing call to action.
 *
 * The photograph carries its own deep-navy wall on the left and its subjects on the right, so the
 * copy sits in space the picture already left for it rather than on top of anyone. The scrim over
 * the top is what guarantees the contrast: the image is art direction, but it is not load-bearing
 * for legibility — the text stays readable if it never loads.
 */
export function CallToActionSection() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-24">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-[var(--radius-2xl)] bg-brand-tile">
          <Image
            src={ctaConversation}
            alt="Two ICB colleagues talking across a table in the Accra office."
            fill
            sizes="(max-width: 1200px) 100vw, 1160px"
            placeholder="blur"
            className="-z-10 object-cover object-right"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,var(--icb-navy-900)_26%,rgba(11,44,77,0.86)_46%,rgba(11,44,77,0.30)_78%,rgba(11,44,77,0.16)_100%)]"
          />

          <div className="max-w-xl px-8 py-16 sm:px-14 lg:py-20">
            <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">
              Open an account in under ten minutes
            </h2>
            <p className="mt-4 max-w-md text-[var(--icb-navy-100)]">
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
        </div>
      </Reveal>
    </section>
  );
}
