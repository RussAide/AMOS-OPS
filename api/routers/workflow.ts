import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "../middleware";
import { sqlite } from "../queries/connection";
import { DEFAULT_WORKFLOW_RULES } from "../lib/workflow";
import { randomUUID } from "crypto";

export const workflowRouter = createRouter({
  // ─── List Rules ────────────────────────────────────────────

  listRules: publicQuery.query(() => {
    return DEFAULT_WORKFLOW_RULES.map((rule) => ({
      id: rule.id,
      name: rule.name,
      event: rule.event,
      condition: rule.condition,
      actions: rule.actions.map((a) => ({
        type: a.type,
        target: a.target,
        priority: a.priority,
      })),
      enabled: rule.enabled,
    }));
  }),

  // ─── Event Types ───────────────────────────────────────────

  getEventTypes: publicQuery.query(() => {
    return [
      { event: "hr.status-changed", label: "HR Status Changed", category: "HR" },
      { event: "hr.person-created", label: "New Person Added", category: "HR" },
      { event: "document.uploaded", label: "Document Uploaded", category: "Documents" },
      { event: "document.verified", label: "Document Verified", category: "Documents" },
      { event: "document.rejected", label: "Document Rejected", category: "Documents" },
      { event: "document.expired", label: "Document Expired", category: "Documents" },
      { event: "training.completed", label: "Training Completed", category: "Training" },
      { event: "training.quiz-passed", label: "Quiz Passed", category: "Training" },
    ];
  }),

  // ─── Workflow Instances ────────────────────────────────────

  listInstances: publicQuery
    .input(z.object({ status: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM workflow_instances";
      const params: any[] = [];
      if (input?.status) { sql += " WHERE status = ?"; params.push(input.status); }
      sql += " ORDER BY started_at DESC LIMIT ?"; params.push(input?.limit ?? 50);
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  // ─── Pending Approvals ─────────────────────────────────────

  listPendingApprovals: publicQuery.query(async () => {
    return sqlite.prepare(
      "SELECT a.*, i.rule_name, i.event_type FROM workflow_approvals a JOIN workflow_instances i ON a.instance_id = i.id WHERE a.status = 'pending' ORDER BY a.requested_at DESC"
    ).all() ?? [];
  }),

  // ─── Respond to Approval ───────────────────────────────────

  respondApproval: publicQuery
    .input(z.object({
      approvalId: z.string(),
      decision: z.enum(["approved", "rejected"]),
      comment: z.string().optional(),
      approverId: z.string(),
    }))
    .mutation(async ({ input }) => {
      sqlite.prepare(
        "UPDATE workflow_approvals SET status = ?, comment = ?, approver_id = ?, responded_at = datetime('now') WHERE id = ?"
      ).run(input.decision, input.comment ?? null, input.approverId, input.approvalId);

      const approval = sqlite.prepare("SELECT * FROM workflow_approvals WHERE id = ?").get(input.approvalId) as any;
      if (!approval) throw new Error("Approval not found");

      // Log the action
      sqlite.prepare(
        "INSERT INTO workflow_audit_log (id, instance_id, action, actor, details, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
      ).run(randomUUID(), approval.instance_id, `approval_${input.decision}`, input.approverId, input.comment ?? null);

      // Check if all approvals for this instance are resolved
      const pendingCount = (sqlite.prepare("SELECT COUNT(*) as c FROM workflow_approvals WHERE instance_id = ? AND status = 'pending'").get(approval.instance_id) as any)?.c ?? 0;
      if (pendingCount === 0) {
        // All resolved - check if any rejections
        const rejectCount = (sqlite.prepare("SELECT COUNT(*) as c FROM workflow_approvals WHERE instance_id = ? AND status = 'rejected'").get(approval.instance_id) as any)?.c ?? 0;
        const newStatus = rejectCount > 0 ? "rejected" : "completed";
        sqlite.prepare("UPDATE workflow_instances SET status = ?, completed_at = datetime('now') WHERE id = ?").run(newStatus, approval.instance_id);
      }

      return { success: true, decision: input.decision };
    }),

  // ─── Trigger Workflow (creates instance + approvals) ───────

  trigger: publicQuery
    .input(z.object({
      ruleId: z.string(),
      triggerData: z.string(),
      triggeredBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const rule = DEFAULT_WORKFLOW_RULES.find((r) => r.id === input.ruleId);
      if (!rule) throw new Error("Rule not found");

      const instanceId = randomUUID();
      sqlite.prepare(
        "INSERT INTO workflow_instances (id, rule_id, rule_name, event_type, status, trigger_data, started_at, triggered_by) VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'), ?)"
      ).run(instanceId, rule.id, rule.name, rule.event, input.triggerData, input.triggeredBy ?? "system");

      // Create approval chain for actions that target specific roles
      const approvalRoles = new Set<string>();
      for (const action of rule.actions) {
        if (action.priority === "urgent" || action.priority === "high") {
          if (action.target === "hr-director") approvalRoles.add("hr-director");
          if (action.target === "supervisor") approvalRoles.add("supervisor");
          if (action.target === "qa-officer") approvalRoles.add("qa-officer");
        }
      }

      for (const role of approvalRoles) {
        sqlite.prepare(
          "INSERT INTO workflow_approvals (id, instance_id, approver_role, requested_at) VALUES (?, ?, ?, datetime('now'))"
        ).run(randomUUID(), instanceId, role);
      }

      // Audit log
      sqlite.prepare(
        "INSERT INTO workflow_audit_log (id, instance_id, action, actor, details, created_at) VALUES (?, ?, 'triggered', ?, ?, datetime('now'))"
      ).run(randomUUID(), instanceId, input.triggeredBy ?? "system", `Rule: ${rule.name}`);

      return { instanceId, approvalsCreated: approvalRoles.size };
    }),

  // ─── Audit Log ─────────────────────────────────────────────

  auditLog: publicQuery
    .input(z.object({ instanceId: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM workflow_audit_log";
      const params: any[] = [];
      if (input?.instanceId) { sql += " WHERE instance_id = ?"; params.push(input.instanceId); }
      sql += " ORDER BY created_at DESC LIMIT ?"; params.push(input?.limit ?? 50);
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  // ─── Dashboard KPIs ────────────────────────────────────────

  dashboardKPIs: publicQuery.query(async () => {
    const totalInstances = (sqlite.prepare("SELECT COUNT(*) as c FROM workflow_instances").get() as any)?.c ?? 0;
    const pendingInstances = (sqlite.prepare("SELECT COUNT(*) as c FROM workflow_instances WHERE status = 'pending'").get() as any)?.c ?? 0;
    const completedInstances = (sqlite.prepare("SELECT COUNT(*) as c FROM workflow_instances WHERE status = 'completed'").get() as any)?.c ?? 0;
    const rejectedInstances = (sqlite.prepare("SELECT COUNT(*) as c FROM workflow_instances WHERE status = 'rejected'").get() as any)?.c ?? 0;
    const pendingApprovals = (sqlite.prepare("SELECT COUNT(*) as c FROM workflow_approvals WHERE status = 'pending'").get() as any)?.c ?? 0;
    return { totalInstances, pendingInstances, completedInstances, rejectedInstances, pendingApprovals };
  }),
});
