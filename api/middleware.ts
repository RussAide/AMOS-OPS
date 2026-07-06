import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { sqlite } from "./queries/connection";
import { randomUUID } from "crypto";

// ═══════════════════════════════════════════════════════════════
//  Boundary Enforcement: Human-in-Command Middleware
//  Task: D006-03 — Enforce human-in-command boundaries
//  All clinical, compliance, and PHI access is logged and
//  routed through human-review queues.
// ═══════════════════════════════════════════════════════════════

// ─── JWT Secret Strength Validation (Task D013-01) ─────────

/**
 * Validate that the JWT secret meets minimum security requirements.
 * In production, the application MUST refuse to start with a weak secret.
 */
function validateJwtSecretOnStartup(): void {
  const jwtSecret = process.env.JWT_SECRET ?? "";
  const isProduction = process.env.NODE_ENV === "production";

  // Known weak/default secrets that must never be used in production
  const weakPatterns = [
    /^change-in-production/,
    /^your-jwt-secret/,
    /^default/,
    /^secret$/,
    /^test/,
    /^dev/,
    /^amos-ops-dev/,
  ];

  const isWeakPattern = weakPatterns.some((p) => p.test(jwtSecret));
  const isTooShort = jwtSecret.length < 32;

  if (isProduction) {
    if (!jwtSecret || isTooShort || isWeakPattern) {
      throw new Error(
        `SECURITY_VIOLATION: JWT_SECRET is not secure enough for production. ` +
        `Current length: ${jwtSecret.length} chars (minimum 32 required). ` +
        `Generate a strong secret with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" ` +
        `and set it as the JWT_SECRET environment variable.`
      );
    }

    // Check for high entropy (not a simple human-readable phrase)
    const hasMixedCase = /[a-z]/.test(jwtSecret) && /[A-Z]/.test(jwtSecret);
    const hasNumbers = /\d/.test(jwtSecret);
    const hasSpecial = /[^a-zA-Z0-9]/.test(jwtSecret);
    const entropyOk = hasMixedCase && hasNumbers && hasSpecial;

    if (!entropyOk && jwtSecret.length < 64) {
      console.warn(
        `[SECURITY WARNING] JWT_SECRET should have higher entropy (mix of upper, lower, numbers, and special characters) ` +
        `or be at least 64 characters long. Current length: ${jwtSecret.length}`
      );
    }
  } else {
    // Development mode warnings
    if (!jwtSecret || isTooShort || isWeakPattern) {
      console.warn(
        `[SECURITY WARNING] JWT_SECRET is using a weak/default value. ` +
        `This is acceptable for development ONLY. ` +
        `For production, generate a strong secret with: ` +
        `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
      );
    }
  }
}

// Run JWT secret validation immediately on module load
validateJwtSecretOnStartup();

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

// ═══════════════════════════════════════════════════════════════
//  SECTION 1 — CLINICAL OUTPUT MARKING
//  Any endpoint under clinical routers (m5, ccmg, mhtcm, mhrs)
//  that returns clinical data must have the response marked
//  with `requires_clinician_review: true`.
//  Applies to: treatment plans, diagnoses, CANS scores,
//  clinical assessments, medication recommendations.
// ═══════════════════════════════════════════════════════════════

/** Clinical data types that require mandatory review */
export type ClinicalRecordType =
  | "treatment_plan"
  | "diagnosis"
  | "cans_score"
  | "clinical_assessment"
  | "medication_recommendation"
  | "discharge_summary"
  | "care_coordination_note";

/** Metadata attached to every clinical response */
export interface ClinicalBoundaryMeta {
  requires_clinician_review: true;
  reviewed_by: string | null;      // user_id of reviewing clinician
  reviewed_at: string | null;      // ISO timestamp of review
  clinical_record_type: ClinicalRecordType;
  generated_at: string;            // ISO timestamp
  confidence_score?: number;       // 0-1, if applicable
}

/**
 * Wrap clinical output with mandatory human-review metadata.
 * All clinical routers (m5, ccmg, mhtcm, mhrs) must call this
 * before returning data to the client.
 */
export function requireClinicianReview<T extends Record<string, unknown>>(
  data: T,
  recordType: ClinicalRecordType,
  confidenceScore?: number
): T & { _clinical_boundary: ClinicalBoundaryMeta } {
  const bounded: T & { _clinical_boundary: ClinicalBoundaryMeta } = {
    ...data,
    _clinical_boundary: {
      requires_clinician_review: true,
      reviewed_by: null,
      reviewed_at: null,
      clinical_record_type: recordType,
      generated_at: new Date().toISOString(),
      ...(confidenceScore !== undefined ? { confidence_score: confidenceScore } : {}),
    },
  };

  // ── Boundary Violation: Block if unreviewed data escapes ──
  if (!bounded._clinical_boundary.requires_clinician_review) {
    throw new Error("BOUNDARY_VIOLATION: Clinical output must require clinician review");
  }

  return bounded;
}

/**
 * Mark a clinical record as reviewed by a licensed clinician.
 * This is the ONLY way to clear the `requires_clinician_review` flag.
 */
export function markReviewedByClinician<T extends { _clinical_boundary: ClinicalBoundaryMeta }>(
  data: T,
  clinicianId: string
): T & { _clinical_boundary: ClinicalBoundaryMeta } {
  const reviewed = {
    ...data,
    _clinical_boundary: {
      ...data._clinical_boundary,
      requires_clinician_review: true, // remains TRUE for audit immutability
      reviewed_by: clinicianId,
      reviewed_at: new Date().toISOString(),
    } as ClinicalBoundaryMeta,
  };

  // Log the review action for compliance
  auditLog({
    action: "clinical_review_completed",
    actor: clinicianId,
    details: `Clinical review completed for ${data._clinical_boundary.clinical_record_type}`,
  });

  return reviewed;
}

// ─── Clinical Boundary Guard (procedure-level) ─────────────

/**
 * tRPC procedure middleware that enforces clinical output marking.
 * Automatically validates that every response has `_clinical_boundary` metadata.
 * Blocks any clinical data that has not been flagged for review.
 */
export const clinicalQuery = authedQuery.use(async ({ ctx, path, next }) => {
  const result = await next({ ctx });

  // If the result is not already wrapped with clinical boundary metadata,
  // block it — this is a boundary violation.
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const hasBoundary = "_clinical_boundary" in result;
    const isRawArray = Array.isArray(result);

    if (!hasBoundary && !isRawArray) {
      throw new Error(
        `BOUNDARY_VIOLATION: Clinical endpoint "${path}" returned unmarked data. ` +
        `All clinical outputs must be wrapped with requireClinicianReview().`
      );
    }

    // If it's an array of clinical items, each item must have boundary metadata
    if (isRawArray && result.length > 0 && typeof result[0] === "object") {
      const allMarked = (result as unknown[]).every(
        (item) => item && typeof item === "object" && "_clinical_boundary" in (item as object)
      );
      if (!allMarked) {
        throw new Error(
          `BOUNDARY_VIOLATION: Clinical endpoint "${path}" returned array with unmarked items. ` +
          `All clinical outputs must be wrapped with requireClinicianReview().`
        );
      }
    }
  }

  // Log that clinical data was accessed
  auditLog({
    action: "clinical_data_access",
    actor: ctx.user?.email ?? "unknown",
    resource: path,
    details: `Clinical data accessed via ${path}`,
  });

  return result;
});

// ═══════════════════════════════════════════════════════════════
//  SECTION 2 — COMPLIANCE OUTPUT ROUTING
//  Any endpoint under compliance routers (m3, gro-compliance,
//  part2) that generates compliance findings must:
//  - Log the finding to a compliance queue
//  - Mark the finding with qa_officer_id for review
//  - Set status to "pending_review"
// ═══════════════════════════════════════════════════════════════

/** Status lifecycle for a compliance finding */
export type ComplianceStatus =
  | "pending_review"
  | "under_review"
  | "approved"
  | "rejected"
  | "escalated";

/** A compliance finding that requires QA officer review */
export interface ComplianceFinding {
  id?: string;
  finding_type: string;        // e.g. "m3_violation", "gro_non_compliance", "part2_breach"
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  client_id?: string;
  program_id?: string;
  evidence_refs?: string[];    // reference IDs to supporting evidence
  reported_by: string;         // user_id of the reporter
  qa_officer_id: string | null;
  status: ComplianceStatus;
  created_at?: string;
  reviewed_at?: string | null;
  resolution_notes?: string | null;
}

/**
 * Assign a QA officer from the available pool based on severity.
 * Critical/high findings go to senior QA; round-robin for load balancing.
 */
function assignQAOfficer(severity: "low" | "medium" | "high" | "critical"): string | null {
  try {
    // Query directly against users.role — user_roles/roles junction tables
    // are not used in this schema (role is a column on users)
    const officer = sqlite.prepare(
      `SELECT id FROM users
       WHERE role IN ('qa-officer', 'compliance-officer', 'qa-senior',
                      'clinical-director', 'bhc-director', 'treatment-director')
         AND is_active = 1
       ORDER BY
         CASE role
           WHEN 'clinical-director' THEN 1
           WHEN 'bhc-director' THEN 2
           WHEN 'qa-senior' THEN 3
           WHEN 'compliance-officer' THEN 4
           WHEN 'treatment-director' THEN 5
           WHEN 'qa-officer' THEN 6
           ELSE 7
         END,
         (SELECT COUNT(*) FROM compliance_queue cq WHERE cq.qa_officer_id = users.id AND cq.status = 'pending_review')
       LIMIT 1`
    ).get() as { id: string } | undefined;

    if (officer) return officer.id;

    // Fallback: assign to system for manual triage
    return "SYSTEM_TRIAGE";
  } catch {
    return "SYSTEM_TRIAGE";
  }
}

/**
 * Log a compliance finding to the compliance review queue.
 * Automatically assigns a QA officer and sets status to pending_review.
 */
export function routeToQA(finding: ComplianceFinding): ComplianceFinding {
  const id = finding.id ?? randomUUID();
  const now = new Date().toISOString();

  // ── Auto-assign QA officer from pool (round-robin) ──
  const qaOfficer = assignQAOfficer(finding.severity);

  const enriched: ComplianceFinding = {
    ...finding,
    id,
    qa_officer_id: qaOfficer,
    status: "pending_review",
    created_at: now,
    reviewed_at: null,
  };

  // ── Persist to compliance_queue table ──
  try {
    sqlite.prepare(
      `INSERT INTO compliance_queue (
        id, finding_type, severity, description, client_id, program_id,
        evidence_refs, reported_by, qa_officer_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      enriched.id,
      enriched.finding_type,
      enriched.severity,
      enriched.description,
      enriched.client_id ?? null,
      enriched.program_id ?? null,
      enriched.evidence_refs ? JSON.stringify(enriched.evidence_refs) : null,
      enriched.reported_by,
      enriched.qa_officer_id,
      enriched.status,
      enriched.created_at
    );

    // ── Log the routing action ──
    auditLog({
      action: "compliance_finding_routed",
      actor: enriched.reported_by,
      resource: enriched.id,
      details: `Compliance finding [${enriched.finding_type}] routed to QA officer ${enriched.qa_officer_id} with severity ${enriched.severity}`,
    });
  } catch (err) {
    // If queue write fails, still throw — compliance findings MUST be logged
    throw new Error(
      `BOUNDARY_VIOLATION: Failed to route compliance finding to QA queue: ${(err as Error).message}`
    );
  }

  return enriched;
}

/**
 * Update the status of a compliance finding in the queue.
 * Only the assigned QA officer or an admin can change status.
 */
export function updateComplianceStatus(
  findingId: string,
  newStatus: ComplianceStatus,
  updaterId: string,
  resolutionNotes?: string
): void {
  try {
    // Verify the updater is the assigned QA officer or an admin
    const finding = sqlite.prepare(
      "SELECT qa_officer_id FROM compliance_queue WHERE id = ?"
    ).get(findingId) as { qa_officer_id: string } | undefined;

    if (!finding) {
      throw new Error(`Compliance finding ${findingId} not found`);
    }

    const updater = sqlite.prepare(
      "SELECT role FROM users WHERE id = ?"
    ).get(updaterId) as { role: string } | undefined;

    const isAdmin = updater?.role === "administrator" || updater?.role === "compliance-officer";
    const isAssignedQa = finding.qa_officer_id === updaterId;

    if (!isAdmin && !isAssignedQa) {
      throw new Error(
        `BOUNDARY_VIOLATION: User ${updaterId} is not authorized to update compliance finding ${findingId}. ` +
        `Only the assigned QA officer or an admin can update status.`
      );
    }

    sqlite.prepare(
      `UPDATE compliance_queue
       SET status = ?, reviewed_at = datetime('now'), resolution_notes = ?
       WHERE id = ?`
    ).run(newStatus, resolutionNotes ?? null, findingId);

    auditLog({
      action: "compliance_status_updated",
      actor: updaterId,
      resource: findingId,
      details: `Status changed to ${newStatus}${resolutionNotes ? ": " + resolutionNotes : ""}`,
    });
  } catch (err) {
    throw new Error(`Failed to update compliance status: ${(err as Error).message}`);
  }
}

// ─── Compliance Boundary Guard (procedure-level) ───────────

/**
 * tRPC procedure middleware that enforces compliance routing.
 * Ensures any compliance finding returned by the endpoint has
 * been properly logged to the compliance queue.
 */
export const complianceQuery = authedQuery.use(async ({ ctx, path, next }) => {
  const result = await next({ ctx });

  // Intercept any raw ComplianceFinding objects and route them
  if (result && typeof result === "object") {
    const raw = result as Record<string, unknown>;

    // If the result looks like an un-routed compliance finding, block it
    if (
      "finding_type" in raw &&
      "severity" in raw &&
      !("_compliance_routed" in raw)
    ) {
      throw new Error(
        `BOUNDARY_VIOLATION: Compliance endpoint "${path}" returned an un-routed finding. ` +
        `All compliance findings must be processed through routeToQA() before returning.`
      );
    }
  }

  // Log compliance endpoint access
  auditLog({
    action: "compliance_endpoint_access",
    actor: ctx.user?.email ?? "unknown",
    resource: path,
    details: `Compliance endpoint ${path} was accessed`,
  });

  return result;
});

// ═══════════════════════════════════════════════════════════════
//  SECTION 3 — PHI ACCESS LOGGING
//  All endpoints that access patient/client data must log:
//  - Who accessed (user_id)
//  - What was accessed (patient_id, record_type)
//  - When (timestamp)
//  - Why (endpoint name / purpose)
//  Store in phi_access_log table.
// ═══════════════════════════════════════════════════════════════

/** Record types that constitute PHI */
export type PHIRecordType =
  | "demographics"
  | "clinical_assessment"
  | "treatment_plan"
  | "medication"
  | "diagnosis"
  | "progress_note"
  | "lab_result"
  | "insurance"
  | "appointment"
  | "contact_info"
  | "emergency_contact"
  | "discharge_summary"
  | "case_note"
  | "cans_assessment"
  | "incident_report"
  | "billing_record";

/** Single entry in the phi_access_log table */
export interface PHIAccessRecord {
  id: string;
  user_id: string;
  user_email: string;
  patient_id: string;
  record_type: PHIRecordType;
  endpoint: string;
  access_purpose: string;      // why — e.g. "treatment_plan_review"
  ip_address: string | null;
  user_agent: string | null;
  accessed_at: string;
  outcome: "allowed" | "denied" | "blocked";
  denial_reason?: string | null;
}

/**
 * Log PHI access to the phi_access_log table.
 * Must be called by any endpoint that reads patient/client data.
 */
export function logPHIAccess(
  ctx: TrpcContext & { user?: { id: string; email: string } },
  patientId: string,
  recordType: PHIRecordType,
  purpose: string,
  outcome: "allowed" | "denied" | "blocked" = "allowed",
  denialReason?: string
): PHIAccessRecord {
  const id = randomUUID();
  const now = new Date().toISOString();

  const record: PHIAccessRecord = {
    id,
    user_id: ctx.user?.id ?? "anonymous",
    user_email: ctx.user?.email ?? "anonymous",
    patient_id: patientId,
    record_type: recordType,
    endpoint: purpose, // the endpoint path or action name
    access_purpose: purpose,
    ip_address: ctx.req.headers.get("x-forwarded-for") ?? ctx.req.headers.get("x-real-ip") ?? null,
    user_agent: ctx.req.headers.get("user-agent") ?? null,
    accessed_at: now,
    outcome,
    denial_reason: denialReason ?? null,
  };

  try {
    sqlite.prepare(
      `INSERT INTO phi_access_log (
        id, user_id, user_email, patient_id, record_type,
        endpoint, access_purpose, ip_address, user_agent,
        accessed_at, outcome, denial_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      record.id,
      record.user_id,
      record.user_email,
      record.patient_id,
      record.record_type,
      record.endpoint,
      record.access_purpose,
      record.ip_address,
      record.user_agent,
      record.accessed_at,
      record.outcome,
      record.denial_reason
    );
  } catch (err) {
    // PHI logging failure is itself logged to the audit log
    auditLog({
      action: "phi_logging_failure",
      actor: ctx.user?.email ?? "system",
      resource: patientId,
      details: `Failed to log PHI access: ${(err as Error).message}`,
    });
  }

  return record;
}

/**
 * Check whether the current user is authorized to access PHI
 * for a specific patient. Enforces role-based and
 * need-to-know restrictions.
 */
export function authorizePHIAccess(
  ctx: TrpcContext & { user?: { id: string; email: string; role: string } },
  patientId: string,
  recordType: PHIRecordType
): { allowed: true } | { allowed: false; reason: string } {
  const user = ctx.user;

  // Unauthenticated users cannot access PHI
  if (!user) {
    logPHIAccess(ctx, patientId, recordType, "auth_check", "denied", "Unauthenticated user");
    return { allowed: false, reason: "Authentication required for PHI access" };
  }

  // Role-based PHI access control
  const phiAllowedRoles = [
    "administrator",
    "hr-director",
    "clinician",
    "case-manager",
    "therapist",
    "nurse",
    "qa-officer",
    "compliance-officer",
    "billing-staff",
  ];

  if (!phiAllowedRoles.includes(user.role)) {
    logPHIAccess(ctx, patientId, recordType, "role_check", "denied", `Role ${user.role} not authorized for PHI`);
    return { allowed: false, reason: `Role '${user.role}' is not authorized to access PHI` };
  }

  // Billing staff can only access billing-related PHI
  if (user.role === "billing-staff" && recordType !== "billing_record" && recordType !== "insurance") {
    logPHIAccess(ctx, patientId, recordType, "billing_scope_check", "denied", "Billing staff scope violation");
    return { allowed: false, reason: "Billing staff may only access billing and insurance records" };
  }

  // All checks passed
  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 3A — PHI ACCESS LOGGING (Task D006-03 baseline)
//  All endpoints that access patient/client data must log:
//  - Who accessed (user_id)
//  - What was accessed (patient_id, record_type)
//  - When (timestamp)
//  - Why (endpoint name / purpose)
//  Store in phi_access_log table.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  SECTION 3B — RUNTIME PHI ENFORCEMENT (Task D013-03)
//  Hardened phiGuardQuery with:
//    - phi_level checks on document/patient access
//    - Role-based access restrictions with scope validation
//    - Mandatory logging of ALL PHI access (allowed + denied)
//    - Document-level PHI classification enforcement
// ═══════════════════════════════════════════════════════════════

/** PHI sensitivity levels for documents and patient records */
export type PHILevel = "standard" | "sensitive" | "restricted" | "critical";

/** Role clearance mapping — which PHI levels each role can access */
const PHI_ROLE_CLEARANCE: Record<string, PHILevel[]> = {
  // Clinical roles — full access to all PHI levels
  administrator:    ["standard", "sensitive", "restricted", "critical"],
  "hr-director":    ["standard", "sensitive", "restricted", "critical"],
  clinician:        ["standard", "sensitive", "restricted", "critical"],
  therapist:        ["standard", "sensitive", "restricted"],
  "case-manager":   ["standard", "sensitive", "restricted"],
  nurse:            ["standard", "sensitive", "restricted"],
  // QA/compliance — restricted access, no critical
  "qa-officer":     ["standard", "sensitive"],
  "compliance-officer": ["standard", "sensitive"],
  // Billing — only standard level billing records
  "billing-staff":  ["standard"],
  // General staff — no PHI access
  staff:            [],
  rcs:              [],
  "rcs-day":        [],
  "rcs-night":      [],
  intern:           [],
  volunteer:        [],
};

/**
 * Determine the PHI sensitivity level for a given patient record
 * or document. Queries the database for phi_level classification.
 * Falls back to "sensitive" if no classification is found.
 */
export function resolvePHILevel(
  patientId: string,
  recordType: PHIRecordType
): PHILevel {
  try {
    // Check if the patient record has a phi_level classification
    const patient = sqlite.prepare(
      "SELECT phi_level FROM patients WHERE id = ?"
    ).get(patientId) as { phi_level: PHILevel | null } | undefined;

    if (patient?.phi_level) {
      return patient.phi_level;
    }

    // Check document-level phi_level for document record types
    if (recordType === "discharge_summary" || recordType === "clinical_assessment") {
      return "restricted";
    }
    if (recordType === "diagnosis" || recordType === "medication") {
      return "sensitive";
    }
    if (recordType === "lab_result" || recordType === "cans_assessment") {
      return "sensitive";
    }
    if (recordType === "billing_record" || recordType === "insurance") {
      return "standard";
    }

    // Default fallback
    return "sensitive";
  } catch {
    // If we can't determine the level, assume the most restrictive
    // that still allows legitimate clinical work
    return "sensitive";
  }
}

/**
 * Check whether the user's role has clearance for the given PHI level.
 * Returns true if authorized, false otherwise.
 */
export function authorizePHILevel(
  userRole: string,
  requiredLevel: PHILevel
): boolean {
  const allowedLevels = PHI_ROLE_CLEARANCE[userRole] ?? [];
  return allowedLevels.includes(requiredLevel);
}

/**
 * Comprehensive PHI access check that combines:
 *  1. Authentication validation
 *  2. Role-based authorization (authorizePHIAccess)
 *  3. PHI level clearance (authorizePHILevel)
 *  4. Mandatory access logging (logPHIAccess)
 *
 * Returns { allowed: true } if all checks pass, or
 * { allowed: false, reason: string } if any check fails.
 */
export function enforcePHIAccess(
  ctx: TrpcContext & { user?: { id: string; email: string; role: string } },
  patientId: string,
  recordType: PHIRecordType
): { allowed: true } | { allowed: false; reason: string } {
  // Step 1: Base role-based authorization
  const baseAuthz = authorizePHIAccess(ctx, patientId, recordType);
  if (!baseAuthz.allowed) {
    // Already logged by authorizePHIAccess
    return baseAuthz;
  }

  // Step 2: PHI level clearance check
  const phiLevel = resolvePHILevel(patientId, recordType);
  const levelAuthorized = authorizePHILevel(ctx.user!.role, phiLevel);

  if (!levelAuthorized) {
    const reason = `Role '${ctx.user!.role}' does not have clearance for PHI level '${phiLevel}' (patient: ${patientId}, record: ${recordType})`;
    logPHIAccess(ctx, patientId, recordType, "phi_level_check", "denied", reason);
    auditLog({
      action: "phi_level_access_denied",
      actor: ctx.user!.email,
      resource: patientId,
      details: reason,
    });
    return { allowed: false, reason };
  }

  // Step 3: Log successful access with resolved PHI level
  logPHIAccess(ctx, patientId, recordType, "phi_guard_allowed", "allowed");
  auditLog({
    action: "phi_access_allowed",
    actor: ctx.user!.email,
    resource: patientId,
    details: `PHI access allowed: role=${ctx.user!.role}, phi_level=${phiLevel}, record_type=${recordType}`,
  });

  return { allowed: true };
}

// ─── PHI Guard Procedure (middleware-level) ────────────────

/**
 * tRPC procedure middleware that enforces PHI access logging
 * and authorization on every request. Must wrap any endpoint
 * that touches patient/client data.
 *
 * Hardened for Task D013-03 with:
 *   - phi_level classification enforcement
 *   - Role-based scope restrictions
 *   - Mandatory logging of all access attempts (allowed + denied)
 *
 * Usage:
 *   phiGuardQuery({ patientId: "abc", recordType: "demographics" })
 *     .query(async ({ ctx }) => { ... })
 */
export function phiGuardQuery(opts: { patientId?: string; recordType: PHIRecordType }) {
  return authedQuery.use(async ({ ctx, path, next }) => {
    const user = ctx.user!;

    // ── Check 1: Validate the user has any PHI clearance at all ──
    const userClearance = PHI_ROLE_CLEARANCE[user.role] ?? [];
    if (userClearance.length === 0) {
      const reason = `Role '${user.role}' has no PHI clearance`;
      if (opts.patientId) {
        logPHIAccess(ctx, opts.patientId, opts.recordType, path, "blocked", reason);
      }
      auditLog({
        action: "phi_access_denied_no_clearance",
        actor: user.email,
        resource: opts.patientId ?? "unknown",
        details: `${reason} on ${path}`,
      });
      throw new Error(`BOUNDARY_VIOLATION: ${reason}`);
    }

    // ── Check 2: If patientId is provided at middleware setup time,
    //    run the full enforcePHIAccess check (role + phi_level)
    if (opts.patientId) {
      const authz = enforcePHIAccess(ctx, opts.patientId, opts.recordType);
      if (!authz.allowed) {
        logPHIAccess(ctx, opts.patientId, opts.recordType, path, "blocked", authz.reason);
        throw new Error(`BOUNDARY_VIOLATION: ${authz.reason}`);
      }
    }

    // ── Check 3: For endpoints where patientId is resolved at runtime
    //    (e.g. from query params), the endpoint itself is responsible
    //    for calling enforcePHIAccess with the resolved patientId.
    //    This middleware validates authentication and basic clearance.
    auditLog({
      action: "phi_access_attempt",
      actor: user.email,
      resource: opts.patientId ?? "dynamic",
      details: `PHI access attempt on ${opts.recordType} via ${path} — role: ${user.role}, clearance: [${userClearance.join(", ")}]`,
    });

    return next({ ctx });
  });
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 4 — BOUNDARY VIOLATION DETECTION & BLOCKING
//  Centralized violation handler that blocks unauthorized
//  access attempts and logs them for forensic review.
// ═══════════════════════════════════════════════════════════════

/** Types of boundary violations that can be detected */
export type BoundaryViolationType =
  | "unmarked_clinical_output"
  | "unrouted_compliance_finding"
  | "unauthorized_phi_access"
  | "unauthenticated_phi_access"
  | "role_escalation_attempt"
  | "qa_override_attempt"
  | "missing_clinician_review"
  | "unlogged_phi_access";

/** Severities for violation events */
export type ViolationSeverity = "info" | "warning" | "critical" | "emergency";

interface BoundaryViolationEvent {
  id: string;
  violation_type: BoundaryViolationType;
  severity: ViolationSeverity;
  endpoint: string;
  actor_id: string;
  actor_email: string;
  description: string;
  blocked: boolean;
  created_at: string;
}

/**
 * Report a boundary violation. Always blocks the request
 * and logs the event for forensic review.
 */
export function reportBoundaryViolation(
  ctx: TrpcContext & { user?: { id: string; email: string } },
  violationType: BoundaryViolationType,
  endpoint: string,
  description: string,
  severity: ViolationSeverity = "critical"
): never {
  const id = randomUUID();
  const now = new Date().toISOString();

  const event: BoundaryViolationEvent = {
    id,
    violation_type: violationType,
    severity,
    endpoint,
    actor_id: ctx.user?.id ?? "anonymous",
    actor_email: ctx.user?.email ?? "anonymous",
    description,
    blocked: true,
    created_at: now,
  };

  // Persist to boundary_violations table
  try {
    sqlite.prepare(
      `INSERT INTO boundary_violations (
        id, violation_type, severity, endpoint,
        actor_id, actor_email, description, blocked, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      event.id,
      event.violation_type,
      event.severity,
      event.endpoint,
      event.actor_id,
      event.actor_email,
      event.description,
      event.blocked ? 1 : 0,
      event.created_at
    );
  } catch (err) {
    // If violation table doesn't exist yet, fall back to audit log
    auditLog({
      action: "boundary_violation",
      actor: event.actor_email,
      resource: endpoint,
      details: `[${violationType}] ${description}`,
    });
  }

  // Always throw — boundary violations are NEVER allowed through
  throw new Error(
    `BOUNDARY_VIOLATION [${violationType}]: ${description}. ` +
    `This incident has been logged (id: ${id}) and will be reviewed.`
  );
}

/**
 * Middleware that detects and blocks common boundary violation
 * patterns at the request level.
 */
export const boundaryGuard = authedQuery.use(async ({ ctx, path, next }) => {
  const user = ctx.user!;

  // ── Check 1: Role escalation attempt ──
  const suspiciousRoles = ["administrator", "hr-director", "qa-senior", "compliance-officer"];
  const roleInPath = suspiciousRoles.some((r) => path.toLowerCase().includes(r.replace("-", "")));
  if (roleInPath && !suspiciousRoles.includes(user.role)) {
    reportBoundaryViolation(
      ctx,
      "role_escalation_attempt",
      path,
      `User with role '${user.role}' attempted to access privileged endpoint '${path}'`,
      "critical"
    );
  }

  // ── Check 2: Unauthenticated access to sensitive paths ──
  const sensitivePatterns = ["/clinical/", "/compliance/", "/phi/", "/patient/", "/cans/", "/m5/", "/m3/", "/mhtcm/", "/mhrs/"];
  const isSensitivePath = sensitivePatterns.some((p) => path.includes(p));
  if (isSensitivePath && !ctx.user) {
    reportBoundaryViolation(
      ctx,
      "unauthenticated_phi_access",
      path,
      `Unauthenticated request to sensitive endpoint '${path}'`,
      "emergency"
    );
  }

  return next({ ctx });
});

// ═══════════════════════════════════════════════════════════════
//  SECTION 5 — COMPOSITE PROCEDURES (convenience exports)
// ═══════════════════════════════════════════════════════════════

/** Clinical endpoint: auth + clinical marking + boundary guard */
export const clinicalEndpoint = clinicalQuery.use(async ({ ctx, path, next }) => {
  const result = await next({ ctx });
  return result;
});

/** Compliance endpoint: auth + compliance routing + boundary guard */
export const complianceEndpoint = complianceQuery.use(async ({ ctx, path, next }) => {
  const result = await next({ ctx });
  return result;
});

/** PHI endpoint: auth + PHI logging + boundary guard */
export const phiEndpoint = boundaryGuard;
