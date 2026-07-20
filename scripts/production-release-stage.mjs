#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./production-release-manifest.mjs";

const DOCKERFILE = `FROM node:24.14.0-slim
WORKDIR /app
ENV APP_ENV=demo AMOS_RUNTIME_MODE=demo AMOS_ENVIRONMENT_ID=amos-ops-demo CREDENTIAL_NAMESPACE=amos-ops/demo AMOS_RM2_STATUS=paused NODE_ENV=production PORT=3000 PERSISTENT_ROOT=/app/persistent DATABASE_PATH=/app/data/demo/amos-ops.db TRAINING_DATABASE_PATH=/app/data/demo/training/amos-ops-training.db UPLOAD_PATH=/app/uploads/demo TRAINING_UPLOAD_PATH=/app/uploads/demo/training BACKUP_PATH=/app/data/demo/backups
RUN apt-get update && apt-get install -y python3 make g++ \\
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \\
  && npm cache clean --force \\
  && apt-get purge -y python3 make g++ \\
  && apt-get autoremove -y \\
  && rm -rf /var/lib/apt/lists/*
COPY dist ./dist
COPY db ./db
COPY docs ./docs
COPY accepted-baselines ./accepted-baselines
RUN mkdir -p /app/data/demo/training /app/uploads/demo/training /app/data/demo/backups /app/data/staging/training /app/uploads/staging/training /app/data/staging/backups
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "run", "start"]
`;

const RAILWAY_CONFIG = `[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/api/health/ready"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
numReplicas = 1
`;

export function assembleStage(root, output) {
  if (path.resolve(output) === path.resolve(root)) {
    throw new Error("Release stage must not overwrite the source tree.");
  }
  const required = [
    "package.json",
    "package-lock.json",
    "dist/boot.js",
    "dist/public/index.html",
    "dist/release-manifest.json",
    "dist/public/release-manifest.json",
    "db",
    "docs",
    "accepted-baselines",
  ];
  for (const relative of required) {
    if (!existsSync(path.join(root, relative))) {
      throw new Error(`Cannot assemble release; missing ${relative}.`);
    }
  }
  const backendManifest = readFileSync(
    path.join(root, "dist/release-manifest.json"),
  );
  const frontendManifest = readFileSync(
    path.join(root, "dist/public/release-manifest.json"),
  );
  if (!backendManifest.equals(frontendManifest)) {
    throw new Error("Release manifests must be byte-identical before staging.");
  }

  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  for (const relative of [
    "package.json",
    "package-lock.json",
    "dist",
    "db",
    "docs",
    "accepted-baselines",
  ]) {
    cpSync(path.join(root, relative), path.join(output, relative), {
      recursive: true,
      dereference: false,
      errorOnExist: true,
      force: false,
    });
  }
  writeFileSync(path.join(output, "Dockerfile"), DOCKERFILE, { mode: 0o644 });
  writeFileSync(path.join(output, "railway.toml"), RAILWAY_CONFIG, {
    mode: 0o644,
  });
  return output;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.output) throw new Error("--output is required.");
  const output = assembleStage(
    path.resolve(args.root ?? process.cwd()),
    path.resolve(args.output),
  );
  process.stdout.write(`${output}\n`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main();
}
