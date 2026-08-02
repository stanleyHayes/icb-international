# ICB admin — multi-stage Next.js build.
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
COPY apps/admin/package.json              apps/admin/

RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /repo
COPY packages/ packages/
COPY brand/ brand/
COPY apps/admin/ apps/admin/

RUN pnpm --filter @icb/money build && pnpm --filter @icb/contracts build
RUN pnpm --filter @icb/admin build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3102 HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 icb && useradd --system --uid 1001 --gid icb icb

COPY --from=build --chown=icb:icb /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=icb:icb /repo/apps/admin/.next/static     ./apps/admin/.next/static
COPY --from=build --chown=icb:icb /repo/apps/admin/public           ./apps/admin/public

USER icb
EXPOSE 3102
CMD ["node", "apps/admin/server.js"]
