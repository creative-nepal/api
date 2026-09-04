# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14-alpine AS bun-base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM bun-base AS deps
ENV HUSKY=0
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM bun-base AS prod-deps
ENV HUSKY=0
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM deps AS builder
COPY . .
RUN bun run build

FROM builder AS tooling
CMD ["bunx", "drizzle-kit", "migrate"]

FROM node:24-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3333

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules

USER nestjs

EXPOSE 3333

HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=6 \
  CMD curl -fsS http://127.0.0.1:3333/api/health || exit 1

CMD ["node", "dist/main"]
