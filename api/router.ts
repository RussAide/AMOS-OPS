import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware";
import { sqlite } from "./queries/connection";
import { documentsRouter } from "./routers/documents";
import { personaRouter } from "./routers/persona";
import { hrRouter } from "./routers/hr";
import { m1Router as workQueueRouter } from "./routers/m1";
import { m2Router } from "./routers/m2";
import { m10Router } from "./routers/m10";
import { m3Router } from "./routers/m3";
import { m4Router } from "./routers/m4";
import { m5Router } from "./routers/m5";
import { m6Router } from "./routers/m6";
import { m13Router } from "./routers/m13";
import { m14Router } from "./routers/m14";
import { m15Router } from "./routers/m15";
import { m16Router } from "./routers/m16";
import { m17Router } from "./routers/m17";
import { m18Router } from "./routers/m18";
import { m19Router } from "./routers/m19";
import { m20Router } from "./routers/m20";
import { m21Router } from "./routers/m21";
import { m29Router } from "./routers/m29";
import { notificationsRouter } from "./routers/notifications";
import { mhtcmRouter } from "./routers/mhtcm";
import { ccmgRouter } from "./routers/ccmg";
import { groComplianceRouter } from "./routers/gro-compliance";
import { groRouter as groResidentialRouter } from "./routers/gro";
import { mhrsRouter } from "./routers/mhrs";
import { part2Router } from "./routers/part2";
import { mgmaRouter } from "./routers/mgma";
import { credentialsRouter } from "./routers/credentials";
import { separationRouter } from "./routers/separation";
import { performanceRouter } from "./routers/performance";
import { trainingRouter } from "./routers/training";
import { getDb } from "./queries/connection";
import {
  patients, clinicalSessions, treatmentPlans,
  claims as claimsTable, facilities, bedCensusV2,
  mgmaDomains, mgmaKpiTargets,
  sudRecords as sudRecordsTable, part2Consents, qsoaAgreements, part2AuditLog,
  dmsDocuments, nilEntities as nilEntitiesTable, nilRelationships,
  hrPeople, incidents, correctiveActions, audits as auditsTable,
  credentials as credentialsTable, outcomeMeasures, authorizations,
  trainingModules, trainingProgress, separationChecklists, performanceReviews,
  shifts,
} from "@db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const SALT = 10;
function hash(pwd: string) { return bcrypt.hashSync(pwd, SALT); }

// Safe query helper
function all(table: string): any[] { try { return sqlite.prepare(`SELECT * FROM ${table} LIMIT 50`).all() ?? []; } catch { return []; } }
function cnt(table: string): number { try { return (sqlite.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any)?.c ?? 0; } catch { return 0; } }

// ─── AUTH ──────────────────────────────────────────────────
const authRouter = createRouter({
  login: publicQuery.input(z.object({ email: z.string().email(), password: z.string() })).mutation(async ({ input }) => {
    const user = sqlite.prepare("SELECT * FROM users WHERE email = ? AND is_active = 1").get(input.email) as any;
    if (!user || !bcrypt.compareSync(input.password, user.password_hash)) throw new Error("Invalid credentials");
    // Issue JWT instead of session token
    const { SignJWT } = await import("jose");
    const { env } = await import("./lib/env");
    const secret = new TextEncoder().encode(env.jwtSecret);
    const token = await new SignJWT({
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret);
    return { token, user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, name: `${user.first_name} ${user.last_name}`, role: user.role } };
  }),
  me: publicQuery.input(z.object({ token: z.string() }).optional()).query(async ({ input }) => {
    if (!input?.token) return null;
    // Verify JWT
    try {
      const { jwtVerify } = await import("jose");
      const { env } = await import("./lib/env");
      const secret = new TextEncoder().encode(env.jwtSecret);
      const { payload } = await jwtVerify(input.token, secret, { clockTolerance: 60 });
      return {
        id: payload.sub as string,
        email: payload.email as string,
        firstName: payload.firstName as string,
        lastName: payload.lastName as string,
        name: `${payload.firstName} ${payload.lastName}`,
        role: payload.role as string,
      };
    } catch {
      return null;
    }
  }),
  logout: publicQuery.input(z.object({ token: z.string() })).mutation(async () => {
    // JWT cannot be invalidated server-side; client clears token from storage
    return { success: true };
  }),
  register: publicQuery.input(z.object({ email: z.string().email(), password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/, "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"), firstName: z.string(), lastName: z.string(), role: z.string().optional(), department: z.string().optional() })).mutation(async ({ input }) => {
    const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(input.email);
    if (existing) throw new Error("Email already registered");
    // First user becomes super-admin automatically; subsequent users need admin approval
    const userCount = sqlite.prepare("SELECT COUNT(*) as c FROM users").get() as any;
    const isFirstUser = (userCount?.c ?? 0) === 0;
    const assignedRole = isFirstUser ? "super-admin" : (input.role ?? "rcs-day");
    const id = randomUUID();
    sqlite.prepare("INSERT INTO users (id, email, password_hash, first_name, last_name, role, department, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))")
      .run(id, input.email, hash(input.password), input.firstName, input.lastName, assignedRole, input.department ?? null);
    // Issue JWT instead of session token
    const { SignJWT } = await import("jose");
    const { env } = await import("./lib/env");
    const secret = new TextEncoder().encode(env.jwtSecret);
    const token = await new SignJWT({
      sub: id,
      email: input.email,
      role: assignedRole,
      firstName: input.firstName,
      lastName: input.lastName,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret);
    return { token, user: { id, email: input.email, firstName: input.firstName, lastName: input.lastName, name: `${input.firstName} ${input.lastName}`, role: assignedRole } };
  }),
  // ─── User Management (admin only) ────────────────────────
  listUsers: adminQuery.query(() => {
    const rows = sqlite.prepare("SELECT id, email, first_name, last_name, role, department, is_active, created_at FROM users ORDER BY created_at DESC").all() ?? [];
    return (rows as any[]).map((u) => ({
      id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name,
      name: `${u.first_name} ${u.last_name}`, role: u.role, department: u.department,
      isActive: u.is_active === 1, createdAt: u.created_at,
    }));
  }),
  updateUser: adminQuery.input(z.object({
    id: z.string(), role: z.string().optional(), department: z.string().optional(),
    isActive: z.boolean().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...updates } = input;
    if (updates.role) sqlite.prepare("UPDATE users SET role = ? WHERE id = ?").run(updates.role, id);
    if (updates.department !== undefined) sqlite.prepare("UPDATE users SET department = ? WHERE id = ?").run(updates.department, id);
    if (updates.isActive !== undefined) sqlite.prepare("UPDATE users SET is_active = ? WHERE id = ?").run(updates.isActive ? 1 : 0, id);
    return { success: true };
  }),
  deleteUser: adminQuery.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    sqlite.prepare("DELETE FROM users WHERE id = ?").run(input.id);
    return { success: true };
  }),
});

// ─── BHC CLINICAL (M5: AMOS-Clinical) ──────────────────────
const clinicalRouter = m5Router;

// ─── REVENUE (M4: AMOS-Revenue) ────────────────────────────
const revenueRouter = m4Router;

// ─── QA (M3: AMOS-Sentinel) ────────────────────────────────
// Re-export m3Router as qaRouter for backward compatibility
const qaRouter = m3Router;

// ─── GAD (M7: General Administration) ──────────────────────
import { m7Router } from "./routers/m7";
const gadRouter = m7Router;

// ─── GRO (M6: Growth & Outreach) ──────────────────────────
const groRouter = m6Router;

// ─── NIL (M9: Knowledge Graph) ─────────────────────────────
import { m9Router } from "./routers/m9";
const nilRouter = m9Router;

// ─── WORKFLOW (M8: Workflow Engine) ────────────────────────
import { m8Router } from "./routers/m8";
const workflowRouter = m8Router;

// ─── ENTRA ID ──────────────────────────────────────────────
const entraRouter = createRouter({
  status: adminQuery.query(() => ({ connected: false, tenant: "Not configured", syncMode: "none", users: { synced: 0, total: 0 }, groups: { synced: 0, total: 0 }, lastSync: null })),
  sync: adminQuery.mutation(async () => ({ usersSynced: 0, groupsSynced: 0 })),
  listUsers: adminQuery.query(() => []),
  listGroups: adminQuery.query(() => []),
  syncHistory: adminQuery.query(() => []),
});

// ─── MAIN ROUTER ───────────────────────────────────────────
export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  hr: hrRouter,
  bhc: clinicalRouter,
  revenue: revenueRouter,
  qa: qaRouter,
  gad: gadRouter,
  gro: groRouter,
  nil: nilRouter,
  workflow: workflowRouter,
  msgraph: entraRouter,
  m1: workQueueRouter,
  m2: m2Router,
  m13: m13Router,
  m14: m14Router,
  m15: m15Router,
  m16: m16Router,
  m17: m17Router,
  m18: m18Router,
  m19: m19Router,
  m20: m20Router,
  m21: m21Router,
  m29: m29Router,
  analytics: m10Router,
  notifications: notificationsRouter,
  persona: personaRouter,
  mhtcm: mhtcmRouter,
  ccmg: ccmgRouter,
  groCompliance: groComplianceRouter,
  groResidential: groResidentialRouter,
  mhrs: mhrsRouter,
  part2: part2Router,
  mgma: mgmaRouter,
  credentials: credentialsRouter,
  separation: separationRouter,
  performance: performanceRouter,
  training: trainingRouter,
  documents: documentsRouter,

  // ─── Unified Dashboard Overview ────────────────────────────
  dashboard: createRouter({
    overview: publicQuery.query(async () => {
      const db = getDb();
      const now = new Date();
      const iso = now.toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // BHC Clinical
      const allPatients = await db.select().from(patients).all();
      const activePatients = allPatients.filter((p) => p.status === "active");
      const allSessions = await db.select().from(clinicalSessions).all();
      const sessionsThisWeek = allSessions.filter((s) => s.sessionDate >= sevenDaysAgo);
      const todayStr = iso.split("T")[0];
      const sessionsToday = allSessions.filter((s) => s.sessionDate.startsWith(todayStr));
      let highRiskCount = 0;
      for (const s of allSessions) {
        if (!s.riskAssessmentJson) continue;
        try {
          const risk = JSON.parse(s.riskAssessmentJson);
          if (risk.suicideRisk === "high" || risk.homocideRisk === "high" || risk.elopementRisk === "high") highRiskCount++;
        } catch { /* ignore */ }
      }
      const pendingApprovals = await db.select().from(treatmentPlans).where(eq(treatmentPlans.status, "under_review")).all();

      // Revenue
      const allClaims = await db.select().from(claimsTable).all();
      const totalBilled = allClaims.reduce((sum, c) => sum + (c.totalAmount ?? 0), 0);
      const totalCollected = allClaims.reduce((sum, c) => sum + (c.paidAmount ?? 0), 0);
      const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

      // Campus
      const facilityRows = await db.select().from(facilities).all();
      const bedRows = await db.select().from(bedCensusV2).all();
      const totalBeds = facilityRows.reduce((sum, f) => sum + (f.operationalCapacity ?? f.totalBeds ?? 0), 0);
      const occupiedBeds = bedRows.filter((b) => b.isOccupied).length;
      const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      // MGMA
      const mgmaDomainRows = await db.select().from(mgmaDomains).all();
      const mgmaKPIRows = await db.select().from(mgmaKpiTargets).all();
      // Compute per-domain progress from KPI status
      const kpiByDomain: Record<string, { total: number; onTarget: number }> = {};
      for (const k of mgmaKPIRows) {
        if (!kpiByDomain[k.domainId]) kpiByDomain[k.domainId] = { total: 0, onTarget: 0 };
        kpiByDomain[k.domainId].total++;
        if (k.status === "on_target" || k.status === "at_risk") kpiByDomain[k.domainId].onTarget++;
      }

      // Part 2
      const sudRecordRows = await db.select().from(sudRecordsTable).all();
      const activeSUD = sudRecordRows.filter((r) => r.status === "active").length;
      const consentRows = await db.select().from(part2Consents).all();
      const validConsents = consentRows.filter((c) => c.status === "valid").length;
      const expiredConsents = consentRows.filter((c) => c.status === "expired").length;
      const qsoaRows = await db.select().from(qsoaAgreements).all();
      const activeQSOA = qsoaRows.filter((q) => q.status === "active").length;
      const auditLogEntries = await db.select().from(part2AuditLog).all();

      // Documents
      const allDocs = await db.select().from(dmsDocuments).all();
      const publishedDocs = allDocs.filter((d) => d.status === "published").length;
      const draftDocs = allDocs.filter((d) => d.status === "draft").length;

      // NIL
      const nilEntityRows = await db.select().from(nilEntitiesTable).all();
      const nilRelationRows = await db.select().from(nilRelationships).all();

      return {
        date: iso,
        bhc: { totalPatients: allPatients.length, activePatients: activePatients.length, sessionsThisWeek: sessionsThisWeek.length, sessionsToday: sessionsToday.length, highRiskCount, pendingApprovals: pendingApprovals.length },
        revenue: { totalClaims: allClaims.length, totalBilled, totalCollected, collectionRate, deniedClaims: allClaims.filter((c) => c.status === "denied").length, appealedClaims: allClaims.filter((c) => c.status === "appealed").length },
        campus: { totalBeds, occupiedBeds, occupancyRate, facilityCount: facilityRows.length },
        mgma: { domainCount: mgmaDomainRows.length, kpiCount: mgmaKPIRows.length, domains: mgmaDomainRows.map((d) => ({ id: d.id, name: d.domainName, number: d.domainNumber, progress: kpiByDomain[d.id] ? Math.round((kpiByDomain[d.id].onTarget / kpiByDomain[d.id].total) * 100) : 0 })) },
        part2: { activeSUDRecords: activeSUD, totalSUDRecords: sudRecordRows.length, validConsents, expiredConsents, activeQSOAs: activeQSOA, totalQSOAs: qsoaRows.length, recentAudits: auditLogEntries.length },
        documents: { total: allDocs.length, published: publishedDocs, draft: draftDocs },
        nil: { entityCount: nilEntityRows.length, relationshipCount: nilRelationRows.length },
      };
    }),

    // ─── D010-01: Operational KPIs ────────────────────────────
    operationalKPIs: publicQuery.query(async () => {
      const db = getDb();
      const now = new Date();
      const iso = now.toISOString();
      const todayStr = iso.split("T")[0];
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

      // 1. Census from patients table (active patients)
      const allPatients = await db.select().from(patients).all();
      const census = allPatients.filter((p) => p.status === "active").length;

      // 2. Open cases from treatment_plans
      const allPlans = await db.select().from(treatmentPlans).all();
      const openCases = allPlans.filter((p) => p.status === "active" || p.status === "draft").length;

      // 3. Pending documentation from clinical_sessions
      const allSessions = await db.select().from(clinicalSessions).all();
      const pendingDocumentation = allSessions.filter(
        (s) => s.status === "completed" && (!s.sessionNotes || s.sessionNotes.length < 10)
      ).length;

      // 4. Staff on duty from shifts (today's shifts that are in_progress)
      const todayShifts = await db.select().from(shifts).all().then((rows) =>
        rows.filter((s) => s.shiftDate === todayStr && (s.status === "in_progress" || s.status === "scheduled"))
      );
      const staffOnDuty = todayShifts.reduce((sum, s) => {
        let count = 0;
        if (s.rcsLeadId) count++;
        if (s.rcsStaffIdsJson) {
          try { const ids = JSON.parse(s.rcsStaffIdsJson); count += (Array.isArray(ids) ? ids.length : 0); } catch { /* ignore */ }
        }
        if (s.nurseId) count++;
        if (s.clinicianOnCall) count++;
        return sum + count;
      }, 0);

      // 5. Today's sessions from clinical_sessions
      const todaysSessions = allSessions.filter((s) => s.sessionDate.startsWith(todayStr)).length;

      // 6. Open incidents from incidents
      const allIncidentsRows = await db.select().from(incidents).all();
      const openIncidents = allIncidentsRows.filter((i) => i.status === "open" || i.status === "under_investigation").length;

      return { census, openCases, pendingDocumentation, staffOnDuty, todaysSessions, openIncidents };
    }),

    // ─── D010-02: Compliance KPIs ─────────────────────────────
    complianceKPIs: publicQuery.query(async () => {
      const db = getDb();
      const now = new Date();
      const iso = now.toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

      // 1. Open CAPs from corrective_actions
      const allCaps = await db.select().from(correctiveActions).all();
      const openCAPs = allCaps.filter((a) => a.status === "open" || a.status === "in_progress" || a.status === "overdue").length;

      // 2. Upcoming audits from audits_qa (planned + in_progress)
      const allAudits = await db.select().from(auditsTable).all();
      const upcomingAudits = allAudits.filter((a) => a.status === "planned" || a.status === "in_progress").length;

      // 3. Overdue items from various tables
      const overdueCAPs = allCaps.filter((a) => a.status === "overdue" || (a.dueDate && a.dueDate < iso && a.status !== "completed")).length;
      const overdueAudits = allAudits.filter((a) => a.dueDate && a.dueDate < iso && a.status !== "completed" && a.status !== "closed").length;
      const overdueItems = overdueCAPs + overdueAudits;

      // 4. Compliance score (calculated from audits avg score, normalized)
      const completedAudits = allAudits.filter((a) => a.score != null);
      const avgAuditScore = completedAudits.length > 0
        ? Math.round(completedAudits.reduce((s, a) => s + (a.score ?? 0), 0) / completedAudits.length)
        : 0;
      const complianceScore = avgAuditScore > 0 ? avgAuditScore : Math.round(100 - (overdueItems * 5));

      // 5. Expiring credentials from credentials
      const allCredentials = await db.select().from(credentialsTable).all();
      const expiringCredentials = allCredentials.filter((c) => {
        if (!c.expiryDate) return false;
        const days = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / 86400000);
        return c.status === "expiring" || (c.status === "valid" && days <= 90 && days > 0);
      }).length;

      // 6. Incident count 30d from incidents
      const allIncidentsRows = await db.select().from(incidents).all();
      const incidentCount30d = allIncidentsRows.filter((i) => i.occurredAt >= thirtyDaysAgo).length;

      return { openCAPs, upcomingAudits, overdueItems, complianceScore, expiringCredentials, incidentCount30d };
    }),

    // ─── D010-03: Clinical KPIs ───────────────────────────────
    clinicalKPIs: publicQuery.query(async () => {
      const db = getDb();
      const now = new Date();
      const iso = now.toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

      // 1. Avg LOS from patients (active patients with intakeDate)
      const allPatients = await db.select().from(patients).all();
      const activePatients = allPatients.filter((p) => p.status === "active" && p.intakeDate);
      const avgLOS = activePatients.length > 0
        ? Math.round(activePatients.reduce((sum, p) => {
            const days = Math.ceil((now.getTime() - new Date(p.intakeDate!).getTime()) / 86400000);
            return sum + days;
          }, 0) / activePatients.length)
        : 0;

      // 2. Treatment plan completion rate
      const allPlans = await db.select().from(treatmentPlans).all();
      const completedPlans = allPlans.filter((p) => p.status === "completed").length;
      const planCompletionRate = allPlans.length > 0 ? Math.round((completedPlans / allPlans.length) * 100) : 0;

      // 3. Outcome measure trends (count of measures in last 30 days)
      const allOutcomes = await db.select().from(outcomeMeasures).all();
      const recentOutcomes = allOutcomes.filter((o) => o.administeredAt >= thirtyDaysAgo).length;

      // 4. Readmission rate (patients re-admitted within 30 days of discharge)
      const dischargedPatients = allPatients.filter((p) => p.status === "discharged" && p.dischargeDate);
      const readmissions = dischargedPatients.filter((p) => {
        if (!p.dischargeDate || !p.intakeDate) return false;
        const dischargeTime = new Date(p.dischargeDate).getTime();
        const reIntakeTime = new Date(p.intakeDate).getTime();
        return reIntakeTime > dischargeTime && (reIntakeTime - dischargeTime) < 30 * 86400000;
      }).length;
      const readmissionRate = dischargedPatients.length > 0 ? Math.round((readmissions / dischargedPatients.length) * 100) : 0;

      // 5. Session completion rate
      const allSessions = await db.select().from(clinicalSessions).all();
      const completedSessions = allSessions.filter((s) => s.status === "completed").length;
      const totalSessions = allSessions.filter((s) => s.status !== "cancelled").length;
      const sessionCompletionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

      // 6. Authorization status (% approved)
      const allAuths = await db.select().from(authorizations).all();
      const approvedAuths = allAuths.filter((a) => a.status === "approved").length;
      const authorizationStatus = allAuths.length > 0 ? Math.round((approvedAuths / allAuths.length) * 100) : 0;

      return { avgLOS, planCompletionRate, outcomeMeasureTrends: recentOutcomes, readmissionRate, sessionCompletionRate, authorizationStatus };
    }),

    // ─── D010-04: Revenue KPIs ────────────────────────────────
    revenueKPIs: publicQuery.query(async () => {
      const db = getDb();
      const now = new Date();
      const iso = now.toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

      // 1. Claims submitted 30d
      const allClaims = await db.select().from(claimsTable).all();
      const claimsSubmitted30d = allClaims.filter((c) => c.submissionDate && c.submissionDate >= thirtyDaysAgo).length;

      // 2. Approval rate
      const decidedClaims = allClaims.filter((c) => c.status === "approved" || c.status === "paid" || c.status === "denied");
      const approvedClaims = allClaims.filter((c) => c.status === "approved" || c.status === "paid").length;
      const approvalRate = decidedClaims.length > 0 ? Math.round((approvedClaims / decidedClaims.length) * 100) : 0;

      // 3. Denial rate
      const deniedClaims = allClaims.filter((c) => c.status === "denied").length;
      const denialRate = decidedClaims.length > 0 ? Math.round((deniedClaims / decidedClaims.length) * 100) : 0;

      // 4. Avg days to payment (for paid claims)
      const paidClaims = allClaims.filter((c) => c.status === "paid" && c.submissionDate);
      const avgDaysToPayment = paidClaims.length > 0
        ? Math.round(paidClaims.reduce((sum, c) => {
            const submitted = new Date(c.submissionDate!).getTime();
            const paid = c.updatedAt ? new Date(c.updatedAt).getTime() : now.getTime();
            return sum + Math.max(0, Math.ceil((paid - submitted) / 86400000));
          }, 0) / paidClaims.length)
        : 0;

      // 5. Outstanding AR (submitted + approved + pending_review claims not yet paid)
      const outstandingAR = allClaims
        .filter((c) => ["submitted", "acknowledged", "pending_review", "approved"].includes(c.status))
        .reduce((sum, c) => sum + (c.totalAmount ?? 0), 0);

      // 6. Authorization expiry 30d
      const allAuths = await db.select().from(authorizations).all();
      const next30Days = new Date(now.getTime() + 30 * 86400000).toISOString();
      const authorizationExpiry30d = allAuths.filter((a) => {
        if (!a.approvedToDate) return false;
        return a.approvedToDate >= iso && a.approvedToDate <= next30Days;
      }).length;

      return { claimsSubmitted30d, approvalRate, denialRate, avgDaysToPayment, outstandingAR, authorizationExpiry30d };
    }),

    // ─── D010-05: Workforce KPIs ──────────────────────────────
    workforceKPIs: publicQuery.query(async () => {
      const db = getDb();
      const now = new Date();
      const iso = now.toISOString();
      const twelveMonthsAgo = new Date(now.getTime() - 365 * 86400000).toISOString();

      // 1. Total staff from hr_people
      const allPeople = await db.select().from(hrPeople).all();
      const totalStaff = allPeople.filter((p) => p.isEmployee).length;

      // 2. Open positions (non-employee candidates in pipeline)
      const openPositions = allPeople.filter((p) => !p.isEmployee && p.isActive).length;

      // 3. Credential compliance rate
      const allCredentials = await db.select().from(credentialsTable).all();
      const validCredentials = allCredentials.filter((c) => c.status === "valid").length;
      const credentialComplianceRate = allCredentials.length > 0 ? Math.round((validCredentials / allCredentials.length) * 100) : 0;

      // 4. Training completion rate
      const allModules = await db.select().from(trainingModules).all();
      const allProgress = await db.select().from(trainingProgress).all();
      const completedTraining = allProgress.filter((p) => p.status === "completed").length;
      const totalTrainingAssignments = allProgress.length || allModules.length;
      const trainingCompletionRate = totalTrainingAssignments > 0 ? Math.round((completedTraining / totalTrainingAssignments) * 100) : 0;

      // 5. Turnover rate 12m (people who were active but are no longer employees)
      const formerlyEmployed = allPeople.filter((p) => {
        if (!p.hireDate) return false;
        return p.hireDate >= twelveMonthsAgo && !p.isActive;
      }).length;
      const turnoverRate12m = totalStaff > 0 ? Math.round((formerlyEmployed / (totalStaff + formerlyEmployed)) * 100) : 0;

      // 6. Pending separations from separation_checklists
      const allSeparations = await db.select().from(separationChecklists).all();
      const pendingSeparations = allSeparations.filter((s) => !s.completed).length;

      return { totalStaff, openPositions, credentialComplianceRate, trainingCompletionRate, turnoverRate12m, pendingSeparations };
    }),

    // ─── D010-06: Executive KPIs ──────────────────────────────
    executiveKPIs: publicQuery.query(async () => {
      const db = getDb();
      const now = new Date();
      const iso = now.toISOString();
      const monthStart = iso.slice(0, 8) + "01T00:00:00.000Z";

      // 1. Revenue MTD
      const allClaims = await db.select().from(claimsTable).all();
      const revenueMTD = allClaims
        .filter((c) => c.submissionDate && c.submissionDate >= monthStart)
        .reduce((sum, c) => sum + (c.totalAmount ?? 0), 0);

      // 2. Operating census (% of beds occupied)
      const facilityRows = await db.select().from(facilities).all();
      const bedRows = await db.select().from(bedCensusV2).all();
      const totalBeds = facilityRows.reduce((sum, f) => sum + (f.operationalCapacity ?? f.totalBeds ?? 0), 0);
      const occupiedBeds = bedRows.filter((b) => b.isOccupied).length;
      const operatingCensus = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      // 3. Compliance posture (composite score from audits, CAPs, credentials)
      const allAudits = await db.select().from(auditsTable).all();
      const allCaps = await db.select().from(correctiveActions).all();
      const allCredentials = await db.select().from(credentialsTable).all();
      const completedAudits = allAudits.filter((a) => a.score != null);
      const avgAuditScore = completedAudits.length > 0
        ? Math.round(completedAudits.reduce((s, a) => s + (a.score ?? 0), 0) / completedAudits.length)
        : 100;
      const overdueCAPs = allCaps.filter((a) => a.status === "overdue" || (a.dueDate && a.dueDate < iso && a.status !== "completed")).length;
      const expiredCreds = allCredentials.filter((c) => c.status === "expired").length;
      const compliancePosture = Math.max(0, Math.min(100, avgAuditScore - (overdueCAPs * 5) - (expiredCreds * 3)));

      // 4. Critical risks (high/critical open incidents + high-risk patients)
      const allIncidentsRows = await db.select().from(incidents).all();
      const criticalIncidents = allIncidentsRows.filter(
        (i) => (i.severity === "high" || i.severity === "critical") && (i.status === "open" || i.status === "under_investigation")
      ).length;
      const allSessions = await db.select().from(clinicalSessions).all();
      let highRiskPatients = 0;
      const riskPatientIds = new Set<string>();
      for (const s of allSessions) {
        if (!s.riskAssessmentJson || riskPatientIds.has(s.patientId)) continue;
        try {
          const risk = JSON.parse(s.riskAssessmentJson);
          if (risk.suicideRisk === "high" || risk.homocideRisk === "high" || risk.elopementRisk === "high") {
            riskPatientIds.add(s.patientId);
            highRiskPatients++;
          }
        } catch { /* ignore */ }
      }
      const criticalRisks = criticalIncidents + highRiskPatients;

      // 5. Staffing level (staff on duty vs total staff %)
      const allPeople = await db.select().from(hrPeople).all();
      const activeStaff = allPeople.filter((p) => p.isEmployee && p.isActive).length;
      const todayStr = iso.split("T")[0];
      const todayShifts = await db.select().from(shifts).all().then((rows) =>
        rows.filter((s) => s.shiftDate === todayStr && (s.status === "in_progress" || s.status === "scheduled"))
      );
      const staffOnDuty = todayShifts.reduce((sum, s) => {
        let count = 0;
        if (s.rcsLeadId) count++;
        if (s.rcsStaffIdsJson) {
          try { const ids = JSON.parse(s.rcsStaffIdsJson); count += (Array.isArray(ids) ? ids.length : 0); } catch { /* ignore */ }
        }
        if (s.nurseId) count++;
        return sum + count;
      }, 0);
      const staffingLevel = activeStaff > 0 ? Math.round((staffOnDuty / Math.max(activeStaff, 1)) * 100) : 0;

      // 6. Strategic project status (MGMA domain progress average)
      const mgmaDomainRows = await db.select().from(mgmaDomains).all();
      const mgmaKPIRows = await db.select().from(mgmaKpiTargets).all();
      const kpiByDomain: Record<string, { total: number; onTarget: number }> = {};
      for (const k of mgmaKPIRows) {
        if (!kpiByDomain[k.domainId]) kpiByDomain[k.domainId] = { total: 0, onTarget: 0 };
        kpiByDomain[k.domainId].total++;
        if (k.status === "on_target" || k.status === "at_risk") kpiByDomain[k.domainId].onTarget++;
      }
      const domainProgress = mgmaDomainRows.map((d) => ({
        name: d.domainName,
        progress: kpiByDomain[d.id] ? Math.round((kpiByDomain[d.id].onTarget / kpiByDomain[d.id].total) * 100) : 0,
      }));
      const strategicProjectStatus = domainProgress.length > 0
        ? Math.round(domainProgress.reduce((s, d) => s + d.progress, 0) / domainProgress.length)
        : 0;

      return { revenueMTD, operatingCensus, compliancePosture, criticalRisks, staffingLevel, strategicProjectStatus, domainProgress };
    }),
  }),
});

export type AppRouter = typeof appRouter;
