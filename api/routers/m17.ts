import { z } from "zod";
import { createRouter, authedQuery, auditLog } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

// ─── M15: Crisis Response Router ─────────────────────────────

export const m17Router = createRouter({
  // ─── Crisis Events ─────────────────────────────────────────
  listCrises: authedQuery
    .input(z.object({ youthId: z.string().optional(), status: z.string().optional(), crisisType: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM crisis_events WHERE 1=1";
      const params: any[] = [];
      if (input?.youthId) { sql += " AND youth_id = ?"; params.push(input.youthId); }
      if (input?.status) { sql += " AND overall_status = ?"; params.push(input.status); }
      if (input?.crisisType) { sql += " AND crisis_type = ?"; params.push(input.crisisType); }
      sql += " ORDER BY created_at DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  getCrisis: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const crisis = sqlite.prepare("SELECT * FROM crisis_events WHERE id = ?").get(input.id) as any;
      if (!crisis) return null;
      const debrief = sqlite.prepare("SELECT * FROM crisis_debriefs WHERE crisis_event_id = ?").get(input.id);
      return { ...crisis, debrief };
    }),

  createCrisis: authedQuery
    .input(z.object({
      youthId: z.string(),
      youthName: z.string(),
      mrn: z.string(),
      crisisType: z.enum(["behavioral_escalation", "suicide_self_harm", "medical_emergency", "elopement", "substance_intoxication"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      sqlite.prepare(`INSERT INTO crisis_events (
        id, youth_id, youth_name, mrn, crisis_type,
        step1_identified, step1_identified_at, step1_identified_by,
        current_step, overall_status, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 1, ?, ?, ?, ?)`).run(
        id, input.youthId, input.youthName, input.mrn, input.crisisType,
        now, actor, "active", now, now, actor
      );

      auditLog({
        action: "m15:createCrisis",
        actor,
        resource: `crisis:${id}`,
        details: `Crisis event created: ${input.crisisType} for ${input.youthName}`,
      });

      return { id, ...input, currentStep: 1, overallStatus: "active", createdAt: now };
    }),

  advanceStep: authedQuery
    .input(z.object({
      id: z.string(),
      step: z.number().min(1).max(7),
      data: z.record(z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, step, data } = input;
      const now = new Date().toISOString();

      const stepFields: Record<number, string[]> = {
        1: ["step1_identified", "step1_identified_at", "step1_identified_by"],
        2: ["step2_activated", "step2_activated_at", "step2_activated_by"],
        3: ["step3_responded", "step3_responded_at", "step3_responder_name", "step3_response_actions"],
        4: ["step4_ensured_safety", "step4_safety_measures", "step4_ensured_at"],
        5: ["step5_notified", "step5_notified_parties", "step5_notified_at"],
        6: ["step6_documented", "step6_documented_at", "step6_documentation_ref"],
        7: ["step7_reviewed", "step7_reviewed_at", "step7_reviewed_by", "step7_review_notes"],
      };

      const fields = stepFields[step];
      if (!fields) throw new Error(`Unknown step: ${step}`);

      const updates: string[] = [];
      const values: any[] = [];

      for (const field of fields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(data[field]);
        }
      }

      // Auto-set timestamp fields if not provided
      const timeField = fields.find(f => f.endsWith("_at"));
      if (timeField && !data[timeField]) {
        updates.push(`${timeField} = ?`);
        values.push(now);
      }
      const byField = fields.find(f => f.endsWith("_by"));
      if (byField && !data[byField]) {
        updates.push(`${byField} = ?`);
        values.push(actor);
      }

      // Advance current step
      const newStep = Math.min(step + 1, 7);
      const isComplete = step >= 7;
      updates.push("current_step = ?");
      values.push(newStep);
      if (isComplete) {
        updates.push("overall_status = ?");
        values.push("resolved");
      }

      updates.push("updated_at = ?");
      values.push(now);

      sqlite.prepare(`UPDATE crisis_events SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);

      auditLog({ action: "m15:advanceStep", actor, resource: `crisis:${id}`, details: `Advanced to step ${step}` });
      return { success: true, currentStep: newStep, isComplete };
    }),

  updateCrisisOutcome: authedQuery
    .input(z.object({
      id: z.string(),
      youthInjured: z.boolean().optional(),
      staffInjured: z.boolean().optional(),
      restrictiveInterventionUsed: z.boolean().optional(),
      restrictiveInterventionType: z.enum(["restraint", "seclusion", "prn_medication", "none"]).optional(),
      overallStatus: z.enum(["active", "contained", "resolved", "under_review"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const fieldMap: Record<string, string> = {
        youthInjured: "youth_injured", staffInjured: "staff_injured",
        restrictiveInterventionUsed: "restrictive_intervention_used", restrictiveInterventionType: "restrictive_intervention_type",
        overallStatus: "overall_status",
      };
      const updates: string[] = [];
      const values: any[] = [];
      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) {
          updates.push(`${fieldMap[key]} = ?`);
          values.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
        }
      }
      if (updates.length > 0) {
        updates.push("updated_at = ?"); values.push(new Date().toISOString());
        sqlite.prepare(`UPDATE crisis_events SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
      }
      auditLog({ action: "m15:updateCrisisOutcome", actor, resource: `crisis:${id}` });
      return { success: true };
    }),

  // ─── Crisis Debriefs (SOP Toolkit 6) ───────────────────────
  getDebrief: authedQuery
    .input(z.object({ crisisEventId: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite.prepare("SELECT * FROM crisis_debriefs WHERE crisis_event_id = ?").get(input.crisisEventId);
      return row ?? null;
    }),

  createDebrief: authedQuery
    .input(z.object({
      crisisEventId: z.string(),
      youthId: z.string(),
      youthName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const actorId = ctx.user?.id ?? "";
      const id = randomUUID();
      const now = new Date().toISOString();

      sqlite.prepare(`INSERT INTO crisis_debriefs (
        id, crisis_event_id, youth_id, youth_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`).run(id, input.crisisEventId, input.youthId, input.youthName, now, now);

      auditLog({ action: "m15:createDebrief", actor, resource: `debrief:${id}` });
      return { id, ...input, createdAt: now };
    }),

  updateDebrief: authedQuery
    .input(z.object({
      id: z.string(),
      field1EventSummary: z.string().optional(),
      field2TriggersIdentified: z.string().optional(),
      field3EarlyWarningSigns: z.string().optional(),
      field4InterventionsUsed: z.string().optional(),
      field5WhatWorked: z.string().optional(),
      field6WhatDidNotWork: z.string().optional(),
      field7YouthPerspective: z.string().optional(),
      field8StaffPerspective: z.string().optional(),
      field9PlanAdjustments: z.string().optional(),
      safetyPlanUpdated: z.boolean().optional(),
      safetyPlanChanges: z.string().optional(),
      followUpRequired: z.boolean().optional(),
      followUpActions: z.string().optional(),
      followUpDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const fieldMap: Record<string, string> = {
        field1EventSummary: "field1_event_summary", field2TriggersIdentified: "field2_triggers_identified",
        field3EarlyWarningSigns: "field3_early_warning_signs", field4InterventionsUsed: "field4_interventions_used",
        field5WhatWorked: "field5_what_worked", field6WhatDidNotWork: "field6_what_did_not_work",
        field7YouthPerspective: "field7_youth_perspective", field8StaffPerspective: "field8_staff_perspective",
        field9PlanAdjustments: "field9_plan_adjustments",
        safetyPlanUpdated: "safety_plan_updated", safetyPlanChanges: "safety_plan_changes",
        followUpRequired: "follow_up_required", followUpActions: "follow_up_actions", followUpDate: "follow_up_date",
      };

      const updates: string[] = [];
      const values: any[] = [];
      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) {
          updates.push(`${fieldMap[key]} = ?`);
          values.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
        }
      }

      // Check if all 9 fields are filled → mark completed
      if (updates.length > 0) {
        const current = sqlite.prepare("SELECT * FROM crisis_debriefs WHERE id = ?").get(id) as any;
        if (current) {
          const allFields = [
            fields.field1EventSummary ?? current.field1_event_summary,
            fields.field2TriggersIdentified ?? current.field2_triggers_identified,
            fields.field3EarlyWarningSigns ?? current.field3_early_warning_signs,
            fields.field4InterventionsUsed ?? current.field4_interventions_used,
            fields.field5WhatWorked ?? current.field5_what_worked,
            fields.field6WhatDidNotWork ?? current.field6_what_did_not_work,
            fields.field7YouthPerspective ?? current.field7_youth_perspective,
            fields.field8StaffPerspective ?? current.field8_staff_perspective,
            fields.field9PlanAdjustments ?? current.field9_plan_adjustments,
          ];
          const allFilled = allFields.every(f => f && f.length > 0);
          if (allFilled && !current.completed_at) {
            updates.push("completed_by = ?"); values.push(actor);
            updates.push("completed_by_id = ?"); values.push(ctx.user?.id ?? "");
            updates.push("completed_at = ?"); values.push(new Date().toISOString());
          }
        }
        updates.push("updated_at = ?"); values.push(new Date().toISOString());
        sqlite.prepare(`UPDATE crisis_debriefs SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
      }
      auditLog({ action: "m15:updateDebrief", actor, resource: `debrief:${id}` });
      return { success: true };
    }),

  // ─── Crisis Dashboard Summary ──────────────────────────────
  crisisSummary: authedQuery.query(async () => {
    const activeCrises = sqlite.prepare("SELECT COUNT(*) as c FROM crisis_events WHERE overall_status IN ('active', 'contained')").get() as any;
    const resolvedToday = sqlite.prepare("SELECT COUNT(*) as c FROM crisis_events WHERE overall_status = 'resolved' AND date(updated_at) = date('now')").get() as any;
    const underReview = sqlite.prepare("SELECT COUNT(*) as c FROM crisis_events WHERE overall_status = 'under_review'").get() as any;
    const totalThisMonth = sqlite.prepare("SELECT COUNT(*) as c FROM crisis_events WHERE created_at >= date('now', 'start of month')").get() as any;
    const byType = sqlite.prepare("SELECT crisis_type, COUNT(*) as c FROM crisis_events GROUP BY crisis_type").all() as any[];

    return {
      activeCrises: activeCrises?.c ?? 0,
      resolvedToday: resolvedToday?.c ?? 0,
      underReview: underReview?.c ?? 0,
      totalThisMonth: totalThisMonth?.c ?? 0,
      byType: byType ?? [],
    };
  }),
});
