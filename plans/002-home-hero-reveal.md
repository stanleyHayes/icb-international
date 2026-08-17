# 002 — Home hero first-load text reveal

- **Status**: DONE
- **Commit**: 32622c1
- **Severity**: LOW (additive polish, high-visibility surface)
- **Category**: Missed opportunities
- **Estimated scope**: 1 file — `apps/marketing/src/app/page.tsx`
- **Depends on**: plan 001 (uses the `animate-rise` utility)

## Problem

The home hero (`apps/marketing/src/app/page.tsx:34-88`) renders everything at full opacity at once: deposit-protection pill (`:41-44`), the two-line h1 `Banking,` / `exactly.` (`:46-50`), lead paragraph (`:52-55`), CTA pair (`:57-71`), four-stat `<dl>` (`:73-83`), and the `BalancePreview` right column (`:86`). First load is the site's most-seen entrance and currently has zero motion. A staggered CSS-only rise (no JS, RSC-safe) fits the editorial bank personality.

## Target

Each hero element gets `animate-rise` (from plan 001: 400ms, `--icb-ease-out`, 12px rise, fill-mode `both`) with a staggered inline `animation-delay`. Order and delays:

| Element | Location | Delay |
| --- | --- | --- |
| Deposit pill | page.tsx:41-44 | 0ms |
| h1 | page.tsx:46-50 | 60ms |
| lead paragraph | page.tsx:52-55 | 120ms |
| CTA row | page.tsx:57-71 | 180ms |
| stats `<dl>` | page.tsx:73-83 | 240ms |
| `BalancePreview` wrapper | page.tsx:86 | 150ms |

Apply by adding the class + a style prop, e.g. the h1 becomes:

```tsx
<h1
  className="mt-6 animate-rise font-display text-5xl leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-6xl lg:text-[4.25rem]"
  style={{ animationDelay: '60ms' }}
>
```

(keep every existing class untouched; only append `animate-rise` and the `style` prop). For `BalancePreview` (a component, may not accept className) wrap it: `<div className="animate-rise" style={{ animationDelay: '150ms' }}><BalancePreview /></div>`.

Reduced motion is automatic: `animate-rise` resolves through `--icb-duration-slow`, which collapses to 1ms under `prefers-reduced-motion` (tokens.css:238-244).

## Repo conventions to follow

- No new CSS values — only the `animate-rise` utility from plan 001 and inline `animationDelay` for stagger (stagger delays of 60ms steps match the 30–80ms stagger budget).
- Server component stays a server component — no `'use client'`, no hooks.

## Steps

1. In `apps/marketing/src/app/page.tsx`, apply the six edits from the table above.

## Boundaries

- Do NOT restructure the markup or change copy/classes beyond the additions listed.
- Do NOT touch `BalancePreview` internals.
- Do NOT add dependencies or new CSS.

## Verification

- **Mechanical**: `pnpm --filter @icb/marketing typecheck` + `lint` + `build` pass.
- **Feel check**: `pnpm --filter @icb/marketing dev`, hard-reload `/` — pill, headline, lead, CTAs, stats rise in sequence over ~0.6s total; BalancePreview rises independently. In DevTools Animations panel at 10% speed, confirm each element starts at `translateY(12px)` / `opacity: 0`. With `prefers-reduced-motion: reduce` emulated, the hero renders essentially instantly.
- **Done when**: the six elements animate in the listed order and no layout shift occurs after the animation completes.
