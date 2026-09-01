# syntax=docker/dockerfile:1

# ---- Base ----
FROM oven/bun:1.3.14-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- Install: dependencies only, cached on the lockfile ----
FROM base AS installer
ENV HUSKY=0
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Build: full source, compile to dist ----
FROM installer AS builder
COPY . .
RUN bun run build

# ---- Runtime: minimal image with only what's needed to run ----
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=installer --chown=nestjs:nodejs /app/node_modules ./node_modules

USER nestjs

EXPOSE 3333
ENV PORT=3333

CMD ["bun", "run", "dist/main.js"]
