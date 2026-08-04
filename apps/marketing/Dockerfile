# ICB marketing — multi-stage Next.js build.
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
COPY apps/marketing/package.json              apps/marketing/

RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /repo
COPY packages/ packages/
COPY brand/ brand/
COPY apps/marketing/ apps/marketing/

# NEXT_PUBLIC_* values are inlined into the bundle at build time, so they arrive as build
# args — never via a .env file, which .dockerignore keeps out of the context on purpose.
ARG NEXT_PUBLIC_API_URL=http://localhost:4100/v1
ARG NEXT_PUBLIC_MARKETING_URL=http://localhost:3100
ARG NEXT_PUBLIC_CLIENT_URL=http://localhost:3101
ARG NEXT_PUBLIC_ADMIN_URL=http://localhost:3102
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_MARKETING_URL=$NEXT_PUBLIC_MARKETING_URL \
    NEXT_PUBLIC_CLIENT_URL=$NEXT_PUBLIC_CLIENT_URL \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL

RUN pnpm --filter @icb/money build && pnpm --filter @icb/contracts build
RUN pnpm --filter @icb/marketing build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3100 HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 icb && useradd --system --uid 1001 --gid icb icb

COPY --from=build --chown=icb:icb /repo/apps/marketing/.next/standalone ./
COPY --from=build --chown=icb:icb /repo/apps/marketing/.next/static     ./apps/marketing/.next/static
COPY --from=build --chown=icb:icb /repo/apps/marketing/public           ./apps/marketing/public

USER icb
EXPOSE 3100

# Liveness: any non-5xx response means the standalone server is up.
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3100)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/marketing/server.js"]
