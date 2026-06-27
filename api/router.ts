import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { sqlite } from "./queries/connection";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const SALT = 10;
function hash(pwd: string) { return bcrypt.hashSync(pwd, SALT); }

// Safely get count from any table
function count(table: string): number {
  try { return (sqlite.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any)?.c ?? 0; } catch { return 0; }
}

// Auth sub-router
const authRouter = createRouter({
  seedAdmin: publicQuery.mutation(async () => {
    try {
      const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("admin@adolbi.com");
      if (existing) return { created: false, message: "Admin already exists" };
      const id = randomUUID();
      sqlite.prepare("INSERT INTO users (id, email, password_hash, first_name, last_name, role, department, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))")
        .run(id, "admin@adolbi.com", hash("admin123"), "System", "Administrator", "administrator", "IT");
      return { created: true, email: "admin@adolbi.com", password: "admin123" };
    } catch (e: any) {
      return { created: false, message: e.message };
    }
  }),

  login: publicQuery
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => {
      const user = sqlite.prepare("SELECT * FROM users WHERE email = ? AND is_active = 1").get(input.email) as any;
      if (!user || !bcrypt.compareSync(input.password, user.password_hash)) throw new Error("Invalid credentials");
      const token = randomUUID();
      sqlite.prepare("INSERT OR REPLACE INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))").run(randomUUID(), user.id, token);
      return { token, user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, name: `${user.first_name} ${user.last_name}`, role: user.role } };
    }),

  me: publicQuery
    .input(z.object({ token: z.string() }).optional())
    .query(async ({ input }) => {
      if (!input?.token) return null;
      const row = sqlite.prepare("SELECT u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')").get(input.token) as any;
      if (!row) return null;
      return { id: row.id, email: row.email, firstName: row.first_name, lastName: row.last_name, name: `${row.first_name} ${row.last_name}`, role: row.role };
    }),

  logout: publicQuery.input(z.object({ token: z.string() })).mutation(async ({ input }) => {
    sqlite.prepare("DELETE FROM sessions WHERE token = ?").run(input.token);
    return { success: true };
  }),
});

// Dashboard KPIs router
const dashboardRouter = createRouter({
  kpis: publicQuery.query(() => {
    return {
      totalPatients: count("patients"),
      activePatients: 0,
      totalClaims: count("claims"),
      totalAudits: count("audits_qa"),
      openIncidents: 0,
      openWorkOrders: count("work_orders"),
      vendorCount: count("vendors"),
      activeReferrals: count("referrals"),
      conversionRate: 0,
    };
  }),

  hrPeople: publicQuery.query(() => {
    try { return sqlite.prepare("SELECT * FROM hr_people WHERE is_active = 1 ORDER BY last_name LIMIT 50").all() ?? []; } catch { return []; }
  }),

  patients: publicQuery.query(() => {
    try { return sqlite.prepare("SELECT * FROM patients ORDER BY created_at DESC LIMIT 50").all() ?? []; } catch { return []; }
  }),

  workOrders: publicQuery.query(() => {
    try { return sqlite.prepare("SELECT * FROM work_orders ORDER BY created_at DESC LIMIT 50").all() ?? []; } catch { return []; }
  }),

  vendors: publicQuery.query(() => {
    try { return sqlite.prepare("SELECT * FROM vendors WHERE is_active = 1 ORDER BY name").all() ?? []; } catch { return []; }
  }),

  referrals: publicQuery.query(() => {
    try { return sqlite.prepare("SELECT * FROM referrals ORDER BY created_at DESC LIMIT 50").all() ?? []; } catch { return []; }
  }),

  audits: publicQuery.query(() => {
    try { return sqlite.prepare("SELECT * FROM audits_qa ORDER BY created_at DESC LIMIT 50").all() ?? []; } catch { return []; }
  }),

  claims: publicQuery.query(() => {
    try { return sqlite.prepare("SELECT * FROM claims ORDER BY created_at DESC LIMIT 50").all() ?? []; } catch { return []; }
  }),
});

// Workflow router  
const wfRouter = createRouter({
  listRules: publicQuery.query(() => [
    { id: "hr-status-change", name: "HR Status Change Alert", event: "hr.status-changed", actions: [{ type: "notify", target: "hr-director", priority: "high" }] },
    { id: "doc-expired", name: "Document Expired", event: "document.expired", actions: [{ type: "escalate", target: "supervisor", priority: "urgent" }] },
    { id: "training-done", name: "Training Completed", event: "training.completed", actions: [{ type: "notify", target: "training-coordinator", priority: "medium" }] },
  ]),

  dashboardKPIs: publicQuery.query(() => ({ totalInstances: 0, pendingInstances: 0, completedInstances: 0, rejectedInstances: 0, pendingApprovals: 0 })),

  listInstances: publicQuery.query(() => []),
  listPendingApprovals: publicQuery.query(() => []),
  auditLog: publicQuery.query(() => []),
  
  trigger: publicQuery
    .input(z.object({ ruleId: z.string(), triggerData: z.string() }))
    .mutation(async () => ({ instanceId: randomUUID(), approvalsCreated: 0 })),
    
  respondApproval: publicQuery
    .input(z.object({ approvalId: z.string(), decision: z.enum(["approved", "rejected"]), approverId: z.string() }))
    .mutation(async () => ({ success: true, decision: "approved" })),
});

// Entra ID mock router
const entraRouter = createRouter({
  status: publicQuery.query(() => ({ connected: false, tenant: "Not configured", syncMode: "none", users: { synced: 0, total: 0 }, groups: { synced: 0, total: 0 }, lastSync: null })),
  sync: publicQuery.mutation(async () => ({ usersSynced: 0, groupsSynced: 0 })),
  listUsers: publicQuery.query(() => []),
  listGroups: publicQuery.query(() => []),
  syncHistory: publicQuery.query(() => []),
});

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  dashboard: dashboardRouter,
  workflow: wfRouter,
  msgraph: entraRouter,
});

export type AppRouter = typeof appRouter;
