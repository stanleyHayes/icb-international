# 003 — Masthead reveal: PageHeader + ProductHero

- **Status**: DONE
- **Commit**: 32622c1
- **Severity**: LOW (additive polish, ~15 routes at once)
- **Category**: Missed opportunities
- **Estimated scope**: 2 files — `apps/marketing/src/components/page-header.tsx`, `apps/marketing/src/components/product-hero.tsx`
- **Depends on**: plan 001 (uses the `animate-rise` utility)

## Problem

`PageHeader` (`apps/marketing/src/components/page-header.tsx:21-36`) is the masthead opening personal, business, wealth, rates, tools, about, careers, newsroom (+[slug]), security (+subpages), contact, support, branches, complaints, and all legal pages (`legal/shared.tsx` renders it). `ProductHero` (`apps/marketing/src/components/product-hero.tsx:41-49`) repeats the same eyebrow → h1 → lead rhythm on product detail pages. Both render statically. Animating the two components gives the whole non-home site a first-load text entrance.

## Target

CSS-only `animate-rise` (400ms, `--icb-ease-out`, from plan 001) with staggered `animationDelay`:

**page-header.tsx** (current structure at :21-36 — eyebrow `<p>` at :23-25, `<h1>` at :26-28, standfirst `<p>` at :30-32, children `<div>` at :34):
- eyebrow: `animate-rise`, delay 0ms
- h1: `animate-rise`, `style={{ animationDelay: '60ms' }}`
- standfirst paragraph: `animate-rise`, `style={{ animationDelay: '120ms' }}`
- children wrapper div: `animate-rise`, `style={{ animationDelay: '180ms' }}`

Append `animate-rise` to each element's existing `className` string; do not reorder or alter existing classes.

**product-hero.tsx**: read the file first; apply the identical pattern to its eyebrow, h1, lead, and CTA/actions row with the same 0/60/120/180ms delays.

## Repo conventions to follow

- Same as plan 002: utility + inline delay only, components stay server components.

## Steps

1. Edit `page-header.tsx` — four additions per the table.
2. Read `product-hero.tsx`, apply the same pattern to its eyebrow/heading/lead/actions.

## Boundaries

- Do NOT touch the `Section` or `Prose` components in `page-header.tsx`.
- Do NOT change any page that consumes these components — the change propagates.

## Verification

- **Mechanical**: `pnpm --filter @icb/marketing typecheck` + `lint` + `build` pass.
- **Feel check**: load `/rates`, `/security`, `/support` and one product page (e.g. `/personal/current-account` — check `app/personal` for a real slug): eyebrow, heading, standfirst rise in sequence. Emulate `prefers-reduced-motion: reduce` — near-instant render, no movement.
- **Done when**: every route using PageHeader/ProductHero shows the staggered masthead entrance with no page-specific edits.
