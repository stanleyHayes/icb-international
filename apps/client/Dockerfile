# ICB client — multi-stage Next.js build.
#
# Uses Next's standalone output so the runtime image carries only the server and the exact
# modules it traced, rather than the whole node_modules tree. Runs as a non-root user.

FROM node:22-bookworm-slim AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/config-ts/package.json     packages/config-ts/
COPY packages/config-eslint/package.json packages/config-eslint/
COPY packages/config-tailwind/package.json packages/config-tailwind/
COPY packages/money/package.json         packages/money/
COPY packages/contracts/package.json     packages/contracts/
COPY packages/ui/package.json            packages/ui/
COPY apps/client/package.json              apps/client/

RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /repo
COPY packages/ packages/
COPY brand/ brand/
COPY apps/client/ apps/client/

RUN pnpm --filter @icb/money build && pnpm --filter @icb/contracts build
RUN pnpm --filter @icb/client build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3101 HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 icb && useradd --system --uid 1001 --gid icb icb

COPY --from=build --chown=icb:icb /repo/apps/client/.next/standalone ./
COPY --from=build --chown=icb:icb /repo/apps/client/.next/static     ./apps/client/.next/static
COPY --from=build --chown=icb:icb /repo/apps/client/public           ./apps/client/public

USER icb
EXPOSE 3101
CMD ["node", "apps/client/server.js"]
