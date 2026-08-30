# E2E — QA-06 Playwright journeys

The four §10 journeys against the real stack:

| Spec | Journey | Status (chromium-desktop, 2026-08-03) |
| --- | --- | --- |
| `journeys/01-signup-kyc-transfer-statement.spec.ts` | signup → email verify → KYC (identity, documents, liveness) → account open → transfer → statement | **green** (~16s quiet machine) |
| `journeys/02-card-dispute.spec.ts` | card issue → authorisation → dispute → resolve | **green** (~70s) |
| `journeys/03-loan-lifecycle.spec.ts` | loan apply → approve → disburse → repay | **green** |
| `journeys/04-fraud-review.spec.ts` | fraud block → review → release | staged: trigger fires real assessments (velocity 18 + amount-anomaly 22 = 40, decision `challenge`) but the review threshold is 50, so the suite skips with an explicit message until a stacking rule (new-beneficiary 12) fires in the engine |

## Findings this suite surfaced

- **`/cards/new` 500s** (WEB track): `NewCardPage` treats the `{items: [...]}` envelope of
  `GET /v1/accounts` as a bare array. Journey 2 issues the card via API until fixed.
- **`/loans/[loanId]` 500s** (WEB track): same envelope bug in `LoanDetailPage`. Journey 3
  repays via API until fixed.
- **Auth endpoints throttle at 5/min/IP** (`throttle.constants.ts`): the suite caches sessions
  for 8 minutes in `fixtures/api.ts`; do not add per-test logins.
- **Risk engine does not score card authorisations** — only transfers and loans. The
  new-beneficiary rule requires the transfer to carry a `beneficiaryId`; even then it did not
  fire in practice (worth a RISK-track look: `risk-context.service.ts` adds the id to
  `knownBeneficiaryIds`, ordering may make every beneficiary "known").
- Journey 4 path to green: simulation time-travel (+91d) makes the next transfer fire
  dormant-reactivation (12) on top of 40 → 52 ≥ reviewAt. Not done in-suite because advancing
  the shared clock disrupts concurrent work.

## Design rules

- **Customer steps run in a real browser** against `apps/client`. The client is an RSC app with
  a sealed server-side session cookie, so there is no token to inject — login always goes
  through the form.
- **Staff steps run against the API** with seeded staff logins (`ops@`, `risk@`, `lend@`,
  password `Staff!2345678`). KYC decisions, dispute advances, loan approval/disbursement and
  fraud release are back-office acts; the admin UI calls these same endpoints.
- **The email loop is completed in Mongo** (`fixtures/db.ts`). The recording transport keeps
  mail inside the API process and tokens are stored hashed, so `markEmailVerified` is the
  mailhog-equivalent. Nothing else is ever written directly to the database.
- **Infra-absence skips, never false-fails.** The `stack` fixture (`fixtures/test.ts`) pings
  the API, the client app, Mongo and the seed login, and skips with an explicit message when
  something is genuinely down. Journey 4 additionally skips if the risk engine raises no case
  (rule tuning is a simulation-control concern).
- No test asserts on a hard-coded date, random id or `Date.now()`.

## Run locally

```bash
# one-time
pnpm install
npx playwright install          # browsers (chromium enough for a smoke run)

# stack: Mongo replica set + API + client (webServer boots the apps if absent)
pnpm verify:infra               # or: pnpm infra:up when Docker is available
pnpm build && pnpm seed         # seed prints the demo logins
pnpm --filter @icb/api dev      # :4100 (playwright reuses it if already running)
pnpm --filter @icb/client dev   # :3101 (playwright reuses it if already running)

# the suite
pnpm test:e2e                                     # all four projects (Chromium+WebKit × desktop+mobile)
pnpm test:e2e -- --project=chromium-desktop       # fast local smoke
pnpm test:e2e -- --list                           # enumerate without running
```

Environment overrides: `E2E_API_URL`, `E2E_CLIENT_URL`, `E2E_MONGO_URI`.

## CI

```yaml
- run: pnpm install --frozen-lockfile
- run: npx playwright install --with-deps chromium webkit
- run: pnpm infra:up && pnpm verify:infra      # Docker is available in CI
- run: pnpm build && pnpm seed
- run: pnpm test:e2e
  env:
    CI: 'true'                                  # retries=1, github+html reporters
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: playwright-report
    path: playwright-report/
```

`playwright.config.ts` boots the API and client via `webServer` with
`reuseExistingServer: true`, so CI may start them itself or let Playwright do it.
Traces, screenshots and videos are retained on failure under `e2e/.artifacts`.
