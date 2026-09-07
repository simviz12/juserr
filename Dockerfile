# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests
COPY package.json pnpm-lock.yaml ./

# Install dependencies, approve core-js builds, reinstall to allow scripts
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm approve-builds core-js@3.49.0 esbuild@0.18.20 esbuild@0.25.12 esbuild@0.28.1 && pnpm install --frozen-lockfile

# Copy source code
COPY . .



# Build the SvelteKit app (produces .svelte-kit and build)
RUN pnpm approve-builds core-js@3.49.0 && pnpm install --frozen-lockfile && pnpm build

# ---------- Runtime stage ----------
FROM node:20-alpine AS runner
WORKDIR /app

# Copy only the needed files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules

# Expose the server port
EXPOSE 3000
ENV NODE_ENV=production

# Run the node server
CMD ["node", "build/index.js"]
