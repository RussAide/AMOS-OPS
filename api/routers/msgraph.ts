import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

// ─── Mock Microsoft Graph Client ───────────────────────────
// Simulates Entra ID responses for demo/pilot mode

interface MockGraphUser {
  id: string;
  displayName: string;
  givenName: string;
  surname: string;
  userPrincipalName: string;
  mail: string;
  jobTitle: string;
  department: string;
  accountEnabled: boolean;
}

interface MockGraphGroup {
  id: string;
  displayName: string;
  description: string;
  groupType: string;
  securityEnabled: boolean;
  mailEnabled: boolean;
  memberCount: number;
}

interface CountRow {
  c: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mockGraphUsers(): MockGraphUser[] {
  const depts = ["Executive", "Clinical", "HR", "Compliance", "Operations", "GRO Residential", "IT"];
  const firstNames = ["Patricia", "James", "Maria", "Robert", "Linda", "William", "Barbara", "Michael", "Susan", "David"];
  const lastNames = ["Anderson", "Martinez", "Thompson", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee", "Walker", "Hall"];
  return Array.from({ length: 12 }, (_, i) => ({
    id: randomUUID(),
    displayName: `${firstNames[i]} ${lastNames[i]}`,
    givenName: firstNames[i],
    surname: lastNames[i],
    userPrincipalName: `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}@amos-ops.invalid`,
    mail: `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}@amos-ops.invalid`,
    jobTitle: ["Program Director", "HR Director", "Clinical Director", "Residential Supervisor", "QA Officer", "Operations Manager", "Training Coordinator", "Clinical Supervisor", "Compliance Officer", "IT Administrator", "Case Manager", "Billing Coordinator"][i],
    department: depts[i % depts.length],
    accountEnabled: true,
  }));
}

function mockGraphGroups(): MockGraphGroup[] {
  return [
    { id: randomUUID(), displayName: "AMOS-OPS-Administrators", description: "Full system access", groupType: "Security", securityEnabled: true, mailEnabled: false, memberCount: 2 },
    { id: randomUUID(), displayName: "AMOS-OPS-HR-Directors", description: "HR lifecycle management", groupType: "Security", securityEnabled: true, mailEnabled: false, memberCount: 3 },
    { id: randomUUID(), displayName: "AMOS-OPS-Clinical-Directors", description: "Clinical oversight", groupType: "Security", securityEnabled: true, mailEnabled: false, memberCount: 2 },
    { id: randomUUID(), displayName: "AMOS-OPS-Supervisors", description: "Team supervision", groupType: "Security", securityEnabled: true, mailEnabled: false, memberCount: 5 },
    { id: randomUUID(), displayName: "AMOS-OPS-All-Staff", description: "All employees", groupType: "Security", securityEnabled: true, mailEnabled: false, memberCount: 12 },
    { id: randomUUID(), displayName: "AMOS-Compliance", description: "QA and compliance team", groupType: "Security", securityEnabled: true, mailEnabled: false, memberCount: 2 },
  ];
}

export const msGraphRouter = createRouter({
  // ─── Status ────────────────────────────────────────────────

  status: publicQuery.query(async () => {
    const userCount = (sqlite.prepare("SELECT COUNT(*) as c FROM ms_graph_users").get() as CountRow | undefined)?.c ?? 0;
    const groupCount = (sqlite.prepare("SELECT COUNT(*) as c FROM ms_graph_groups").get() as CountRow | undefined)?.c ?? 0;
    const lastSync = sqlite.prepare("SELECT * FROM ms_graph_sync_log ORDER BY started_at DESC LIMIT 1").get();
    return {
      connected: true,
      tenant: "adolbi.onmicrosoft.com",
      syncMode: "mock",
      users: { synced: userCount, total: 12 },
      groups: { synced: groupCount, total: 6 },
      lastSync: lastSync ?? null,
    };
  }),

  // ─── Full Sync ─────────────────────────────────────────────

  sync: adminQuery
    .input(z.object({ type: z.enum(["full", "users", "groups"]).default("full") }).optional())
    .mutation(async ({ input }) => {
      const syncType = input?.type ?? "full";
      const logId = randomUUID();
      const errors: string[] = [];

      sqlite.prepare(
        "INSERT INTO ms_graph_sync_log (id, sync_type, status, started_at) VALUES (?, ?, 'running', datetime('now'))"
      ).run(logId, syncType);

      let usersSynced = 0;
      let groupsSynced = 0;

      try {
        if (syncType === "full" || syncType === "users") {
          if (syncType === "full") sqlite.exec("DELETE FROM ms_graph_users");
          const users = mockGraphUsers();
          for (const u of users) {
            try {
              sqlite.prepare(
                `INSERT OR REPLACE INTO ms_graph_users (id, entra_id, display_name, given_name, surname, user_principal_name, mail, job_title, department, account_enabled, sync_status, last_sync_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`
              ).run(randomUUID(), u.id, u.displayName, u.givenName, u.surname, u.userPrincipalName, u.mail, u.jobTitle, u.department, u.accountEnabled ? 1 : 0);
              usersSynced++;
            } catch (error: unknown) {
              errors.push(`User ${u.displayName}: ${errorMessage(error)}`);
            }
          }
        }

        if (syncType === "full" || syncType === "groups") {
          if (syncType === "full") sqlite.exec("DELETE FROM ms_graph_groups");
          const groups = mockGraphGroups();
          for (const g of groups) {
            try {
              sqlite.prepare(
                `INSERT OR REPLACE INTO ms_graph_groups (id, entra_id, display_name, description, group_type, security_enabled, mail_enabled, member_count, last_sync_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
              ).run(randomUUID(), g.id, g.displayName, g.description, g.groupType, g.securityEnabled ? 1 : 0, g.mailEnabled ? 1 : 0, g.memberCount);
              groupsSynced++;
            } catch (error: unknown) {
              errors.push(`Group ${g.displayName}: ${errorMessage(error)}`);
            }
          }
        }

        sqlite.prepare(
          "UPDATE ms_graph_sync_log SET status = ?, users_synced = ?, groups_synced = ?, errors_json = ?, completed_at = datetime('now') WHERE id = ?"
        ).run(errors.length > 0 ? "partial" : "completed", usersSynced, groupsSynced, errors.length > 0 ? JSON.stringify(errors) : null, logId);

      } catch (error: unknown) {
        sqlite.prepare(
          "UPDATE ms_graph_sync_log SET status = 'failed', errors_json = ?, completed_at = datetime('now') WHERE id = ?"
        ).run(JSON.stringify([errorMessage(error)]), logId);
        throw error;
      }

      return { usersSynced, groupsSynced, errors: errors.length > 0 ? errors : undefined };
    }),

  // ─── List Synced Users ─────────────────────────────────────

  listUsers: publicQuery
    .input(z.object({ department: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM ms_graph_users WHERE 1=1";
      const params: unknown[] = [];
      if (input?.department) { sql += " AND department = ?"; params.push(input.department); }
      if (input?.status) { sql += " AND sync_status = ?"; params.push(input.status); }
      sql += " ORDER BY display_name";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  // ─── List Synced Groups ────────────────────────────────────

  listGroups: publicQuery.query(async () => {
    return sqlite.prepare("SELECT * FROM ms_graph_groups ORDER BY display_name").all() ?? [];
  }),

  // ─── Sync History ──────────────────────────────────────────

  syncHistory: publicQuery.query(async () => {
    return sqlite.prepare("SELECT * FROM ms_graph_sync_log ORDER BY started_at DESC LIMIT 20").all() ?? [];
  }),
});
