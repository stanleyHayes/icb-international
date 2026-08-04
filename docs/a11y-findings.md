# A11y findings — QA-07 axe-core automation

Source: `pnpm test:a11y` (e2e/a11y) — axe-core WCAG 2.2 A/AA on every route of all three
apps, plus keyboard-traversal specs on the key flows. Full run: 150 tests covering 133
routes (marketing 39, client 53, admin 41) on Chromium. Raw data:
`e2e/a11y/results/violations.json` (latest run) and `e2e/a11y/results/history/`
(every run). Gate per agent_plan.md §10: **zero serious/critical violations**.

## Severity summary (full run, 2026-08-03)

| Impact         | Instances  | Rules                                                                                                                                   | Status                      |
| -------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| critical       | 1 → 0      | `label`                                                                                                                                 | **fixed by QA-07** (see F0) |
| serious        | 134        | `color-contrast` (105), `document-title` (12), `html-has-lang` (12), `definition-list` (3), `link-in-text-block` (1), `target-size` (1) | open — triaged below        |
| moderate/minor | 0 recorded | —                                                                                                                                       | —                           |

`document-title` + `html-has-lang` (24 instances, 12 routes) are not markup bugs — they are
the Next.js error page, i.e. **those 12 routes crash server-side** (see F6). Fixing the
crashes clears 24 of the 134 serious instances and unblocks scanning those routes. (One of
the 12, admin `/staff/new`, was the QA-07 `'use server'` fix — verified rendering after.)

## Fixed by QA-07

- **F0 — `label` (critical), client `/support/tickets/{ticketId}`.** The file input in the
  reply form sat inside `Field` but never received the field's generated id, so it had no
  accessible name. One-line fix: `aria-label="Attachments"` on the input
  (`apps/client/src/features/support/reply-form.tsx`). Verified: rule gone on rerun.
- **`scrollable-region-focusable` (serious), admin `/`.** The monitor table's
  `overflow-x-auto` wrapper was not keyboard-reachable. One-line fix: `tabIndex={0}`
  (`apps/admin/src/components/monitor-table.tsx`). Verified: rule gone on rerun.
- **App bug (not a11y, blocked the whole admin app): `/login` 500'd in dev and prod.**
  `apps/admin/src/features/auth/actions.ts` is a `'use server'` module that exported the
  value `INITIAL_LOGIN_STATE`; server-action modules may only export async functions, so
  the import arrived `undefined` in the client bundle and `useActionState` produced an
  undefined state. Fixed by un-exporting the constant and keeping a local copy in
  `login-form.tsx` (same pattern as the client app). **ADM-01 owner, please review.**
- **Same bug class, admin `/staff/new`:** `INITIAL_STAFF_FORM_STATE` exported from
  `features/staff/actions.ts` (`'use server'`) crashed `CreateStaffForm`/`EditStaffForm`.
  Same fix applied; `/staff/new` verified rendering (only the systemic contrast finding
  remains). Two more files still export value constants from `'use server'` modules
  (`features/auth/mfa-actions.ts`, `features/system/actions.ts`) — they render today, but
  the pattern is a landmine; recommend the same treatment.

## Open findings

### F1 — `color-contrast` (serious) — systemic, all three apps, 105 routes

Token-level, measured against WCAG 1.4.3 (4.5:1 normal text):

| Token               | Value               | On                 | Ratio      | Verdict         |
| ------------------- | ------------------- | ------------------ | ---------- | --------------- |
| `--icb-accent`      | gold-500 `#c9a227`  | white              | **2.42:1** | fails hard      |
| `--icb-text-subtle` | slate-500 `#697d91` | white              | **4.25:1** | fails (< 4.5)   |
| `--icb-navy-400`    | `#3f71a0`           | navy-950 `#040f1c` | **3.74:1** | fails at 0.6rem |

Suggested fixes (owners: brand/tokens + app shells — deliberate design decision, not
made unilaterally here):

- Text-on-light in accent colour → use gold-600/700 (e.g. `#8a6d1d`-class values reach
  4.5:1); keep gold-500 for large display type and decorative use only.
- `--icb-text-subtle` → slate-600 `#5a6b7d` (5.48:1, passes) or a new slate-550.
- Admin console section labels (`apps/admin/src/components/console-shell.tsx:49`,
  `text-[var(--icb-navy-400)]` at 0.6rem) → navy-300 `#6e99c2` (6.42:1, passes).
- Also seen: the 0.5rem logo strapline (`IcbLogo` tagline) — too small to ever pass at
  its current colour; darken or drop below-decorative threshold.

### F2 — `definition-list` (serious) — marketing `/`, `/about`, `/tools`

`<dl>` children must be `dt`/`dd` groups (optionally div-wrapped). On `/` and `/about`
each wrapper div contains `dt + dd + p` — the trailing `<p>` breaks the group
(`apps/marketing/src/app/page.tsx:73`, `about/page.tsx:36`). Suggested: move the visible
label inside the `<dd>` (as a block span) and drop the `<p>`. On `/tools` the calculator
result panel (`components/calculators/calculator-parts.tsx:53`) renders a `<dl>` inside a
`role="status"` region — restructure likewise.

### F3 — `target-size` (serious, WCAG 2.2 §2.5.8) — client `/`

A `<summary>` disclosure on the dashboard is smaller than 24×24 CSS px. Suggested: add
`min-h-6 min-w-6` (or padding) to the summary control in the dashboard component.

### F4 — `link-in-text-block` (serious) — admin `/staff`

A link inside a paragraph (`text-[var(--icb-primary)]`) is not distinguishable from
surrounding text without colour. Suggested: underline it (`underline underline-offset-2`)
or darken to meet 3:1 against adjacent text.

### F5 — No skip-to-content link (WCAG 2.4.1, keyboard) — client + admin shells

Marketing renders `<main id="main">` but no skip link; client `dashboard-shell.tsx` and
admin `console-shell.tsx` have neither the id nor a skip link. Keyboard users tab through
the entire nav on every page. Suggested: add a visually-hidden-until-focus "Skip to
content" link as the first element of each shell targeting `<main id="main">`. (Not an
axe rule violation — found by the keyboard specs.)

### F6 — 11 routes crash server-side (masked scans)

These return the Next error page; the a11y of the real page is **unknown until fixed**:

| Route                                                                                                                            | Error (from dev-server logs)                                                                                                                                 | Suspected owner          |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| client `/cards/new`, `/loans/apply`, `/savings/goals/new`, `/savings/deposits/new`, `/savings/goals/{goalId}`, `/bills/{billId}` | `accounts.filter is not a function` — pages type `GET /v1/accounts` as `AccountSummary[]` but the API now returns a cursor page `{items,…}`. Contract drift. | WEB + SDK-01/BE accounts |
| admin `/audit`                                                                                                                   | API returns 500 ("An unexpected error occurred") for the audit-events fetch                                                                                  | BE audit                 |
| admin `/system`                                                                                                                  | page calls `GET /v1/health` → 404 (endpoint does not exist; health lives outside `/v1`)                                                                      | ADM-19/OPS-02            |
| admin `/controls`                                                                                                              | API 403 "You do not have access to this area" for `ops@` (operations, admin roles) — needs a higher role                                                     | ADM-16 (by design?)      |
| admin `/loans/{loanId}`, `/loans/applications/{applicationId}`                                                                   | pages call `GET /v1/loans/admin/applications/{id}` → 404; the admin controller exposes only `queue`, `decision`, `disburse`                                  | ADM-09/BE lending        |

## Coverage gaps (routes skipped, 5–7 depending on seed state)

Skipped with a message, never failed — the entity collections are empty in the current
seed, so no id resolves:

- admin: `/aml/{alertId}`, `/approvals/{approvalId}`, `/fraud/{caseId}`,
  `/staff/{staffId}`
- client: `/cards/{cardId}`, `/support/disputes/{disputeId}` (both resolve as soon as the
  demo customer has a card / a dispute — e.g. after the QA-06 journeys run)
- admin `/accounts/{accountId}` returned 404 for a valid seeded account id — worth a
  look from ADM-08 (may be a role/endpoint mismatch, not missing data).

To close: create one entity per collection through the product UI or API (the suite's
fixture bootstrap already does this for beneficiaries, savings goals, term deposits,
bills, support tickets and loan applications — see `e2e/a11y/support/resolve.ts`), or
extend the seed. `staff_users` is empty because the seed never writes staff profiles and
staff creation requires step-up MFA.

## Reproduce

```sh
pnpm test:a11y                          # full suite (stack up: Mongo RS, API :4100, apps :3100-3102)
pnpm test:a11y -- --project=marketing   # per app
```

Suite layout and prerequisites: `e2e/a11y/README.md`.
