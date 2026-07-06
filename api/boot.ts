import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { initDatabase } from "./db-init";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

// ─── Initialize ──────────────────────────────────────────────

try {
  initDatabase();
  console.log("[DB] Database initialized");
} catch (err) {
  console.error("[DB] Init failed:", err);
}

const app = new Hono();
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const DIST_DIR = path.join(process.cwd(), "dist", "public");
const INDEX_HTML = path.join(DIST_DIR, "index.html");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// ─── CORS ────────────────────────────────────────────────────
app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

// ─── Health Check ────────────────────────────────────────────
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    env: process.env.NODE_ENV || "unknown",
  });
});

// ─── File Upload ─────────────────────────────────────────────
app.post("/api/upload", async (c) => {
  try {
    const contentType = c.req.header("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return c.json({ error: "Expected multipart/form-data" }, 400);
    }

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "No file provided" }, 400);

    const ext = path.extname(file.name) || ".bin";
    const safeName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    return c.json({
      success: true,
      fileName: file.name,
      storedName: safeName,
      filePath: `/uploads/${safeName}`,
      fileSize: file.size,
      fileType: file.type,
    }, 201);
  } catch (err: any) {
    console.error("[Upload] Error:", err);
    return c.json({ error: err.message || "Upload failed" }, 500);
  }
});

// ─── File Download ───────────────────────────────────────────
app.get("/uploads/:filename", async (c) => {
  const filename = c.req.param("filename");
  const safeFilename = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, safeFilename);

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
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
  };
  c.header("Content-Type", mimeTypes[ext] || "application/octet-stream");
  return c.body(fileBuffer);
});

// ─── tRPC API ────────────────────────────────────────────────
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
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
  console.warn("[WARN] dist/public not found — frontend will not be served");
  app.get("/", (c) => c.json({ message: "AMOS-OPS API Server", status: "ok", frontend: "not built" }));
}

// ─── 404 Fallback ────────────────────────────────────────────
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

// ─── Start Server ────────────────────────────────────────────
const port = parseInt(process.env.PORT || "3000");
serve({ fetch: app.fetch, port }, () => {
  console.log(`[SERVER] AMOS-OPS running on port ${port}`);
  console.log(`[SERVER] Health: http://localhost:${port}/api/health`);
});

export default app;
