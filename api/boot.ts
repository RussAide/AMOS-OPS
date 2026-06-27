import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { initDatabase } from "./db-init";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

// Initialize database on startup
initDatabase();

const app = new Hono<{ Bindings: HttpBindings }>();
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// ─── File Upload Endpoint ────────────────────────────────────
app.post("/api/upload", async (c) => {
  try {
    const contentType = c.req.header("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return c.json({ error: "Expected multipart/form-data" }, 400);
    }

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const personId = formData.get("personId") as string | null;
    const moduleId = formData.get("moduleId") as string | null;
    const recordName = formData.get("recordName") as string | null;
    const uploadedBy = formData.get("uploadedBy") as string | null;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    // Generate safe filename
    const ext = path.extname(file.name) || ".bin";
    const safeName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeName);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Return metadata
    return c.json({
      success: true,
      fileName: file.name,
      storedName: safeName,
      filePath: `/uploads/${safeName}`,
      fileSize: file.size,
      fileType: file.type,
      personId: personId || undefined,
      moduleId: moduleId || undefined,
      recordName: recordName || undefined,
      uploadedBy: uploadedBy || undefined,
    }, 201);
  } catch (err: any) {
    console.error("[Upload] Error:", err);
    return c.json({ error: err.message || "Upload failed" }, 500);
  }
});

// ─── File Download Endpoint ──────────────────────────────────
app.get("/uploads/:filename", async (c) => {
  const filename = c.req.param("filename");
  // Security: prevent directory traversal
  const safeFilename = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return c.json({ error: "File not found" }, 404);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(safeFilename).toLowerCase();

  // Set content type based on extension
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
  };

  c.header("Content-Type", mimeTypes[ext] || "application/octet-stream");
  return c.body(fileBuffer);
});

// ─── tRPC Handler ────────────────────────────────────────────
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

// ─── Serve uploads in production ─────────────────────────────
if (env.isProduction) {
  app.use("/uploads/*", async (c, next) => {
    const filename = c.req.path.replace("/uploads/", "");
    const safeFilename = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return c.json({ error: "File not found" }, 404);
    }

    await next();
  });
}

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
