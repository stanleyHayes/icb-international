# ADR-10: Tailwind v4 + CSS custom properties from `brand/tokens`

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

Three apps (marketing, client, admin), the `@icb/ui` design system, and React Email templates
must all render the same brand. Duplicating a palette per app drifts immediately; the brand
sheet (`brand/tokens/colors.json`, generated `tokens.css`) is already the single source.

## Decision

Tailwind CSS 4 everywhere, with the theme bound to CSS custom properties from `brand/tokens`.
`@icb/config-tailwind` ships the shared preset: it re-exports the generated `tokens.css` and
maps utilities onto the `--icb-*` variables via `@theme inline`, so a token change in
`colors.json` propagates to every surface. `@icb/ui` builds components on those utilities, and
theme switching (light/dark) is a `data-theme` attribute that re-points the variables.

## Rationale

- One token source drives three apps, the design system, email templates, and the brand sheet —
  there is no second definition to drift.
- Tailwind v4's CSS-first configuration makes the preset a plain CSS file, consumable by any
  surface (including React Email) without a JS toolchain dependency.
- CSS custom properties make theme switching a runtime attribute toggle with no rebuild and no
  flash.

## Rejected alternatives

- **Per-app styles** — drift by construction.
- **CSS-in-JS** — friction with React Server Components (ADR-09) and a runtime cost Tailwind's
  compile-time approach avoids.
