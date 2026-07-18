FROM node:22-alpine AS builder

WORKDIR /app

# Instalar pnpm globalmente
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

# Instalar dependencias
RUN pnpm config set ignore-scripts true && pnpm install

# Copiar el resto del código
COPY . .

# Construir la app para Node.js
RUN pnpm build

# Etapa de producción
FROM node:22-alpine

WORKDIR /app

# Solo copiamos el build final, package.json y pnpm-lock.yaml
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Instalar solo dependencias de producción
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm config set ignore-scripts true && pnpm install --prod

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Arrancar el servidor Node nativo
CMD ["node", "build/index.js"]
