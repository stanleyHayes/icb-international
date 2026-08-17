# 004 — Scroll-triggered section reveals and grid staggers

- **Status**: DONE
- **Commit**: 32622c1
- **Severity**: LOW (additive polish)
- **Category**: Missed opportunities
- **Estimated scope**: ~10 files in `apps/marketing/src` (components + pages listed below)
- **Depends on**: plan 001 (the `Reveal` component)

## Problem

Below the fold, every section and card grid renders statically — no motion acknowledges the user scrolling new content in. The `Reveal` primitive from plan 001 (IntersectionObserver, opacity + 14px rise, 400ms `--icb-ease-out`, once-only, reduced-motion-safe) exists for exactly this. Stagger grids with 60ms delay steps so cards cascade rather than appearing as a block.

## Target

Wrap the following with `<Reveal>` (imported from `@icb/ui`). For grids, wrap EACH CARD/ITEM (not the whole grid) with `delay={index * 60}` so items stagger. For full-width bands, one `Reveal` with no delay around the section content.

- `apps/marketing/src/components/why-icb-section.tsx:44-58` — the 2×2 card grid: wrap each card, stagger 60ms.
- `apps/marketing/src/components/transparency-section.tsx:52-68` — wrap the section's content block (single Reveal, no stagger on table rows — a table row cascade reads as jitter; one reveal for the whole table).
- `apps/marketing/src/components/call-to-action-section.tsx:7-21` — single Reveal around the tile.
- `apps/marketing/src/components/product-section.tsx:26-96` — each alternating ProductSection: one Reveal around the whole section content (it is a two-col grid; staggering its children fights the side-by-side layout). Read the file first to place the wrapper without breaking the alternating-surface logic.
- `apps/marketing/src/components/product-sections.tsx:21-35` (FeatureGrid) — wrap each feature card, stagger 60ms; `:49-94` (EligibilitySection) — wrap each of the twin cards, delays 0 and 60.
- `apps/marketing/src/components/fee-schedule.tsx:38-57` — wrap each product card, stagger 60ms.
- `apps/marketing/src/app/security/page.tsx:90-104` (controls grid) and `:145-168` (guides) — each card, stagger 60ms.
- `apps/marketing/src/app/contact/page.tsx:56-74` — each channel card, stagger 60ms.
- `apps/marketing/src/app/careers/page.tsx:47-57` — "Working here" cards, stagger 60ms.
- `apps/marketing/src/app/support/page.tsx:60-74` — topic grid cards, stagger 60ms.
- `apps/marketing/src/app/about/sections.tsx:14-30` — leadership cards, stagger 60ms.
- `apps/marketing/src/app/newsroom/page.tsx:33-67` — article list rows, stagger 60ms.

Rules when placing wrappers:
- `Reveal` renders a `<div>` — never place it where a `<div>` is invalid HTML (e.g. as a direct child of `<dl>` in `rate-strip.tsx` — SKIP RateStrip entirely for this reason).
- In `.map()` loops, pass `delay={(index % 4) * 60}` for grids with 4 columns so the stagger resets per visual row; for simple lists `delay={index * 60}` capped at 240ms (`delay={Math.min(index, 4) * 60}`).
- Where the map callback currently returns an element with a `key`, the `Reveal` wrapper takes the `key` instead.
- Do not wrap anything above the fold on any page (mastheads are plan 003; the home hero is plan 002).

## Repo conventions to follow

- `import { Reveal } from '@icb/ui';` — check how these files already import from `@icb/ui` (barrel import) and match.
- Pages stay server components — `Reveal` is a client component and is legally rendered from RSC.

## Steps

1. Read each listed file first.
2. Apply the wrappers per the rules above.

## Boundaries

- Do NOT modify `packages/ui` (plan 001 owns it).
- Do NOT touch `rate-strip.tsx`, `balance-preview.tsx`, `site-header.tsx`, `site-footer.tsx`, or the open-account funnel (plans 005/006 own those).
- Do NOT change any existing classes or markup structure beyond adding the `Reveal` wrappers.

## Verification

- **Mechanical**: `pnpm --filter @icb/marketing typecheck` + `lint` + `build` pass.
- **Feel check**: `pnpm dev`, scroll `/` slowly — Why ICB cards cascade in 2×2; scroll `/security` and `/contact` — cards stagger per row. Content never blocks: the reveal is 400ms and pointer events work throughout. Emulate reduced motion — everything renders in place. With JS disabled (DevTools), content still renders (Reveal fails open — verify the no-JS case shows content; if it does not, that is a bug in plan 001's implementation: report, don't work around it here).
- **Done when**: every listed grid/section reveals on scroll with the stagger, and nothing above the fold animates on scroll.
