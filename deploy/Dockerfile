# syntax=docker/dockerfile:1.7
# One Dockerfile, two images built from the same compiled workspace:
#   docker build -f deploy/Dockerfile --target api -t hearth/api .
#   docker build -f deploy/Dockerfile --target web -t hearth/web .

FROM node:22-alpine AS base
LABEL app=hearth
RUN apk add --no-cache openssl libc6-compat \
 && npm install -g pnpm@10.28.0
ENV CI=true
WORKDIR /app

# ---------------------------------------------------------------- dependencies (cached on manifests)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=hearth-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------- compile every package
FROM deps AS build
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN pnpm turbo run build --filter=@hearth/api... --filter=@hearth/web...

# ---------------------------------------------------------------- API (also runs migrations and the seed)
FROM build AS api
ENV NODE_ENV=production \
    NODE_OPTIONS= \
    API_PORT=3000
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --start-interval=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health >/dev/null || exit 1
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------- web (static SPA served by Caddy)
FROM caddy:2-alpine AS web
LABEL app=hearth
COPY deploy/web.Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
EXPOSE 80
