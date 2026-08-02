# ICB API — multi-stage build.
#
# The runtime stage carries production dependencies and compiled output only: no source, no
# toolchain, no package manager. It runs as a non-root user because a banking API that can write
# to its own filesystem as root is one file-write bug away from being someone else's.

# ---- Stage 1: install every dependency, including dev ------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/config-ts/package.json     packages/config-ts/
COPY packages/config-eslint/package.json packages/config-eslint/
COPY packages/money/package.json         packages/money/
COPY packages/contracts/package.json     packages/contracts/
COPY packages/media/package.json         packages/media/
COPY apps/api/package.json               apps/api/

RUN pnpm install --frozen-lockfile

# ---- Stage 2: build the workspace packages, then the API ---------------------------------
FROM deps AS build
WORKDIR /repo

COPY packages/ packages/
COPY apps/api/ apps/api/

RUN pnpm --filter @icb/money build \
 && pnpm --filter @icb/contracts build \
 && pnpm --filter @icb/media build \
 && pnpm --filter @icb/api build

# Drop dev dependencies so only what the runtime needs is copied forward.
RUN pnpm install --frozen-lockfile --prod

# ---- Stage 3: runtime ---------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    API_PORT=4100 \
    API_HOST=0.0.0.0

RUN groupadd --system --gid 1001 icb \
 && useradd --system --uid 1001 --gid icb icb

COPY --from=build --chown=icb:icb /repo/node_modules              ./node_modules
COPY --from=build --chown=icb:icb /repo/packages                  ./packages
COPY --from=build --chown=icb:icb /repo/apps/api/node_modules     ./apps/api/node_modules
COPY --from=build --chown=icb:icb /repo/apps/api/dist             ./apps/api/dist
COPY --from=build --chown=icb:icb /repo/apps/api/package.json     ./apps/api/

USER icb
EXPOSE 4100

# Liveness only — readiness touches the database and is checked by the orchestrator separately.
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4100)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
