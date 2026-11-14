# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:22-alpine AS builder
WORKDIR /app

# pnpm fijado (misma versión que "packageManager" en package.json): builds reproducibles.
RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build && pnpm prune --prod

# ---------- Runtime stage ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Solo dependencias de producción y el build; se ejecuta sin privilegios de root.
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/migrations ./migrations
COPY --from=builder --chown=node:node /app/scripts/migrate.mjs ./scripts/migrate.mjs
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1

CMD ["node", "build/index.js"]
