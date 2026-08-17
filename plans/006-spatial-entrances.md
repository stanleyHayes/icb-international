# 006 — Spatial entrances: chat panel from FAB, mobile nav; fix unguarded FAB motion

- **Status**: DONE
- **Commit**: 32622c1
- **Severity**: MEDIUM (unguarded FAB motion renders sitewide on marketing; missing spatial link)
- **Category**: Missed opportunities + Accessibility
- **Estimated scope**: 2 files — `packages/ui/src/chat/chat-widget.tsx`, `apps/marketing/src/components/site-header.tsx`
- **Depends on**: plan 001 (utilities available app-wide)

## Problem

1. **Chat panel pops from nowhere** — `packages/ui/src/chat/chat-widget.tsx:88-101` conditionally mounts `ChatPanel`; the panel (`:160-168`) appears at `bottom-20 right-4` with no motion connecting it to the FAB (`:115-128`) that spawned it. A panel should scale in from its trigger.
2. **FAB motion is unguarded** — `chat-widget.tsx:124`: `transition-transform duration-150 ... hover:scale-105 active:scale-95` has no `motion-reduce` guard and no hover-capability gate (touch fires hover on tap). This FAB renders on every marketing page and the client dashboard.
3. **Mobile nav teleports** — `apps/marketing/src/components/site-header.tsx:78-101`: the mobile menu mounts/unmounts instantly on toggle.

## Target

1. **ChatPanel entrance** (`chat-widget.tsx`, the `ChatPanel` `<section>` at :160-168): append to its `cn(...)` class list:

```
'origin-bottom-right animate-[icb-pop_var(--icb-duration-normal)_var(--icb-ease-out)_both]'
```

and add this keyframe at the end of `packages/ui/src/styles/globals.css` (next to `icb-rise`/`icb-fade` from plan 001):

```css
@keyframes icb-pop {
  from { opacity: 0; transform: scale(0.95) translateY(6px); }
  to { opacity: 1; transform: none; }
}
```

(`scale(0.95)`, never `scale(0)` — nothing appears from nothing. `transform-origin: bottom right` points it at the FAB. 240ms `--icb-duration-normal`. Reduced motion: the duration token collapses to 1ms, so the pop is effectively instant.) If Tailwind's arbitrary `animate-[…]` syntax with CSS-var references proves problematic in the build, fall back to binding `--animate-pop: icb-pop var(--icb-duration-normal) var(--icb-ease-out) both;` in the `@theme` block and using the `animate-pop` class — verify with a build either way.

No exit animation (conditional unmount without a library makes exits unreliable; an instant close is acceptable and honest — note this in the JSDoc).

2. **FAB guard** (`chat-widget.tsx:124`): change the class string to:

```
'transition-transform duration-150 ease-[var(--ease-out)] motion-reduce:transition-none hover:scale-105 active:scale-95'
```

and wrap the hover effect with the hover-capability variant if the codebase's Tailwind setup supports it: `hover:scale-105` → `[@media(hover:hover)]:hover:scale-105`. Verify this arbitrary variant compiles in the marketing build; if it errors, keep plain `hover:scale-105` and note the limitation. Keep `active:scale-95` ungated — press feedback is desirable for everyone; the `motion-reduce:transition-none` makes it instant for reduced-motion users.

3. **Mobile nav** (`site-header.tsx:78-101`): read the file first. On the mobile menu container, append `animate-fade` (240ms fade — a full-screen overlay should fade, not slide; sliding a viewport-sized panel on mobile Safari risks dropped frames). If the menu is a dropdown panel anchored under the header bar rather than a full-screen overlay, use `origin-top animate-[icb-pop_var(--icb-duration-normal)_var(--icb-ease-out)_both]` instead — pick based on what the markup actually is.

## Repo conventions to follow

- `packages/ui` conventions: `'use client'` files, `cn()`, JSDoc intent comments — match neighboring chat files.
- Keyframes live at the end of `packages/ui/src/styles/globals.css` — do NOT edit the generated `tokens.css` files.

## Steps

1. Add the `icb-pop` keyframe to `packages/ui/src/styles/globals.css`.
2. Edit `chat-widget.tsx` — panel entrance classes + FAB guard classes.
3. Read `site-header.tsx`, apply the appropriate entrance to the mobile menu container.

## Boundaries

- Do NOT add an exit animation library or restructure the conditional rendering.
- Do NOT touch the admin/client apps' use of ChatWidget — the fix propagates.
- Do NOT change desktop nav behavior in site-header.

## Verification

- **Mechanical**: `pnpm --filter @icb/ui typecheck` + `lint` + `test` pass; `pnpm --filter @icb/marketing build` passes.
- **Feel check**: open the chat on any marketing page — the panel pops from the FAB's corner over ~240ms; at 10% speed in DevTools confirm origin bottom-right and initial `scale(0.95)`. Emulate reduced motion — panel appears instantly, FAB hover does not scale. Resize to mobile, open the nav — it fades (or pops from the top) in.
- **Done when**: both entrances run from their trigger geometry and the FAB respects reduced motion.
