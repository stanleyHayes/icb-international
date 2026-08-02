# ICB Runbook

> **Stub** — bootstrap and day-to-day commands only. OPS-03 expands this with seed details,
> time travel, and common-failure playbooks. The canonical environment contract lives in
> `agent_plan.md` §13.

## Bootstrap

Prerequisites: Node 22+, pnpm 10+, Docker.

```bash
pnpm install
cp .env.example .env
```

## Command table

| Command                                | What it does                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `tools/scripts/dev-up.sh`              | Start infra (Mongo replica set + Redis), verify transactions, run `pnpm dev`. `--infra-only` skips the dev servers. |
| `tools/scripts/dev-down.sh`            | Stop the Docker services (data volumes are kept).                                                                   |
| `tools/scripts/dev-reset.sh`           | **Destructive.** Drop volumes, recreate the replica set, verify, reseed.                                            |
| `docker compose up -d`                 | Start MongoDB (single-node replica set) + Redis.                                                                    |
| `pnpm verify:infra`                    | Assert `session.startTransaction()` works against the replica set.                                                  |
| `pnpm seed`                            | Seed a whole bank with 18 months of history; prints demo logins.                                                    |
| `pnpm dev`                             | Run everything — api :4000 · marketing :3000 · client :3001 · admin :3002.                                          |
| `pnpm verify:ledger`                   | Assert the six ledger invariants (agent_plan.md §4.4).                                                              |
| `pnpm sim:advance -- 30d`              | Time travel.                                                                                                        |
| `pnpm sim:eod`                         | Run end-of-day now.                                                                                                 |
| `pnpm sim:scenario payday`             | Run a named scenario.                                                                                               |
| `pnpm db:reset`                        | Drop + reseed the database.                                                                                         |
| `docker compose --profile tools up -d` | Also start mongo-express on :8081.                                                                                  |

## Environments

| Env     | Description                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `local` | Docker compose, seeded, clock controllable, all rails instant-by-default. Resend and Cloudinary fall back to recording fakes when keys are absent. |
| `demo`  | Deployed, seeded nightly, realistic rail latency, chaos off.                                                                                       |
| `test`  | Ephemeral Mongo per run, clock frozen at `2026-01-01T00:00:00Z`.                                                                                   |
