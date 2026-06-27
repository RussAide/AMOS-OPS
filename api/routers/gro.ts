import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

function generateRefNumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  return `REF-${year}-${seq}`;
}

export const groRouter = createRouter({
  // ─── Referrals ─────────────────────────────────────────────

  listReferrals: publicQuery
    .input(z.object({ status: z.string().optional(), source: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM referrals";
      const conditions: string[] = [];
      const params: any[] = [];
      if (input?.status) { conditions.push("status = ?"); params.push(input.status); }
      if (input?.source) { conditions.push("referral_source = ?"); params.push(input.source); }
      if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
      sql += " ORDER BY created_at DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  getReferral: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return sqlite.prepare("SELECT * FROM referrals WHERE id = ?").get(input.id) ?? null;
    }),

  createReferral: publicQuery
    .input(z.object({
      patientName: z.string().min(1),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      referralSource: z.string().min(1),
      sourceDetail: z.string().optional(),
      referralType: z.string().optional(),
      assignedTo: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = randomUUID();
      const refNum = generateRefNumber();
      sqlite.prepare(
        "INSERT INTO referrals (id, referral_number, patient_name, contact_phone, contact_email, referral_source, source_detail, referral_type, status, assigned_to, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, datetime('now'), datetime('now'))"
      ).run(id, refNum, input.patientName, input.contactPhone ?? null, input.contactEmail ?? null, input.referralSource, input.sourceDetail ?? null, input.referralType ?? null, input.assignedTo ?? null, input.notes ?? null);
      return sqlite.prepare("SELECT * FROM referrals WHERE id = ?").get(id);
    }),

  updateReferral: publicQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["new", "in_review", "active", "converted", "deferred", "closed"]).optional(),
      assignedTo: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      if (updates.status) sqlite.prepare("UPDATE referrals SET status = ?, updated_at = datetime('now') WHERE id = ?").run(updates.status, id);
      if (updates.assignedTo) sqlite.prepare("UPDATE referrals SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?").run(updates.assignedTo, id);
      if (updates.notes) sqlite.prepare("UPDATE referrals SET notes = ?, updated_at = datetime('now') WHERE id = ?").run(updates.notes, id);
      return sqlite.prepare("SELECT * FROM referrals WHERE id = ?").get(id);
    }),

  // ─── Partnerships ──────────────────────────────────────────

  listPartnerships: publicQuery
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async () => {
      return sqlite.prepare("SELECT * FROM partnerships WHERE status = 'active' OR status = 'pending' ORDER BY created_at DESC").all() ?? [];
    }),

  createPartnership: publicQuery
    .input(z.object({
      organizationName: z.string().min(1),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      partnershipType: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = randomUUID();
      sqlite.prepare(
        "INSERT INTO partnerships (id, organization_name, contact_name, contact_phone, contact_email, partnership_type, status, start_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), ?, datetime('now'))"
      ).run(id, input.organizationName, input.contactName ?? null, input.contactPhone ?? null, input.contactEmail ?? null, input.partnershipType ?? null, input.notes ?? null);
      return sqlite.prepare("SELECT * FROM partnerships WHERE id = ?").get(id);
    }),

  // ─── Campaigns ─────────────────────────────────────────────

  listCampaigns: publicQuery
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async () => {
      return sqlite.prepare("SELECT * FROM outreach_campaigns ORDER BY created_at DESC").all() ?? [];
    }),

  // ─── Dashboard ─────────────────────────────────────────────

  dashboardKPIs: publicQuery.query(async () => {
    const refResult = sqlite.prepare("SELECT status, COUNT(*) as count FROM referrals GROUP BY status").all() ?? [];
    const totalReferrals = sqlite.prepare("SELECT COUNT(*) as count FROM referrals").get() as any;
    const activeReferrals = sqlite.prepare("SELECT COUNT(*) as count FROM referrals WHERE status IN ('new', 'in_review', 'active')").get() as any;
    const convertedReferrals = sqlite.prepare("SELECT COUNT(*) as count FROM referrals WHERE status = 'converted'").get() as any;
    const newThisMonth = sqlite.prepare("SELECT COUNT(*) as count FROM referrals WHERE created_at > datetime('now', '-30 days')").get() as any;
    const partnershipResult = sqlite.prepare("SELECT COUNT(*) as count FROM partnerships WHERE status = 'active'").get() as any;
    const campaignResult = sqlite.prepare("SELECT COUNT(*) as count FROM outreach_campaigns WHERE status = 'active'").get() as any;
    const leadsResult = sqlite.prepare("SELECT SUM(leads_generated) as total FROM outreach_campaigns").get() as any;
    const convResult = sqlite.prepare("SELECT SUM(conversions) as total FROM outreach_campaigns").get() as any;

    const total = totalReferrals?.count ?? 0;
    const converted = convertedReferrals?.count ?? 0;

    return {
      totalReferrals: total,
      activeReferrals: activeReferrals?.count ?? 0,
      newThisMonth: newThisMonth?.count ?? 0,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      activePartnerships: partnershipResult?.count ?? 0,
      activeCampaigns: campaignResult?.count ?? 0,
      totalLeads: leadsResult?.total ?? 0,
      totalConversions: convResult?.total ?? 0,
      statusBreakdown: (refResult as any[]).reduce((acc: Record<string, number>, row: any) => { acc[row.status] = row.count; return acc; }, {}),
    };
  }),
});
