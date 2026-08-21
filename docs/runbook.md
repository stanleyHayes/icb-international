# ICB Runbook

Day-to-day operations: bootstrap, seed, reset, business-date control, end-of-day,
scenarios, backups, migrations, containers, and the failures you will actually meet.
The canonical environment contract lives in `agent_plan.md` §13; this document is the
how-to.

> Every procedure here acts on local data through the same routes the console uses. The
> destructive ones — reset, restore, migration rollback — are called out where they appear.

## Bootstrap

Prerequisites: Node 22+, pnpm 10+, Docker (for MongoDB).

```bash
pnpm install
cp .env.example .env          # then generate real secrets — see .env comments
docker compose up -d          # Mongo replica set (+ one-shot RS init)
pnpm verify:infra             # asserts multi-document transactions work
pnpm --filter @icb/api build  # seed/reset/verify:ledger run the compiled CLIs
pnpm seed                     # 18 months of bank history; prints demo logins
pnpm dev                      # api :4100 · marketing :3100 · client :3101 · admin :3102
```

`tools/scripts/dev-up.sh` chains the infra steps and `pnpm dev` for you;
`--infra-only` stops before the dev servers.

## Command table

| Command                                | What it does                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `tools/scripts/dev-up.sh`              | Start infra (Mongo replica set), verify transactions, run `pnpm dev`. `--infra-only` skips the dev servers.         |
| `tools/scripts/dev-down.sh`            | Stop the Docker services (data volumes are kept).                                                                   |
| `tools/scripts/dev-reset.sh`           | **Destructive.** Drop volumes, recreate the replica set, verify, reseed.                                            |
| `docker compose up -d`                 | Start MongoDB (single-node replica set).                                                                            |
| `pnpm verify:infra`                    | Assert `session.startTransaction()` works against the replica set.                                                  |
| `pnpm seed`                            | Seed a whole bank with 18 months of history; prints demo logins.                                                    |
| `pnpm dev`                             | Run everything — api :4100 · marketing :3100 · client :3101 · admin :3102.                                          |
| `pnpm verify:ledger`                   | Assert the six ledger invariants (agent_plan.md §4.4).                                                              |
| `pnpm db:reset`                        | Drop + reseed the database.                                                                                         |
| `tools/scripts/backup.sh`              | Verified, timestamped MongoDB archive into `backups/`. See [Backups](#backups).                                     |
| `tools/scripts/restore.sh`             | Restore an archive, then verify collection counts.                                                                  |
| `node tools/scripts/migrate.mjs up`    | Apply pending database migrations. See [Migrations](#migrations).                                                   |
| `docker compose --profile tools up -d` | Also start mongo-express on :8181.                                                                                  |

The `pnpm sim:advance` / `pnpm sim:eod` / `pnpm sim:scenario` shorthands shown in
`agent_plan.md` §13 are not wired into `package.json` yet; the HTTP routes below are the
real interface (the console's Bank controls room wraps the same routes).

## Seed and reset

- `pnpm seed` builds a full bank: customers across every KYC state, accounts, cards,
  loans, 18 months of ledger history. It prints the demo logins (email + password + role)
  — keep that output, the staff login is how you drive time travel from curl.
- `pnpm db:reset` drops the database and reseeds from scratch. Cheap and total; prefer it
  over hand-cleaning collections.
- `tools/scripts/dev-reset.sh` goes one level deeper: it also recreates the Docker
  volumes. Use it when the replica set itself is in a weird state.

## Time travel

The business date is API-controlled. All routes below require a staff token with the
`super_admin` role (the seed prints one).

```bash
# 1. Get a token (use a super_admin login from `pnpm seed` output)
TOKEN=$(curl -s localhost:4100/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"<super-admin-email>","password":"<password>"}' | jq -r .accessToken)

# 2. Inspect the clock
curl -s localhost:4100/v1/simulation/clock -H "authorization: Bearer $TOKEN"

# 3. Advance 30 days — runs end-of-day for each business day crossed by default
curl -s -X POST localhost:4100/v1/simulation/clock/advance \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"duration":"P30D"}'

#    Jump to an exact instant instead (mutually exclusive with duration):
#    -d '{"to":"2026-06-01T00:00:00Z"}'
#    Skip the per-day EOD runs with {"duration":"P30D","runEndOfDay":false}.

# 4. Freeze / resume wall-clock progression, or return to real time
curl -s -X POST localhost:4100/v1/simulation/clock/set \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"frozen":true}'
curl -s -X POST localhost:4100/v1/simulation/clock/reset -H "authorization: Bearer $TOKEN"
```

Durations are ISO 8601 (`P30D`, `PT6H`). Advancing is how interest accrues, statements
generate, and rails settle — nothing in the system listens to the wall clock.

## End of day

```bash
curl -s -X POST localhost:4100/v1/simulation/eod -H "authorization: Bearer $TOKEN"
curl -s localhost:4100/v1/simulation/eod -H "authorization: Bearer $TOKEN"   # history
```

EOD posts interest and fees, generates statements, settles due rail transfers, and ends
with a ledger integrity check. That check is also readable on its own by `operations`,
`admin`, and `super_admin`:

```bash
curl -s localhost:4100/v1/simulation/ledger-integrity -H "authorization: Bearer $TOKEN"
```

A non-zero drift figure is a stop-the-line bug — see the ledger invariants in
`agent_plan.md` §4.4.

## Scenarios

Named, seeded event scripts. A run is synchronous: the response is the finished run.

```bash
curl -s localhost:4100/v1/simulation/scenarios -H "authorization: Bearer $TOKEN"  # catalogue
curl -s -X POST localhost:4100/v1/simulation/scenarios/run \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"payday","intensity":"normal"}'
```

Catalogue: `payday`, `month_end`, `fraud_burst`, `dispute_wave`, `market_volatility`,
`rail_outage`, `high_load`, `dormant_reactivation`. Pass the same `seed` to reproduce a
run exactly; `intensity` is `light` | `normal` | `heavy`.

## Backups

```bash
tools/scripts/backup.sh                 # -> backups/icb-icb-<UTC timestamp>.archive.gz + manifest
tools/scripts/restore.sh --drop         # restore the newest archive over the current db
tools/scripts/restore.sh backups/icb-icb-20260803T120000Z.archive.gz --drop --yes
```

- `backup.sh` dumps via `docker compose exec mongo mongodump` (no host tools or port
  mapping needed), falling back to a host `mongodump` against `MONGO_URI`. Every archive
  is verified readable with `mongorestore --dryRun` before it is kept; a dump that fails
  partway leaves nothing behind.
- The `.manifest.txt` beside each archive records per-collection document counts.
  `restore.sh` re-counts after restoring and fails if the numbers disagree (exact match
  with `--drop`, at-least without).
- Without `--drop`, restore merges and duplicate `_id`s fail loudly rather than
  overwriting. With `--drop` it is destructive — that is usually what you want when
  resetting a demo to a known archive.
- Both scripts exit non-zero with guidance when neither Docker nor host tools can reach
  MongoDB; they never pretend a partial operation succeeded.

## Migrations

Versioned, recorded migrations in `tools/scripts/migrations/`:

```bash
node tools/scripts/migrate.mjs status          # applied vs pending
node tools/scripts/migrate.mjs up              # apply all pending, in order
node tools/scripts/migrate.mjs down 2          # roll back the last two
node tools/scripts/migrate.mjs create add-kyc-reason   # scaffold a new one
```

- A migration exports `up(db)` and `down(db)`; applied names and a checksum live in the
  `_migrations` collection. Editing a migration after it has been applied fails the next
  `up` with a checksum error — write a new migration instead.
- Connection is `MONGO_URI` (environment, else `.env`). Run it before deploys or from
  release automation; auto-run at API boot is deliberately not wired — that hook belongs
  to the API bootstrap owner (BE-01).
- `0001-customers-schema-version` ships as a working example (backfills a field, no
  money touched).

## Full-stack containers

`docker-compose.prod.yml` runs the whole system — api + marketing + client + admin +
Mongo replica set — from the Dockerfiles in `apps/*/Dockerfile`:

```bash
export JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... FIELD_ENCRYPTION_KEY=... COOKIE_SECRET=...
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Secrets have no defaults and compose refuses to start without them. Public URLs baked
into the web bundles default to localhost (`PUBLIC_API_URL` etc. override at build).
Seed the containerised database with `tools/scripts/backup.sh`-style exec access or by
running the seed CLI against its mapped Mongo port.

## Render backend blueprint

`render.yaml` provisions:

- `icb-api` (Node web service, Nest API)

Deploy checklist:

1. In Render, create a **Blueprint** service from this repository (`render.yaml` at root).
2. Set all `sync: false` secrets in the dashboard (Mongo URI, JWT secrets, cookie/encryption keys,
   optional email/media keys, and initial admin credentials).
3. Keep `ICB_SIMULATION_ACKNOWLEDGED=true` for production boots (required by config guard).
4. Ensure `MONGO_URI` points to a Mongo replica set.
5. After first deploy, probe:
   - `/health`
   - `/health/ready`
   - `/v1/system/health`

## Vercel frontend deployment

Use three separate Vercel projects with these root directories:

- `apps/marketing`
- `apps/client`
- `apps/admin`

Each app now includes its own `vercel.json` with monorepo-aware install/build commands.

Required env keys:

- All frontend projects:
  - `NEXT_PUBLIC_API_URL` (e.g. `https://api.example.com/v1`)
  - `NEXT_PUBLIC_MARKETING_URL`
  - `NEXT_PUBLIC_CLIENT_URL`
  - `NEXT_PUBLIC_ADMIN_URL`
- `apps/client` and `apps/admin` only:
  - `SESSION_SECRET`

Notes:

- Build output depends on `@icb/contracts` and generated SDK types; the app-level `vercel.json`
  runs those prerequisites before each Next build.
- API CORS must include the three deployed frontend origins.
- `apps/api/vercel.json` and `apps/api/src/vercel.ts` remain available if you ever choose
  serverless API hosting, but the primary deployment path here is Render for backend + Vercel for web.

## Post-deploy SEO QA checklist

After the marketing site is live, verify the basics before you announce anything:

1. **Indexability**
   - Confirm `robots.txt` serves the production rules and the site is not blocked.
   - Confirm `sitemap.xml` resolves and includes the canonical marketing routes plus the product/newsroom pages.
   - In Search Console, submit the sitemap and check that the home page and core landing pages are eligible for indexing.

2. **Metadata and canonical tags**
   - Open a few key pages (home, `/open-account`, `/rates`, `/newsroom`, a product page) and verify each has a unique `<title>`, meta description, and canonical link.
   - Confirm `og:title`, `og:description`, `og:image` and `twitter:card` render for the shared pages.

3. **Structured data**
   - Validate the home page and product pages in Google’s Rich Results Test.
   - Check that the Organization schema and the product/article JSON-LD blocks are present in the page source.
   - For newsroom articles, verify the `NewsArticle` schema appears with a published date.

4. **Social preview checks**
   - Validate the social card in Facebook Sharing Debugger and the X Card Validator.
   - Verify the default OG image appears instead of a blank preview.

5. **Navigation and content sanity**
   - Check the main nav, footer links, and key conversion paths (`/open-account`, `/rates`, `/contact`).
   - Verify that important pages return a 200 and not a redirect loop.

A quick local smoke test before deploy:

```bash
curl -I https://<marketing-domain>/robots.txt
curl -I https://<marketing-domain>/sitemap.xml
curl -s https://<marketing-domain>/ | grep -iE '<title>|canonical|og:|twitter:'
```

## Common failures

**`pnpm verify:infra` fails: "Transaction numbers are only allowed on a replica set
member"** — Mongo is up but the replica set was never initiated (fresh volume, or the
`mongo-init` one-shot didn't run). Fix:

```bash
docker compose up -d mongo-init   # idempotent; safe to re-run
# or by hand:
docker compose exec mongo mongosh --quiet --eval \
  'rs.initiate({ _id: "icb-rs", members: [{ _id: 0, host: "localhost:27017" }] })'
```

If `rs.status()` shows the member but clients still fail, the advertised host is wrong
for how you connect — keep `directConnection=true` in `MONGO_URI` (the default in
`.env.example`), or re-initiate with the hostname your clients actually use.

**Port conflicts** — this machine runs several projects' containers. Every published
port is overridable via `.env`: `MONGO_PORT` (27217), `MONGO_EXPRESS_PORT` (8181),
`API_PORT` (4100). `docker compose ps` shows what compose thinks it owns; `lsof -i :<port>`
shows what actually has the port.

**Stale `.next` lock** — a dev server dies uncleanly and the next `pnpm dev` reports it
cannot acquire the build lock. Fix: `rm -f apps/<app>/.next/dev/lock`; if in doubt,
`rm -rf apps/<app>/.next` (it is rebuilt).

**Docker daemon unavailable** — `dev-up.sh`, `verify:infra`, and the backup/restore
scripts detect it and exit with a message instead of false-failing. Nothing in the repo
requires Docker except Mongo itself.

**API 401s everywhere after a reseed** — `db:reset` rotates nothing, but it does
recreate users; old tokens still reference deleted refresh families and are rejected.
Log in again with the freshly printed demo credentials.

**`pnpm --filter @icb/api seed` fails: "Cannot find module dist/..."** — the seed CLIs
run compiled output. Build first: `pnpm --filter @icb/api build`.

## Environments

| Env     | Description                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `local` | Docker compose, seeded, clock controllable, all rails instant-by-default. Resend and Cloudinary fall back to recording fakes when keys are absent. |
| `demo`  | Deployed, seeded nightly, realistic rail latency, chaos off.                                                                                       |
| `test`  | Ephemeral Mongo per run, clock frozen at `2026-01-01T00:00:00Z`.                                                                                   |
