import { cn } from '../lib/cn';

/**
 * The ICB mark, inlined rather than loaded as an image.
 *
 * Inline SVG means the mark inherits colour from CSS (so the dark-background variant is a class,
 * not a second file), renders on the first paint with no network request, and stays crisp at any
 * size. Geometry matches brand/logo/icb-mark.svg exactly — see brand/README.md §1.
 */
export function IcbMark({ className, id = 'mark' }: Readonly<{ className?: string; id?: string }>) {
  return (
    <svg viewBox="0 0 96 96" className={cn('h-8 w-8', className)} role="img" aria-label="ICB">
      <title>ICB</title>
      <defs>
        <linearGradient id={`icbArc-${id}`} x1="18" y1="14" x2="88" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.82" />
          <stop offset="1" stopColor="currentColor" />
        </linearGradient>
        <mask id={`icbMask-${id}`} maskUnits="userSpaceOnUse" x="-20" y="-20" width="136" height="136">
          <rect x="-20" y="-20" width="136" height="136" fill="#fff" />
          <path d="M16.5 22.5V73.5" stroke="#000" strokeWidth="20" strokeLinecap="round" />
        </mask>
      </defs>
      <path
        d="M72.42 29.24A27 27 0 1 0 72.42 66.76"
        fill="none"
        stroke={`url(#icbArc-${id})`}
        strokeWidth="13"
        mask={`url(#icbMask-${id})`}
      />
      <path
        d="M16.5 22.5V73.5"
        fill="none"
        stroke="var(--icb-accent)"
        strokeWidth="13"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IcbLogo({
  className,
  showDescriptor = true,
  id = 'logo',
}: Readonly<{
  className?: string;
  showDescriptor?: boolean;
  id?: string;
}>) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <IcbMark className="h-9 w-9 text-[var(--icb-navy-700)]" id={id} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.4rem] leading-none font-extrabold tracking-[-0.01em]">
          ICB
        </span>
        {showDescriptor ? (
          <span className="mt-1 text-[0.5rem] leading-none font-semibold tracking-[0.18em] text-[var(--icb-text-subtle)] uppercase">
            International Commercial Bank
          </span>
        ) : null}
      </span>
    </span>
  );
}
