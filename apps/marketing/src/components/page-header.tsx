import Image, { type StaticImageData } from 'next/image';
import type { ReactNode } from 'react';

/**
 * The masthead every non-home page opens with.
 *
 * One component rather than a hand-rolled header per page, so the rhythm between eyebrow,
 * heading and standfirst is identical everywhere and a new page cannot drift.
 *
 * `portrait` turns the masthead into two columns for the segment pages, where a face answers
 * "is this page for me?" faster than the standfirst can. It is optional and the pages that omit
 * it render exactly as before — a single measure of text, unchanged.
 */
export function PageHeader({
  eyebrow,
  title,
  standfirst,
  portrait,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  standfirst?: string;
  portrait?: { src: StaticImageData; alt: string };
  children?: ReactNode;
}>) {
  return (
    <header className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)]">
      <div
        className={
          portrait
            ? 'mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-20'
            : 'mx-auto max-w-[1200px] px-5 py-16 lg:py-20'
        }
      >
        <div>
          <p className="animate-rise text-xs font-semibold tracking-[0.14em] text-[var(--icb-accent-text)] uppercase">
            {eyebrow}
          </p>
          <h1
            className="mt-3 max-w-3xl animate-rise font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl"
            style={{ animationDelay: '60ms' }}
          >
            {title}
          </h1>
          {standfirst ? (
            <p
              className="mt-5 max-w-2xl animate-rise text-lg leading-relaxed text-[var(--icb-text-muted)]"
              style={{ animationDelay: '120ms' }}
            >
              {standfirst}
            </p>
          ) : null}
          {children ? (
            <div className="mt-8 animate-rise" style={{ animationDelay: '180ms' }}>
              {children}
            </div>
          ) : null}
        </div>

        {portrait ? (
          <div
            className="animate-rise relative aspect-[4/5] overflow-hidden rounded-[var(--radius-2xl)] sm:aspect-[3/2] lg:aspect-auto lg:h-[420px]"
            style={{ animationDelay: '120ms' }}
          >
            <Image
              src={portrait.src}
              alt={portrait.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 460px"
              placeholder="blur"
              className="object-cover"
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** A titled band of content. Sections alternate surface colour to give the page a spine. */
export function Section({
  id,
  title,
  description,
  tone = 'default',
  children,
}: Readonly<{
  id?: string;
  title?: string;
  description?: string;
  tone?: 'default' | 'subtle';
  children: ReactNode;
}>) {
  return (
    <section
      id={id}
      className={
        tone === 'subtle'
          ? 'border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)]'
          : 'border-b border-[var(--icb-border)]'
      }
    >
      <div className="mx-auto max-w-[1200px] px-5 py-16 lg:py-20">
        {title ? (
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-[-0.02em]">{title}</h2>
            {description ? (
              <p className="mt-3 text-[var(--icb-text-muted)]">{description}</p>
            ) : null}
          </div>
        ) : null}
        <div className={title ? 'mt-10' : ''}>{children}</div>
      </div>
    </section>
  );
}

/** Long-form legal and policy copy, held to a comfortable measure. */
export function Prose({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="max-w-[68ch] space-y-5 text-[var(--icb-text-muted)] [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:text-[var(--icb-text)] [&_li]:leading-relaxed [&_p]:leading-relaxed [&_strong]:text-[var(--icb-text)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      {children}
    </div>
  );
}
