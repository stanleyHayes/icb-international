import { cn } from '../lib/cn';

/**
 * The loading state, drawn as the mark itself.
 *
 * The ICB arc is an open path, so tracing it is the mark completing rather than a spinner
 * borrowed from somewhere else — the wait reads as the brand assembling. The gold stem lands
 * last, on a delay, so the two strokes read as one gesture. Motion lives in globals.css
 * (`.icb-splash-arc` / `.icb-splash-stem`), which also holds the reduced-motion end state.
 *
 * Geometry is copied from IcbMark rather than imported: the draw needs per-path animation
 * hooks that IcbMark does not expose. Same precedent, and same reason, as apple-icon.tsx.
 */
export function BrandSplash({
  label = 'Loading',
  className,
  id = 'splash',
}: Readonly<{ label?: string; className?: string; id?: string }>) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-h-[60vh] w-full flex-col items-center justify-center gap-7 px-6',
        className,
      )}
    >
      <svg
        viewBox="0 0 96 96"
        className="h-16 w-16 text-[var(--icb-primary)]"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* Notches the arc where the stem crosses it, exactly as the source mark does. */}
          <mask id={`splashMask-${id}`} maskUnits="userSpaceOnUse" x="-20" y="-20" width="136" height="136">
            <rect x="-20" y="-20" width="136" height="136" fill="#fff" />
            <path d="M16.5 22.5V73.5" stroke="#000" strokeWidth="20" strokeLinecap="round" />
          </mask>
        </defs>
        {/* pathLength="1" normalises the dash maths, so the arc's real length never matters. */}
        <path
          className="icb-splash-arc"
          d="M72.42 29.24A27 27 0 1 0 72.42 66.76"
          pathLength="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="13"
          mask={`url(#splashMask-${id})`}
        />
        <path
          className="icb-splash-stem"
          d="M16.5 22.5V73.5"
          pathLength="1"
          fill="none"
          stroke="var(--icb-accent)"
          strokeWidth="13"
          strokeLinecap="round"
        />
      </svg>

      <span className="text-[0.6875rem] font-semibold tracking-[var(--icb-tracking-caps)] text-[var(--icb-text-subtle)] uppercase">
        {label}
      </span>
    </div>
  );
}
