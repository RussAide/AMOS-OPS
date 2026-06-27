import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { sqlite } from "./queries/connection";
import { randomUUID } from "crypto";

// ─── Rate Limiter (in-memory) ──────────────────────────────

interface RateLimitEntry { count: number; resetAt: number; }
const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

// ─── Input Sanitization ────────────────────────────────────

function sanitizeString(input: unknown): unknown {
  if (typeof input === "string") {
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<[^>]*>/g, "")
      .trim();
  }
  if (Array.isArray(input)) return input.map(sanitizeString);
  if (input && typeof input === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      result[k] = sanitizeString(v);
    }
    return result;
  }
  return input;
}

// ─── Audit Logger ──────────────────────────────────────────

export function auditLog(opts: { action: string; actor: string; resource?: string; details?: string; ip?: string }) {
  try {
    sqlite.prepare(
      "INSERT INTO workflow_audit_log (id, action, actor, details, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run(randomUUID(), opts.action, opts.actor, opts.details ?? null);
  } catch {
    // Audit logging should never break the app
  }
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

// ─── Unified Auth: Supports both JWT (Entra ID) and local session tokens ──

interface AuthedUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

async function resolveUser(req: Request): Promise<AuthedUser | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  // Try local session first
  try {
    const session = sqlite.prepare(
      "SELECT s.user_id, u.email, u.first_name, u.last_name, u.role, u.department, u.is_active FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')"
    ).get(token) as any;

    if (session && session.is_active) {
      return {
        id: session.user_id,
        email: session.email,
        role: session.role,
        firstName: session.first_name,
        lastName: session.last_name,
      };
    }
  } catch {
    // Session lookup failed, try JWT fallback
  }

  // Fallback: JWT verification (for future Entra ID integration)
  try {
    const { jwtVerify } = await import("jose");
    const { env } = await import("./lib/env");
    const secret = new TextEncoder().encode(env.jwtSecret);
    const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 });
    return {
      id: payload.sub as string,
      email: payload.email as string,
      role: payload.role as string,
      firstName: payload.firstName as string,
      lastName: payload.lastName as string,
    };
  } catch {
    return null;
  }
}

// Authenticated procedure - verifies session token or JWT
export const authedQuery = t.procedure.use(async ({ ctx, next }) => {
  const user = await resolveUser(ctx.req);
  if (!user) {
    throw new Error("Unauthorized: Invalid or expired session");
  }
  return next({ ctx: { ...ctx, user } });
});

// Admin-only procedure (administrator or hr-director)
export const adminQuery = authedQuery.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "administrator" && ctx.user.role !== "hr-director") {
    throw new Error("Forbidden: Admin access required");
  }
  return next({ ctx });
});

// Role-restricted procedure builder
export function roleQuery(allowedRoles: string[]) {
  return authedQuery.use(async ({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new Error(`Forbidden: Requires one of [${allowedRoles.join(", ")}]`);
    }
    return next({ ctx });
  });
}

// ─── Rate-Limited Auth Procedure ───────────────────────────

export const rateLimitedAuth = publicQuery.use(async ({ ctx, next }) => {
  const clientIp = ctx.req.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`auth:${clientIp}`, 10, 60000)) {
    throw new Error("Too many requests. Please try again in 60 seconds.");
  }
  return next({ ctx });
});

// ─── Sanitized Input Procedure ─────────────────────────────

export const sanitizedQuery = publicQuery.use(async ({ next, rawInput }) => {
  const clean = sanitizeString(rawInput);
  return next({ rawInput: clean });
});

// ─── Mutation with Audit Logging ───────────────────────────

export const auditedMutation = authedQuery.use(async ({ ctx, path, next }) => {
  const result = await next({ ctx });
  auditLog({
    action: `mutation:${path}`,
    actor: ctx.user?.email ?? "anonymous",
    details: `Executed ${path}`,
  });
  return result;
});
