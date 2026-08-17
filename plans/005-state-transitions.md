# 005 — State-change motion: calculator results, funnel steps, confirmation

- **Status**: DONE
- **Commit**: 32622c1
- **Severity**: MEDIUM (calculator figures are the app's most frequent state-change teleport)
- **Category**: Missed opportunities
- **Estimated scope**: 3 files — `apps/marketing/src/components/calculators/calculator-parts.tsx`, `apps/marketing/src/app/open-account/funnel.tsx`, `apps/marketing/src/app/open-account/confirmation.tsx`
- **Depends on**: plan 001 (`animate-fade` / `animate-rise` utilities)

## Problem

Three state changes teleport:

1. **Calculator results** — `calculator-parts.tsx:44-77` (`ResultPanel`): the prominent result `<dd>` (`:67-72`) swaps instantly on every keystroke in all four calculators on `/tools`. The input→output causality is lost.
2. **Funnel steps** — `app/open-account/funnel.tsx:87-114`: `{Panel ? <Panel /> : <ReviewStep …/>}` swaps step content with no transition (focus management at `:46` already jumps to the heading — do not change that behavior).
3. **Confirmation** — `app/open-account/confirmation.tsx:29-70`: "Application received", the site's one genuine success moment, appears with zero motion; the `NEXT_STEPS` list (`:44-57`) is a natural staged reveal.

## Target

1. **ResultPanel figure crossfade**: key the result value element by its text so React remounts it on change, and add `animate-fade` (240ms, `--icb-ease-out`, from plan 001). Read the component first; the change is on the `<dd>` (or its inner `<span>`) that renders the figure:

```tsx
<dd key={formattedValue} className="animate-fade …existing classes…">
```

Using the value as `key` means each new figure fades in fresh; the old one unmounts instantly (no layout shift since the slot size is stable — if the figure's width varies noticeably, key the inner span instead of the dd so the box doesn't reflow; make that judgment when reading the code). Do this ONLY for the primary result figure, not every row — rows changing on keystroke with individual fades would flicker constantly (frequency rule: rows stay instant).

2. **Funnel step panels**: wrap the step content swap in a keyed container that re-runs `animate-rise` per step:

```tsx
<div key={step} className="animate-rise">
  {Panel ? <Panel … /> : <ReviewStep … />}
</div>
```

Read funnel.tsx first to find the exact swap expression and the step state variable name; `key={step}` (whatever the current-step state is called) remounts per step so the 400ms rise replays on navigation. Reduced-motion users get an instant swap via the token collapse.

3. **Confirmation staged reveal**: apply `animate-rise` with staggered delays to the success block: icon/heading (0ms), body copy (60ms), the `NEXT_STEPS` list items (120/180/240ms — apply to each `<li>`), and any closing CTA (300ms). Read the file; keep all existing classes, append only.

## Repo conventions to follow

- Existing keyframe-free codebase: use ONLY the `animate-fade`/`animate-rise` utilities from plan 001.
- These are already client components (or rendered within them) — do not change component boundaries.

## Steps

1. Read all three files.
2. Apply the three changes above.

## Boundaries

- Do NOT change calculator math, formatting, or focus management.
- Do NOT animate the per-row figures in ResultPanel.
- Do NOT touch the progress bar (`progress.tsx`) — its color transition is already correct.

## Verification

- **Mechanical**: `pnpm --filter @icb/marketing typecheck` + `lint` + `build` pass.
- **Feel check**: on `/tools`, type into any calculator — the headline figure fades in on each change, rows stay instant. In the open-account funnel, advance a step — the panel rises 12px over 400ms; go back — same. Submit a test application — the confirmation stages in. Emulate reduced motion — all swaps are instant.
- **Done when**: all three state changes have the described motion and no flicker occurs while typing continuously in a calculator.
