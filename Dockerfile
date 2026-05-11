# BH Grain — Dockerfile produção
# Multi-stage para reduzir tamanho final
# OpenSSL 3 (Debian Bookworm) + Prisma 5.22 → binaryTarget linux-musl-openssl-3.0.x
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y openssl ca-certificates libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
# Força legacy-peer-deps para next-auth@5-beta
RUN npm install --legacy-peer-deps --no-audit --no-fund

FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y openssl ca-certificates libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y curl openssl ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Cria usuário não-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copia artifacts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

# Healthcheck nativo Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -sf http://localhost:3000/api/health || exit 1

CMD ["npm", "run", "start"]
