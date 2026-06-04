# ── Stage 1: deps ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: production image ────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -S famsops && adduser -S famsops -G famsops

COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh && chown -R famsops:famsops /app
USER famsops

EXPOSE 4000

HEALTHCHECK --interval=20s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://localhost:4000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
