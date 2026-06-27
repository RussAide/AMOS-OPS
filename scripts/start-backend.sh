#!/bin/bash
# AMOS-OPS Backend Startup Script
# Usage: ./scripts/start-backend.sh [port]

set -e

PORT=${1:-3000}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "[AMOS-OPS] Starting backend server..."
echo "  Project: $PROJECT_DIR"
echo "  Port: $PORT"

# Check if boot.js exists
if [ ! -f "$PROJECT_DIR/dist/boot.js" ]; then
  echo "[ERROR] dist/boot.js not found. Run 'npm run build' first."
  exit 1
fi

# Ensure data directories exist
mkdir -p "$PROJECT_DIR/data"
mkdir -p "$PROJECT_DIR/uploads"

# Set environment
export NODE_ENV=production
export PORT=$PORT
export DATABASE_PATH="${DATABASE_PATH:-$PROJECT_DIR/data/amos-ops.db}"

# Use .env if it exists
if [ -f "$PROJECT_DIR/.env" ]; then
  echo "[AMOS-OPS] Loading .env file..."
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

echo "[AMOS-OPS] Database: $DATABASE_PATH"
echo "[AMOS-OPS] Starting server..."

# Start with node
cd "$PROJECT_DIR"
exec node dist/boot.js
