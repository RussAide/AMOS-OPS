import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { initDatabase } from "./db-init";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { operationalSqlite, runWithDataScope } from "./queries/connection";
import {
  createReadinessReport,
  createRequestTraceContext,
  createStructuredLogger,
  OperationalMonitor,
} from "./observability";
import { evaluateCorsOrigin } from "./cors-policy";
import { env } from "./lib/env";
import { enforceDatabaseStartupPolicy } from "./startup-policy";
import { createPublicRuntimeConfig } from "./runtime-mode";
import { blockedProductionSyntheticProcedures } from "./lib/production-data-boundary";
import { inheritResponseHeaders } from "./response-headers";
import { createIdentityOperator, verifyOperatorRequest } from "./security/identity-operator";
import { canonicalWebLocation } from "./canonical-web";
import { loadRuntimeReleaseIdentity } from "./release-identity";
import {
  diagnoseOperationalAlerts,
  OperationalAlertReconciliationError,
  reconcileOperationalAlerts,
} from "./operational-alert-operator";
import { isReadOnlyOperatorDiagnosisRequest } from "./operator-boundary";
import {
  enforceEncryptedDirectory,
  readEncryptedFile,
  writeEncryptedFileAtomic,
} from "./security/storage-encryption";
import { assertPathConfined } from "./security/path-confinement";
import { enforceDatabaseBackupDirectory } from "./data-lifecycle";
import { isStorageEncryptionInventoryReady } from "./security/storage-readiness";

const logger = createStructuredLogger("amos-ops-api");

// ─── Initialize Database ─────────────────────────────────────
let databaseInitializationError: unknown;
try {
  initDatabase();
  runWithDataScope("training", () => initDatabase({ trainingWorkspace: true }));
  logger.info("database.initialized");
} catch (err) {
  databaseInitializationError = err;
  logger.error("database.initialization_failed", { details: { error: err } });
  enforceDatabaseStartupPolicy(env, err);
}

const app = new Hono();
const operationalMonitor = new OperationalMonitor(operationalSqlite, logger);
const UPLOAD_DIR = path.resolve(process.cwd(), env.uploadPath);
const TRAINING_UPLOAD_DIR = path.resolve(process.cwd(), env.trainingUploadPath);
const BACKUP_DIR = path.resolve(process.cwd(), env.backupPath);
const DIST_DIR = path.join(process.cwd(), "dist", "public");
const INDEX_HTML = path.join(DIST_DIR, "index.html");
const releaseIdentity = loadRuntimeReleaseIdentity();
if (env.isProduction && !releaseIdentity.verified) {
  throw new Error(
    `RELEASE_IDENTITY_UNVERIFIED: ${releaseIdentity.reason ?? "immutable release manifest is unavailable"}`,
  );
}
const runtimeReleaseEnvironment = releaseIdentity.verified
  ? {
      ...env,
      productionReleaseId: releaseIdentity.releaseId,
      buildId: releaseIdentity.releaseId,
      sourceDigest: releaseIdentity.sourceDigest,
    }
  : env;
const publicRuntimeConfig = createPublicRuntimeConfig(
  runtimeReleaseEnvironment,
  runtimeReleaseEnvironment.buildId,
);
const identityOperator = createIdentityOperator(operationalSqlite, env);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(TRAINING_UPLOAD_DIR)) {
  fs.mkdirSync(TRAINING_UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
if (env.isProduction) {
  for (const directoryPath of [
    UPLOAD_DIR,
    TRAINING_UPLOAD_DIR,
    BACKUP_DIR,
  ]) {
    assertPathConfined(env.persistentRoot, directoryPath, {
      allowMissing: false,
      type: "directory",
    });
  }
}
const storageEncryptionReports = env.isProduction
  ? [
      enforceEncryptedDirectory(
        UPLOAD_DIR,
        "upload-operational",
        process.env,
        [TRAINING_UPLOAD_DIR],
      ),
      enforceEncryptedDirectory(
        TRAINING_UPLOAD_DIR,
        "upload-training",
      ),
    ]
  : [];
const databaseBackupEncryptionReport = env.isProduction
  ? enforceDatabaseBackupDirectory(BACKUP_DIR)
  : null;
const storageEncryptionReady = isStorageEncryptionInventoryReady({
  production: env.isProduction,
  uploadReportCount: storageEncryptionReports.length,
  databaseBackupInventoryCompleted:
    databaseBackupEncryptionReport !== null,
});
logger.info("storage.paths.validated", {
  details: {
    persistentRoot: env.persistentRoot,
    databasePath: env.databasePath,
    trainingDatabasePath: env.trainingDatabasePath,
    uploadPath: env.uploadPath,
    trainingUploadPath: env.trainingUploadPath,
    backupPath: env.backupPath,
    encryptionRequired: env.storageEncryptionEnabled,
    keyProvider: env.storageKeyProvider,
    encryptionInventory: storageEncryptionReports.map((report) => ({
      purpose: report.purpose,
      inspected: report.inspected,
      encrypted: report.encrypted,
      rewrapped: report.rewrapped,
      alreadyProtected: report.alreadyProtected,
    })),
    databaseBackupInventory: databaseBackupEncryptionReport
      ? {
          inspected: databaseBackupEncryptionReport.inspected,
          rewrapped: databaseBackupEncryptionReport.rewrapped,
          outerKeyVersions:
            databaseBackupEncryptionReport.outerBackupKeyIds.length,
          innerDatabaseKeyVersions:
            databaseBackupEncryptionReport.innerDatabaseKeyIds.length,
        }
      : null,
  },
});

// ─── Request correlation, tracing, metrics, alerts, and audit ─
app.use("*", async (c, next) => {
  const trace = createRequestTraceContext(c.req.raw.headers);
  const startedAt = performance.now();
  let failed = false;
  c.header("X-Request-ID", trace.requestId);
  c.header("X-Correlation-ID", trace.correlationId);
  c.header("Traceparent", trace.traceparent);
  c.header("X-AMOS-Runtime-Mode", env.runtimeMode);

  try {
    await next();
  } catch (error) {
    failed = true;
    logger.error("http.request.unhandled", {
      correlationId: trace.correlationId,
      traceId: trace.traceId,
      details: { method: c.req.method, path: c.req.path, error },
    });
    throw error;
  } finally {
    const status = failed ? 500 : c.res.status;
    const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
    const observation = {
      method: c.req.method,
      path: c.req.path,
      status,
      durationMs,
      correlationId: trace.correlationId,
      traceId: trace.traceId,
    };
    logger.info("http.request.completed", {
      correlationId: trace.correlationId,
      traceId: trace.traceId,
      details: observation,
    });
    try {
      if (!isReadOnlyOperatorDiagnosisRequest(c.req.method, c.req.path)) {
        operationalMonitor.recordRequest(observation);
        if (
          !["GET", "HEAD", "OPTIONS"].includes(c.req.method) ||
          status >= 400
        ) {
          const { resolveIdentityUser } = await import("./security/identity");
          const identity = resolveIdentityUser(c.req.raw);
          operationalMonitor.captureAuditEvent({
            eventType: "http.request",
            action: `${c.req.method} ${c.req.path}`,
            actor: identity ? `${identity.id}:${identity.email}` : "anonymous",
            resource: c.req.path,
            outcome:
              status >= 500 ? "failure" : status >= 400 ? "denied" : "success",
            correlationId: trace.correlationId,
            traceId: trace.traceId,
            details: { status, durationMs },
          });
        }
      }
    } catch (error) {
      logger.error("observability.capture_failed", {
        correlationId: trace.correlationId,
        traceId: trace.traceId,
        details: { error },
      });
    }
  }
});

// ─── CORS ────────────────────────────────────────────────────
app.use("*", async (c, next) => {
  const decision = evaluateCorsOrigin(
    c.req.header("origin"),
    c.req.url,
    env.allowedOrigins,
  );
  if (!decision.allowed) {
    return c.json({ error: "Origin is not allowed" }, 403);
  }
  if (decision.responseOrigin) {
    c.header("Access-Control-Allow-Origin", decision.responseOrigin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Vary", "Origin");
  }
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-AMOS-Workspace, X-Request-ID, X-Correlation-ID, Traceparent",
  );
  c.header(
    "Access-Control-Expose-Headers",
    "X-Request-ID, X-Correlation-ID, Traceparent, X-AMOS-Runtime-Mode",
  );
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// ─── Client-safe runtime contract ────────────────────────────
app.get("/api/runtime-config", (c) => {
  c.header("Cache-Control", "no-store, no-cache, must-revalidate");
  c.header("Pragma", "no-cache");
  return c.json(publicRuntimeConfig);
});

app.get("/api/release-identity", (c) => {
  c.header("Cache-Control", "no-store, no-cache, must-revalidate");
  return c.json(
    releaseIdentity.verified
      ? {
          verified: true,
          schemaVersion: releaseIdentity.schemaVersion,
          releaseId: releaseIdentity.releaseId,
          commitSha: releaseIdentity.commitSha,
          treeSha: releaseIdentity.treeSha,
          sourceDigest: releaseIdentity.sourceDigest,
          frontendArtifactDigest: releaseIdentity.frontendArtifactDigest,
          backendArtifactDigest: releaseIdentity.backendArtifactDigest,
        }
      : { verified: false, reason: releaseIdentity.reason },
  );
});

async function authorizeIdentityOperator(c: Context, body: string) {
  if (!env.isProduction || body.length > 4096) return false;
  const timestamp = c.req.header("x-amos-operator-timestamp") ?? "";
  const operationId = c.req.header("x-amos-operator-operation-id") ?? "";
  const signature = c.req.header("x-amos-operator-signature") ?? "";
  return Boolean(
    operationId &&
    verifyOperatorRequest({
      secret: env.appSecret,
      timestamp,
      operationId,
      signature,
      method: c.req.method,
      path: c.req.path,
      body,
    }),
  );
}

// Diagnosis is a signed GET so the global POST audit middleware cannot turn a
// read-only inspection into a Production database mutation. The response is
// redacted by the identity operator before it reaches this boundary.
app.get("/api/operator/identity/diagnosis", async (c) => {
  const body = "";
  if (!(await authorizeIdentityOperator(c, body)))
    return c.json({ error: "Operator authorization failed" }, 401);
  c.header("Cache-Control", "no-store");
  return c.json(identityOperator.diagnose());
});

app.post("/api/operator/identity/recovery", async (c) => {
  const body = await c.req.text();
  if (!(await authorizeIdentityOperator(c, body)))
    return c.json({ error: "Operator authorization failed" }, 401);
  c.header("Cache-Control", "no-store");
  try {
    const input = JSON.parse(body) as {
      operationId?: string;
      tokenHash?: string;
      expiresAt?: string;
    };
    const headerOperationId =
      c.req.header("x-amos-operator-operation-id") ?? "";
    if (
      !input.operationId ||
      input.operationId !== headerOperationId ||
      !input.tokenHash ||
      !input.expiresAt
    )
      return c.json({ error: "Recovery request invalid" }, 400);
    return c.json(
      identityOperator.activateRecovery({
        operationId: input.operationId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      }),
    );
  } catch {
    return c.json({ error: "Recovery request invalid" }, 400);
  }
});

// ─── Health Check ────────────────────────────────────────────
// Operational-alert diagnosis is privacy-safe and SELECT-only. Reconciliation
// is a separate signed mutation that can act only on the exact diagnosed open
// set and only for records older than the caller-supplied cutoff.
app.get("/api/operator/operational-alerts/diagnosis", async (c) => {
  const body = "";
  if (!(await authorizeIdentityOperator(c, body))) {
    return c.json({ error: "Operator authorization failed" }, 401);
  }
  c.header("Cache-Control", "no-store");
  return c.json(diagnoseOperationalAlerts(operationalSqlite));
});

app.post("/api/operator/operational-alerts/reconciliation", async (c) => {
  const body = await c.req.text();
  if (!(await authorizeIdentityOperator(c, body))) {
    return c.json({ error: "Operator authorization failed" }, 401);
  }
  c.header("Cache-Control", "no-store");
  try {
    const input = JSON.parse(body) as {
      operationId?: string;
      cutoff?: string;
      diagnosisFingerprint?: string;
    };
    const headerOperationId =
      c.req.header("x-amos-operator-operation-id") ?? "";
    if (
      !input.operationId ||
      input.operationId !== headerOperationId ||
      !input.cutoff ||
      !input.diagnosisFingerprint
    ) {
      return c.json({ error: "Alert reconciliation request invalid" }, 400);
    }
    return c.json(
      reconcileOperationalAlerts(operationalSqlite, {
        cutoff: input.cutoff,
        diagnosisFingerprint: input.diagnosisFingerprint,
      }),
    );
  } catch (error) {
    if (error instanceof OperationalAlertReconciliationError) {
      return c.json(
        { error: error.message, code: error.code },
        error.code === "FINGERPRINT_MISMATCH" ? 409 : 400,
      );
    }
    return c.json({ error: "Alert reconciliation request invalid" }, 400);
  }
});

app.get("/api/health/live", (c) => {
  return c.json({
    status: "alive",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    runtimeMode: env.runtimeMode,
    buildId: publicRuntimeConfig.buildId,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.get("/api/health/ready", (c) => {
  const report = createReadinessReport(operationalSqlite, operationalMonitor, {
    environment: env.appEnvironment,
    initializationError: databaseInitializationError,
    encryption: {
      required: env.storageEncryptionEnabled,
      ready: storageEncryptionReady,
    },
  });
  return report.ready ? c.json(report, 200) : c.json(report, 503);
});

app.get("/api/health", (c) => {
  const report = createReadinessReport(operationalSqlite, operationalMonitor, {
    environment: env.appEnvironment,
    initializationError: databaseInitializationError,
    encryption: {
      required: env.storageEncryptionEnabled,
      ready: storageEncryptionReady,
    },
  });
  return report.ready ? c.json(report, 200) : c.json(report, 503);
});

app.onError((error, c) => {
  const correlationId = c.res.headers.get("x-correlation-id") ?? randomUUID();
  logger.error("http.request.failed", {
    correlationId,
    details: { method: c.req.method, path: c.req.path, error },
  });
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
        correlationId,
      },
    },
    500,
  );
});

// ─── File Upload ─────────────────────────────────────────────
app.post("/api/upload", async (c) => {
  try {
    const { authorizeHttpRequest } = await import("./authorization/http");
    const authorization = authorizeHttpRequest(c.req.raw, {
      domain: "documents",
      action: "create",
    });
    if (!authorization.allowed) {
      const body = {
        error: {
          code: authorization.code,
          message: authorization.reason,
          correlationId: c.res.headers.get("x-correlation-id") ?? undefined,
        },
      };
      return authorization.status === 401
        ? c.json(body, 401)
        : c.json(body, 403);
    }
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "No file provided" }, 400);

    const ext = path.extname(file.name) || ".bin";
    const safeName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    const uploadDir =
      authorization.user.dataScope === "training"
        ? TRAINING_UPLOAD_DIR
        : UPLOAD_DIR;
    const filePath = path.join(uploadDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      if (env.isProduction) {
        writeEncryptedFileAtomic(
          filePath,
          buffer,
          authorization.user.dataScope === "training"
            ? "upload-training"
            : "upload-operational",
          uploadDir,
        );
      } else {
        fs.writeFileSync(filePath, buffer);
      }
    } finally {
      if (env.isProduction) buffer.fill(0);
    }

    return c.json(
      {
        success: true,
        fileName: file.name,
        storedName: safeName,
        filePath: `/uploads/${safeName}`,
        fileSize: file.size,
      },
      201,
    );
  } catch (err: unknown) {
    const correlationId = c.res.headers.get("x-correlation-id") ?? randomUUID();
    logger.error("upload.failed", { correlationId, details: { error: err } });
    return c.json({ error: "Upload failed", correlationId }, 500);
  }
});

// ─── File Download ───────────────────────────────────────────
app.get("/uploads/:filename", async (c) => {
  const { authorizeHttpRequest } = await import("./authorization/http");
  const authorization = authorizeHttpRequest(c.req.raw, {
    domain: "documents",
    action: "read",
  });
  if (!authorization.allowed) {
    const body = {
      error: {
        code: authorization.code,
        message: authorization.reason,
        correlationId: c.res.headers.get("x-correlation-id") ?? undefined,
      },
    };
    return authorization.status === 401 ? c.json(body, 401) : c.json(body, 403);
  }
  const filename = c.req.param("filename");
  const safeFilename = path.basename(filename);
  const uploadDir =
    authorization.user.dataScope === "training"
      ? TRAINING_UPLOAD_DIR
      : UPLOAD_DIR;
  const filePath = path.join(uploadDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return c.json({ error: "File not found" }, 404);
  }

  const fileBuffer = env.isProduction
    ? readEncryptedFile(
        filePath,
        authorization.user.dataScope === "training"
          ? "upload-training"
          : "upload-operational",
        uploadDir,
      )
    : fs.readFileSync(filePath);
  const ext = path.extname(safeFilename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
  };
  c.header("Content-Type", mimeTypes[ext] || "application/octet-stream");
  return c.body(new Uint8Array(fileBuffer));
});

// ─── tRPC API (lazy load to avoid env.ts at startup) ─────────
app.use("/api/trpc/*", async (c) => {
  const blockedSyntheticProcedures = blockedProductionSyntheticProcedures(
    c.req.path,
    env.isProduction,
  );
  if (blockedSyntheticProcedures.length > 0) {
    logger.warn("production.synthetic_only_route_blocked", {
      details: { procedures: blockedSyntheticProcedures },
    });
    return c.json(
      {
        error: "Authoritative Production data is unavailable for this module.",
        code: "PRODUCTION_DATA_UNAVAILABLE",
      },
      503,
    );
  }
  try {
    const { fetchRequestHandler } = await import("@trpc/server/adapters/fetch");
    const { appRouter } = await import("./router");
    const { createContext } = await import("./context");
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext,
    });
    return inheritResponseHeaders(response, c.res.headers);
  } catch (err: unknown) {
    const correlationId = c.res.headers.get("x-correlation-id") ?? randomUUID();
    logger.error("trpc.adapter_failed", {
      correlationId,
      details: { error: err },
    });
    return c.json(
      {
        error: "API temporarily unavailable",
        correlationId,
      },
      503,
    );
  }
});

// ─── API 404 Boundary ────────────────────────────────────────
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

// ─── Canonical Web Surface ───────────────────────────────────
// Netlify is the sole Production web surface. Railway remains the durable API
// and redirects browser/deep-link traffic to the canonical site, preventing a
// second embedded frontend artifact from drifting or rendering blank.
if (env.isProduction) {
  app.get("*", (c) => c.redirect(canonicalWebLocation(c.req.url), 308));
} else if (fs.existsSync(DIST_DIR)) {
  app.use("/*", serveStatic({ root: DIST_DIR }));
  app.get("*", (c) => {
    try {
      const html = fs.readFileSync(INDEX_HTML, "utf-8");
      return c.html(html);
    } catch {
      return c.json({ error: "Frontend build not found" }, 500);
    }
  });
} else {
  logger.warn("frontend.build_missing", { details: { directory: DIST_DIR } });
  app.get("/", (c) => c.json({ message: "AMOS-OPS API Server", status: "ok" }));
}

// ─── Start Server ────────────────────────────────────────────
const port = env.port;
serve({ fetch: app.fetch, port }, () => {
  logger.info("server.started", {
    details: {
      port,
      runtimeMode: env.runtimeMode,
      buildId: publicRuntimeConfig.buildId,
      health: `http://localhost:${port}/api/health`,
    },
  });
});

export default app;
