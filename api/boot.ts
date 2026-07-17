import { Hono } from "hono";
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
const publicRuntimeConfig = createPublicRuntimeConfig(env);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(TRAINING_UPLOAD_DIR)) {
  fs.mkdirSync(TRAINING_UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
logger.info("storage.paths.validated", {
  details: {
    persistentRoot: env.persistentRoot,
    databasePath: env.databasePath,
    trainingDatabasePath: env.trainingDatabasePath,
    uploadPath: env.uploadPath,
    trainingUploadPath: env.trainingUploadPath,
    backupPath: env.backupPath,
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
      operationalMonitor.recordRequest(observation);
      if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) || status >= 400) {
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

// ─── Health Check ────────────────────────────────────────────
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
  });
  return report.ready ? c.json(report, 200) : c.json(report, 503);
});

app.get("/api/health", (c) => {
  const report = createReadinessReport(operationalSqlite, operationalMonitor, {
    environment: env.appEnvironment,
    initializationError: databaseInitializationError,
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
    fs.writeFileSync(filePath, buffer);

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

  const fileBuffer = fs.readFileSync(filePath);
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
  return c.body(fileBuffer);
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

// ─── Serve Frontend (Production SPA) ─────────────────────────
if (fs.existsSync(DIST_DIR)) {
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

// ─── 404 Fallback ────────────────────────────────────────────
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

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
