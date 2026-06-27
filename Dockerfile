# AMOS-OPS Production Dockerfile
# Railway deployment: tRPC + Hono + SQLite backend with static frontend

FROM node:20-slim AS builder

WORKDIR /app

# Upgrade npm to fix "Exit handler never called!" bug in npm 10.8.2
RUN npm install -g npm@10.9.2

# Install all dependencies (including devDependencies for build)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ─── Production Stage ──────────────────────────────────────

FROM node:20-slim

WORKDIR /app

# Upgrade npm to fix "Exit handler never called!" bug in npm 10.8.2
RUN npm install -g npm@10.9.2

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db

# Create data directories with proper permissions
RUN mkdir -p uploads data && chmod 777 uploads data

# Environment variables (override via Railway dashboard)
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/amos-ops.db
ENV JWT_SECRET=amos-ops-change-me-in-production

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/trpc/ping').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/boot.js"]
