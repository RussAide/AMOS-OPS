import { z } from "zod";
import { createRouter, authedQuery, auditLog } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

// ─── M15: Case Management Router ─────────────────────────────

interface CountRow {
  c: number;
}

export const m16Router = createRouter({
  listCases: authedQuery
    .input(z.object({ youthId: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM case_management WHERE 1=1";
      const params: unknown[] = [];
      if (input?.youthId) { sql += " AND youth_id = ?"; params.push(input.youthId); }
      if (input?.status) { sql += " AND status = ?"; params.push(input.status); }
      sql += " ORDER BY updated_at DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  getCase: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite.prepare("SELECT * FROM case_management WHERE id = ?").get(input.id);
      return row ?? null;
    }),

  getCaseByYouth: authedQuery
    .input(z.object({ youthId: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite.prepare("SELECT * FROM case_management WHERE youth_id = ? ORDER BY created_at DESC LIMIT 1").get(input.youthId);
      return row ?? null;
    }),

  createCase: authedQuery
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      caseManagerId: z.string().optional(),
      caseManagerName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      sqlite.prepare(`INSERT INTO case_management (
        id, youth_id, youth_name, mrn, case_manager_id, case_manager_name,
        status, next_review_date, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, input.youthId, input.youthName, input.mrn,
        input.caseManagerId ?? null, input.caseManagerName ?? null,
        "active", null, now, now, actor
      );

      auditLog({ action: "m15:createCase", actor, resource: `case:${id}`, details: `Case opened for ${input.youthName}` });
      return { id, ...input, status: "active", createdAt: now };
    }),

  updateCase: authedQuery
    .input(z.object({
      id: z.string(),
      caseManagerId: z.string().optional(),
      caseManagerName: z.string().optional(),
      function1Coordination: z.boolean().optional(),
      function1CoordinationNotes: z.string().optional(),
      function2Referrals: z.boolean().optional(),
      function2ReferralsJson: z.string().optional(),
      function3Collaterals: z.boolean().optional(),
      function3CollateralsJson: z.string().optional(),
      function4Barriers: z.boolean().optional(),
      function4BarriersJson: z.string().optional(),
      function5Monitoring: z.boolean().optional(),
      function5MonitoringNotes: z.string().optional(),
      function6Transition: z.boolean().optional(),
      function6TransitionNotes: z.string().optional(),
      transitionPlanDate: z.string().optional(),
      projectedDischargeDate: z.string().optional(),
      status: z.enum(["active", "on_hold", "pending_review", "closed", "transferred"]).optional(),
      lastReviewDate: z.string().optional(),
      nextReviewDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const fieldMap: Record<string, string> = {
        caseManagerId: "case_manager_id", caseManagerName: "case_manager_name",
        function1Coordination: "function1_coordination", function1CoordinationNotes: "function1_coordination_notes",
        function2Referrals: "function2_referrals", function2ReferralsJson: "function2_referrals_json",
        function3Collaterals: "function3_collaterals", function3CollateralsJson: "function3_collaterals_json",
        function4Barriers: "function4_barriers", function4BarriersJson: "function4_barriers_json",
        function5Monitoring: "function5_monitoring", function5MonitoringNotes: "function5_monitoring_notes",
        function6Transition: "function6_transition", function6TransitionNotes: "function6_transition_notes",
        transitionPlanDate: "transition_plan_date", projectedDischargeDate: "projected_discharge_date",
        status: "status", lastReviewDate: "last_review_date", nextReviewDate: "next_review_date",
      };

      const updates: string[] = [];
      const values: unknown[] = [];
      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) {
          updates.push(`${fieldMap[key] ?? key} = ?`);
          values.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
        }
      }
      if (updates.length > 0) {
        updates.push("updated_at = ?"); updates.push("updated_by = ?");
        values.push(new Date().toISOString(), actor);
        sqlite.prepare(`UPDATE case_management SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
      }
      auditLog({ action: "m15:updateCase", actor, resource: `case:${id}` });
      return { success: true };
    }),

  // ─── Case Management Summary ───────────────────────────────
  caseMgmtSummary: authedQuery.query(async () => {
    const activeCases = sqlite.prepare("SELECT COUNT(*) as c FROM case_management WHERE status = 'active'").get() as CountRow | undefined;
    const onHoldCases = sqlite.prepare("SELECT COUNT(*) as c FROM case_management WHERE status = 'on_hold'").get() as CountRow | undefined;
    const pendingReview = sqlite.prepare("SELECT COUNT(*) as c FROM case_management WHERE status = 'pending_review'").get() as CountRow | undefined;
    const totalCases = sqlite.prepare("SELECT COUNT(*) as c FROM case_management").get() as CountRow | undefined;
    const overdueReviews = sqlite.prepare("SELECT COUNT(*) as c FROM case_management WHERE next_review_date < ? AND status = 'active'").get(new Date().toISOString().split("T")[0]) as CountRow | undefined;

    return {
      activeCases: activeCases?.c ?? 0,
      onHoldCases: onHoldCases?.c ?? 0,
      pendingReview: pendingReview?.c ?? 0,
      totalCases: totalCases?.c ?? 0,
      overdueReviews: overdueReviews?.c ?? 0,
    };
  }),
});
