# AMOS-OPS single-build container
# The immutable artifact selects Demo or Production only at process startup.

FROM node:24-slim AS builder

ARG RAILWAY_GIT_COMMIT_SHA

WORKDIR /app

# Install build tools for native modules and Git for immutable source identity.
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

# Install the exact dependency graph recorded in package-lock.json.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build frontend and backend, then seal the exact GitHub-triggered source and
# both artifacts into the manifest required by the Production boot boundary.
RUN test -n "$RAILWAY_GIT_COMMIT_SHA" \
  && npm run build \
  && node scripts/production-release-manifest.mjs \
    --release-id "RAILWAY-GITHUB-${RAILWAY_GIT_COMMIT_SHA}" \
    --release-sha "$RAILWAY_GIT_COMMIT_SHA"

FROM node:24-slim AS production

WORKDIR /app

# Safe default: the image starts against isolated synthetic resources. A host
# may select Production with runtime variables, but startup remains locked
# until the production release authorization variables are also present.
ENV APP_ENV=demo
ENV AMOS_RUNTIME_MODE=demo
ENV AMOS_ENVIRONMENT_ID=amos-ops-demo
ENV CREDENTIAL_NAMESPACE=amos-ops/demo
ENV NODE_ENV=production
ENV PORT=3000
ENV PERSISTENT_ROOT=/app/persistent
ENV DATABASE_PATH=/app/data/demo/amos-ops.db
ENV TRAINING_DATABASE_PATH=/app/data/demo/training/amos-ops-training.db
ENV UPLOAD_PATH=/app/uploads/demo
ENV TRAINING_UPLOAD_PATH=/app/uploads/demo/training
ENV BACKUP_PATH=/app/data/demo/backups

# Install runtime dependencies only. Runtime secrets are injected by the host.
RUN apt-get update && apt-get install -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force \
  && apt-get purge -y python3 make g++ \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/accepted-baselines ./accepted-baselines

# Demo and isolated-review defaults remain outside the Production persistent
# root. Railway must mount the Production volume at /app/persistent; Production
# startup validation rejects paths that are not strict descendants of that root.
RUN mkdir -p /app/data/demo/training /app/uploads/demo/training \
  /app/data/demo/backups \
  /app/data/staging/training /app/uploads/staging/training \
  /app/data/staging/backups

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "start"]
