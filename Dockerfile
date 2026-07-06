# AMOS-OPS Production Dockerfile
# Railway-compatible — builds both frontend and backend
# Uses node:20-slim (Debian) for better-sqlite3 compatibility

FROM node:20-slim AS builder

WORKDIR /app

# Install build tools for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Build frontend + backend
RUN npm run build

# Production image
FROM node:20-slim AS production

WORKDIR /app

# Set production environment (REQUIRED for server to start)
ENV NODE_ENV=production
ENV PORT=3000

# Copy built node_modules from builder (already compiled)
COPY --from=builder /app/node_modules ./node_modules

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
COPY --from=builder /app/docs ./docs

# Copy runtime files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/.env* ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" || exit 1

# Start server (backend bundle is at dist/boot.js)
CMD ["node", "dist/boot.js"]
