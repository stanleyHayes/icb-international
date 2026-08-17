# 001 — Motion foundation: token bindings, keyframes, Reveal primitive

- **Status**: DONE
- **Commit**: 32622c1
- **Severity**: MEDIUM (foundation for all other chat/animation plans)
- **Category**: Cohesion & tokens
- **Estimated scope**: 3 files in `packages/ui`, 1 new component module

## Problem

Motion tokens exist but are half-wired. `packages/config-tailwind/tokens.css:171-177` (generated, do NOT hand-edit) defines `--icb-ease-out`, `--icb-ease-in-out`, `--icb-ease-emphasized`, and `--icb-duration-instant/fast/normal/slow` (90/160/240/400ms), plus a `prefers-reduced-motion` block that collapses all durations to 1ms (`tokens.css:238-244`). But the Tailwind `@theme` block in `packages/ui/src/styles/globals.css:80-81` binds ONLY `--ease-out` and `--ease-emphasized` — no duration utilities, no `--ease-in-out`, and there are zero custom `@keyframes` and zero scroll-reveal logic anywhere. Every new animation in plans 002–006 builds on what this plan adds.

## Target

Exact additions to `packages/ui/src/styles/globals.css`:

1. Inside the existing `@theme { … }` block, after line 81 (`--ease-emphasized: var(--icb-ease-emphasized);`):

```css
  --ease-in-out: var(--icb-ease-in-out);

  --duration-instant: var(--icb-duration-instant);
  --duration-fast: var(--icb-duration-fast);
  --duration-normal: var(--icb-duration-normal);
  --duration-slow: var(--icb-duration-slow);

  --animate-rise: icb-rise var(--icb-duration-slow) var(--icb-ease-out) both;
  --animate-fade: icb-fade var(--icb-duration-normal) var(--icb-ease-out) both;
```

2. At the end of the file (top level, NOT inside `@theme` or any `@layer`):

```css
@keyframes icb-rise {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}

@keyframes icb-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Scroll-reveal primitive styles. Starts hidden; the Reveal component flips data-visible. */
.icb-reveal {
  opacity: 0;
  transform: translateY(14px);
  transition:
    opacity var(--icb-duration-slow) var(--icb-ease-out),
    transform var(--icb-duration-slow) var(--icb-ease-out);
}

.icb-reveal[data-visible='true'] {
  opacity: 1;
  transform: none;
}

/* Reduced motion: durations already collapse to 1ms via the token override in tokens.css;
   additionally drop the translate and any stagger delay so nothing visibly moves. */
@media (prefers-reduced-motion: reduce) {
  .icb-reveal {
    transform: none;
    transition-delay: 0ms !important;
  }
}
```

Note: because `--animate-rise`/`--animate-fade` reference the duration tokens, the existing `prefers-reduced-motion` token collapse (1ms) automatically neutralizes them — no extra keyframe guards needed.

3. New component `packages/ui/src/layout/reveal.tsx` (the `layout/` directory exists). Follow the conventions of neighboring files: `'use client'` directive first line, JSDoc intent comment, `Readonly<{…}>` props, `cn` from `../lib/cn.js` (check the actual relative import a sibling layout component uses for `cn` and match it):

```tsx
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Scroll-triggered reveal.
 *
 * Content starts at opacity 0 / translateY(14px) and transitions in the first time it enters
 * the viewport (IntersectionObserver, once, then disconnects). The `delay` prop staggers
 * siblings — 30–80ms steps, never blocking interaction. Without JS or IntersectionObserver
 * the content renders visible (fails open, never hides content).
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: Readonly<{ children: ReactNode; className?: string; delay?: number }>) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible={visible}
      className={cn('icb-reveal', className)}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
```

4. Export `Reveal` from `packages/ui/src/index.ts` (find the layout export section; match its style).

## Repo conventions to follow

- Token values come ONLY from the existing `--icb-ease-*` / `--icb-duration-*` tokens — do not introduce new cubic-bezier or ms values anywhere in these plans.
- `@theme` binding exemplar: `packages/ui/src/styles/globals.css:80-81` (`--ease-out: var(--icb-ease-out);`).
- Tailwind 4 syntax: `@theme` bindings expose utilities (`animate-rise`, `duration-fast`, `ease-in-out`); `@keyframes` at top level are global.

## Steps

1. Edit `packages/ui/src/styles/globals.css` — @theme additions + keyframes + `.icb-reveal` block exactly as above.
2. Create `packages/ui/src/layout/reveal.tsx` exactly as above (adjust only the `cn` import path to match siblings).
3. Export from `packages/ui/src/index.ts`.

## Boundaries

- Do NOT edit `packages/config-tailwind/tokens.css` or `packages/ui/src/styles/tokens.css` — generated files.
- Do NOT touch any app code in this plan.
- Do NOT add dependencies.

## Verification

- **Mechanical**: `pnpm --filter @icb/ui typecheck` and `pnpm --filter @icb/ui lint` pass; `pnpm --filter @icb/marketing build` still compiles (proves the CSS parses under Tailwind 4).
- **Feel check**: run `pnpm --filter @icb/marketing dev`, add a temporary `<Reveal>` around any section, scroll it into view — it rises 14px and fades in over ~400ms, once. Toggle `prefers-reduced-motion` in DevTools Rendering panel — the element appears essentially instantly with no visible movement.
- **Done when**: `animate-rise`, `animate-fade`, `duration-*`, `ease-in-out` utilities resolve (verify by adding one to an element and seeing it in DevTools), `.icb-reveal` stylesheet rules exist, and `Reveal` is importable from `@icb/ui`.
