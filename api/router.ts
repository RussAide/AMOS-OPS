import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { sqlite } from "./queries/connection";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const SALT = 10;
function hash(pwd: string) { return bcrypt.hashSync(pwd, SALT); }
function all(table: string): any[] { try { return sqlite.prepare(`SELECT * FROM ${table} LIMIT 50`).all() ?? []; } catch { return []; } }
function cnt(table: string): number { try { return (sqlite.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any)?.c ?? 0; } catch { return 0; } }

// ─── AUTH ──────────────────────────────────────────────────
const authRouter = createRouter({
  seedAdmin: publicQuery.mutation(async () => {
    const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("admin@adolbi.com");
    if (existing) return { created: false, message: "Admin already exists" };
    const id = randomUUID();
    sqlite.prepare("INSERT INTO users (id, email, password_hash, first_name, last_name, role, department, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))")
      .run(id, "admin@adolbi.com", hash("admin123"), "System", "Administrator", "administrator", "IT");
    return { created: true, email: "admin@adolbi.com", password: "admin123" };
  }),
  login: publicQuery.input(z.object({ email: z.string().email(), password: z.string() })).mutation(async ({ input }) => {
    const user = sqlite.prepare("SELECT * FROM users WHERE email = ? AND is_active = 1").get(input.email) as any;
    if (!user || !bcrypt.compareSync(input.password, user.password_hash)) throw new Error("Invalid credentials");
    const token = randomUUID();
    sqlite.prepare("INSERT OR REPLACE INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))").run(randomUUID(), user.id, token);
    return { token, user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, name: `${user.first_name} ${user.last_name}`, role: user.role } };
  }),
  me: publicQuery.input(z.object({ token: z.string() }).optional()).query(async ({ input }) => {
    if (!input?.token) return null;
    const row = sqlite.prepare("SELECT u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')").get(input.token) as any;
    if (!row) return null;
    return { id: row.id, email: row.email, firstName: row.first_name, lastName: row.last_name, name: `${row.first_name} ${row.last_name}`, role: row.role };
  }),
  logout: publicQuery.input(z.object({ token: z.string() })).mutation(async ({ input }) => {
    sqlite.prepare("DELETE FROM sessions WHERE token = ?").run(input.token);
    return { success: true };
  }),
  register: publicQuery.input(z.object({ email: z.string().email(), password: z.string().min(6), firstName: z.string(), lastName: z.string(), role: z.string().optional(), department: z.string().optional() })).mutation(async ({ input }) => {
    const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(input.email);
    if (existing) throw new Error("Email already registered");
    const id = randomUUID();
    sqlite.prepare("INSERT INTO users (id, email, password_hash, first_name, last_name, role, department, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))")
      .run(id, input.email, hash(input.password), input.firstName, input.lastName, input.role ?? "staff", input.department ?? null);
    const token = randomUUID();
    sqlite.prepare("INSERT OR REPLACE INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))").run(randomUUID(), id, token);
    return { token, user: { id, email: input.email, firstName: input.firstName, lastName: input.lastName, name: `${input.firstName} ${input.lastName}`, role: input.role ?? "staff" } };
  }),
});

// ─── HR ────────────────────────────────────────────────────
const hrRouter = createRouter({
  list: publicQuery.query(() => all("hr_people")),
  dashboardKPIs: publicQuery.query(() => ({
    totalPeople: cnt("hr_people"),
    inPipeline: 0,
    activeAlerts: 0,
    avgDaysToClear: 0,
    recentActivity: 0,
    avgCompletion: 0,
  })),
});

// ─── BHC CLINICAL ──────────────────────────────────────────
const bhcRouter = createRouter({
  listPatients: publicQuery.input(z.object({ pageSize: z.number().optional(), status: z.string().optional() }).optional()).query(() => all("patients")),
  dashboardKPIs: publicQuery.query(() => ({
    activePatients: cnt("patients"),
    sessionsThisWeek: 0,
    totalPatients: cnt("patients"),
    pendingApprovals: 0,
    highRiskFlags: 0,
  })),
  listPlans: publicQuery.query(() => all("treatment_plans")),
  listSessions: publicQuery.input(z.object({ status: z.string().optional() }).optional()).query(() => all("clinical_sessions")),
  clinicianWorkload: publicQuery.query(() => ({ total: 0, byClinician: [] })),
});

// ─── REVENUE ───────────────────────────────────────────────
const revenueRouter = createRouter({
  listClaims: publicQuery.query(() => all("claims")),
  dashboardKPIs: publicQuery.query(() => ({
    totalClaims: cnt("claims"),
    collectionRate: 0,
    totalBilled: 0,
    totalCollected: 0,
    pendingClaims: 0,
  })),
});

// ─── QA ────────────────────────────────────────────────────
const qaRouter = createRouter({
  listAudits: publicQuery.query(() => all("audits_qa")),
  dashboardKPIs: publicQuery.query(() => ({
    totalAudits: cnt("audits_qa"),
    openIncidents: cnt("incidents"),
    auditScore: 0,
    compliantItems: 0,
  })),
});

// ─── GAD ───────────────────────────────────────────────────
const gadRouter = createRouter({
  listWorkOrders: publicQuery.query(() => all("work_orders")),
  dashboardKPIs: publicQuery.query(() => ({
    openWorkOrders: cnt("work_orders"),
    vendorCount: cnt("vendors"),
    facilityCount: cnt("facilities"),
  })),
});

// ─── GRO ───────────────────────────────────────────────────
const groRouter = createRouter({
  listReferrals: publicQuery.query(() => all("referrals")),
  dashboardKPIs: publicQuery.query(() => ({
    activeReferrals: cnt("referrals"),
    conversionRate: 0,
    newThisMonth: 0,
  })),
});

// ─── NIL ───────────────────────────────────────────────────
const nilRouter = createRouter({
  getStats: publicQuery.query(() => ({
    totalEntities: cnt("nil_entities"),
    totalRelationships: cnt("nil_relationships"),
    entityTypes: [], relationTypes: [], moduleDistribution: [],
  })),
  searchEntities: publicQuery.input(z.object({ query: z.string() })).query(({ input }) => {
    try { return sqlite.prepare("SELECT * FROM nil_entities WHERE display_name LIKE ?").all(`%${input.query}%`) ?? []; } catch { return []; }
  }),
  getEntityNetwork: publicQuery.input(z.object({ entityId: z.string() })).query(() => ({ nodes: [], edges: [], totalNodes: 0, totalEdges: 0 })),
  getRecommendations: publicQuery.query(() => []),
  findPath: publicQuery.query(() => ({ found: false, path: [], hops: 0 })),
  reindex: publicQuery.mutation(async () => ({ entities: 0, relationships: 0 })),
});

// ─── WORKFLOW ──────────────────────────────────────────────
const wfRouter = createRouter({
  listRules: publicQuery.query(() => [
    { id: "hr-status-change", name: "HR Status Change Alert", event: "hr.status-changed", actions: [{ type: "notify", target: "hr-director", priority: "high" }] },
    { id: "doc-expired", name: "Document Expired", event: "document.expired", actions: [{ type: "escalate", target: "supervisor", priority: "urgent" }] },
  ]),
  dashboardKPIs: publicQuery.query(() => ({ totalInstances: 0, pendingInstances: 0, completedInstances: 0, rejectedInstances: 0, pendingApprovals: 0 })),
  listInstances: publicQuery.query(() => []),
  listPendingApprovals: publicQuery.query(() => []),
  auditLog: publicQuery.query(() => []),
  trigger: publicQuery.input(z.object({ ruleId: z.string(), triggerData: z.string() })).mutation(async () => ({ instanceId: randomUUID(), approvalsCreated: 0 })),
  respondApproval: publicQuery.input(z.object({ approvalId: z.string(), decision: z.enum(["approved", "rejected"]), approverId: z.string() })).mutation(async () => ({ success: true, decision: "approved" })),
});

// ─── ENTRA ID ──────────────────────────────────────────────
const entraRouter = createRouter({
  status: publicQuery.query(() => ({ connected: false, tenant: "Not configured", syncMode: "none", users: { synced: 0, total: 0 }, groups: { synced: 0, total: 0 }, lastSync: null })),
  sync: publicQuery.mutation(async () => ({ usersSynced: 0, groupsSynced: 0 })),
  listUsers: publicQuery.query(() => []),
  listGroups: publicQuery.query(() => []),
  syncHistory: publicQuery.query(() => []),
});

// ─── MAIN ROUTER ───────────────────────────────────────────
export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  hr: hrRouter,
  bhc: bhcRouter,
  revenue: revenueRouter,
  qa: qaRouter,
  gad: gadRouter,
  gro: groRouter,
  nil: nilRouter,
  workflow: wfRouter,
  msgraph: entraRouter,
});

export type AppRouter = typeof appRouter;
