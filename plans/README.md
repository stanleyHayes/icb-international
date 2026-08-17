# Animation plans — marketing site

Written by an `improve-animations` audit (commit 32622c1). Personality: crisp editorial bank — subtle rises and fades, existing `--icb-ease-*`/`--icb-duration-*` tokens only, reduced-motion handled via the token collapse.

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| 001 | Motion foundation: token bindings, keyframes, Reveal primitive | MEDIUM | DONE |
| 002 | Home hero first-load text reveal | LOW | DONE |
| 003 | Masthead reveal: PageHeader + ProductHero | LOW | DONE |
| 004 | Scroll-triggered section reveals and grid staggers | LOW | DONE |
| 005 | State-change motion: calculators, funnel, confirmation | MEDIUM | DONE |
| 006 | Spatial entrances: chat panel, mobile nav; FAB motion guard | MEDIUM | DONE |

## Execution order

1. **001 first** — everything else depends on its utilities/component.
2. Then 002, 003, 004, 005, 006 in any order / parallel (disjoint file sets; 006 edits `packages/ui` so it must not run concurrently with 001).

Dependencies: 002–006 → 001. No other interdependencies.
