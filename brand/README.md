# ICB Brand System

**ICB — International Commercial Bank.** Simulated banking platform. This directory is the
single source of truth for identity. Apps consume it; they never redefine it.

---

## 1. The mark

An **interlocked `I` and `C`** — the initials of *International Commercial*, drawn as a gold
pillar passing in front of a navy meridian arc. The arc reads as a globe and a coin; the pillar
reads as a column (the oldest visual shorthand for a bank) and as the `I`. The knockout gap where
they cross is a deliberate interlock: two parties, one transaction.

Geometry is locked on a **96 × 96** grid:

| Element | Spec |
| --- | --- |
| Arc | centre `(53, 48)`, mid-radius `27`, stroke `13`, aperture `88°` facing right |
| Pillar | `x = 16.5`, `y = 22.5 → 73.5`, stroke `13`, round caps |
| Interlock gap | pillar re-stroked at `20` as a mask over the arc → `3.5` clear on each side |
| Optical bounds | `x 10 → 86.5`, `y 14.5 → 81.5` |

Never redraw by eye. Scale the SVG.

## 2. Files

| File | Use |
| --- | --- |
| `logo/icb-mark.svg` | Mark alone, full colour. App headers, avatars, favicons ≥ 48px. |
| `logo/icb-mark-mono-navy.svg` | One colour. Print, embossing, faxed statements. |
| `logo/icb-mark-mono-white.svg` | One colour on dark/photographic backgrounds. |
| `logo/icb-logo-horizontal.svg` | Primary lockup. Site headers, letterhead, email signature. |
| `logo/icb-logo-horizontal-dark.svg` | Primary lockup on navy/dark surfaces. |
| `logo/icb-logo-stacked.svg` | Square-ish spaces: cards, social avatars, splash screens. |
| `logo/icb-app-icon.svg` | 512 × 512 tile. PWA icon, mobile app, OG image base. |
| `logo/favicon.svg` | 32 × 32 optimised — heavier strokes, wider interlock gap. |

## 3. Clear space & minimum size

- **Clear space** = the pillar's stroke width (`13` units at 96-grid scale = ~13.5% of mark height)
  on every side. Nothing enters it.
- **Minimum size**: mark `20px`; horizontal lockup `160px` wide; stacked lockup `120px` wide.
  Below `20px`, use `favicon.svg`.

## 4. Misuse

Do not: recolour outside the palette · add drop shadows, bevels or outer glows · rotate ·
stretch non-uniformly · place the full-colour mark on mid-tone backgrounds (use a mono variant) ·
re-typeset the wordmark in another face · box the mark unless using `icb-app-icon.svg`.

## 5. Colour

Values live in `tokens/colors.json`; CSS custom properties in `tokens/tokens.css`.

| Role | Token | Hex |
| --- | --- | --- |
| Primary | `--icb-primary` | `#0F4C81` |
| Deep navy (ink, dark surfaces) | `--icb-navy-700` | `#0B2C4D` |
| Accent (the pillar, highlights) | `--icb-accent` | `#C9A227` |
| Credit / money in | `--icb-credit` | `#0E9F6E` |
| Debit / money out | `--icb-debit` | `#41505E` |
| Pending | `--icb-pending` | `#A5831C` |

**Gold is an accent, never a surface.** It marks the single most important thing on a view and
nothing else. All text/background pairings in `tokens.css` meet WCAG 2.2 AA (4.5:1 body,
3:1 large text and UI borders).

## 6. Typography

- **Outfit** — the single voice of the brand. Wordmark, headings, UI, body, figures.
  Weights 300 / 400 / 500 / 600 / 700 / 800. Its geometric construction echoes the mark's
  circle-and-bar geometry exactly, so the lockup reads as one object rather than a logo beside
  some type.
- **IBM Plex Mono** — account numbers, IBANs, references, ledger IDs. Anything a customer might
  read aloud, copy, or dictate is monospaced so digits cannot be misread.

Money is always set with `font-variant-numeric: tabular-nums`. Amounts right-align in tables and
never wrap. Currency codes are uppercase, tracked `+0.04em`, one weight lighter than the figure.

## 7. Wordmark note

The lockup SVGs set `ICB` and the descriptor as live `<text>` in Outfit with an Arial fallback.
For print, PDF export, or any environment without the webfont, convert to outlines first. The
mark itself is pure geometry and always renders identically.

## 8. Voice

Plain, exact, unhurried. State the number, then the context. Never exclaim. Never use
"seamless", "revolutionary", "effortless". Errors say what happened and what to do next.

The product presents itself as a real bank — no sandbox banners, no watermarks, no "demo"
chrome. The simulation boundary is enforced in the backend (no external rail is ever contacted)
and surfaced only through the `X-ICB-Environment` response header, which customers never see.
