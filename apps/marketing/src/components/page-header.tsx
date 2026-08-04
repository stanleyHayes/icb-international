import type { ReactNode } from 'react';

/**
 * The masthead every non-home page opens with.
 *
 * One component rather than a hand-rolled header per page, so the rhythm between eyebrow,
 * heading and standfirst is identical everywhere and a new page cannot drift.
 */
export function PageHeader({
  eyebrow,
  title,
  standfirst,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  standfirst?: string;
  children?: ReactNode;
}>) {
  return (
    <header className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)]">
      <div className="mx-auto max-w-[1200px] px-5 py-16 lg:py-20">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--icb-accent-text)] uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
          {title}
        </h1>
        {standfirst ? (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--icb-text-muted)]">
            {standfirst}
          </p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
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
