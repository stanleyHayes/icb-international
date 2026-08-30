# QA-07 — A11y automation

axe-core scan of every route in all three apps (marketing, client, admin) plus
keyboard-traversal checks on the key flows. Gate: **zero serious/critical** axe
violations (agent_plan.md §10).

## Layout

- `playwright.config.ts` — projects: `marketing`, `client`, `admin`, `keyboard-marketing`,
  plus `setup-client` / `setup-admin` auth projects (dependencies of the scan projects).
- `support/inventory.ts` — builds the route inventory from `apps/*/src/app` at load time:
  every `page.tsx` is a route; route groups are stripped; `[param]` segments become
  `{token}` placeholders.
- `support/resolve.ts` — resolves `{token}`s: client routes need entities owned by the
  demo customer (bootstrap creates one fixture per empty collection, additively and only
  when empty); admin routes take any document from Mongo.
- `global-setup.ts` — probes API/Mongo/apps and resolves ids. Missing infra is recorded in
  `.auth/availability.json` and matching tests **skip with a message** — never false-fail.
- `support/axe.ts` — WCAG 2.2 A/AA scan; all violations are collected and merged by the
  global teardown into `results/violations.json` (triaged into `docs/a11y-findings.md`).

## Prerequisites

1. Mongo replica set up (the API's `MONGO_URI`), seeded: `pnpm seed`.
2. API on :4100: `pnpm --filter @icb/api build && pnpm --filter @icb/api dev`.
3. The three apps — dev or production, on their standard ports:

   ```sh
   pnpm --filter @icb/marketing dev   # :3100
   pnpm --filter @icb/client dev      # :3101
   pnpm --filter @icb/admin dev       # :3102
   ```

   Production builds (`next build && next start`) scan faster and skip the dev overlay
   exclusion. Override URLs with `A11Y_MARKETING_URL` / `A11Y_CLIENT_URL` /
   `A11Y_ADMIN_URL` / `A11Y_API_URL` / `A11Y_MONGO_URI`.

## Run

```sh
pnpm test:a11y                          # everything
pnpm test:a11y -- --project=marketing   # one app
pnpm test:a11y -- --grep "transfer"     # route filter
```

Demo credentials come from the seed (`demo@icb.example`, staff `ops@icb.example` /
`lend@icb.example`).

## Skips you may see (coverage gaps, not failures)

Routes whose entity collections are empty in the seed (`loans`, `disputes`, `aml_alerts`,
`risk_cases`, `approval_requests`, `staff_users`, …) skip with a message. Create the
entity through the product UI or API once and the scan picks it up on the next run.

## Note: login throttling

`/auth/login` is throttled to 5 attempts/minute/IP (`throttle.constants.ts`). A full run
uses most of that budget (demo fixture login + customer UI login + staff UI login).
Back-to-back full runs within one minute will see the
setup tests skip with "login throttled by the API (429)" — wait out the window and rerun.

