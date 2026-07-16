import { z } from "zod";
import { createRouter, authedQuery, adminQuery, auditLog } from "../middleware";
import { randomUUID } from "crypto";

// ─── M8: Workflow Engine ───────────────────────────────────

interface WorkflowRule {
  id: string; name: string; event: string;
  actions: { type: string; target: string; priority: string }[];
  enabled: boolean; created_at: string;
  condition?: string | null;
}
interface WorkflowInstance {
  id: string; rule_id: string; rule_name: string;
  event_type: string; status: string; trigger_data: string;
  triggered_by: string; started_at: string; completed_at: string | null;
}
interface WorkflowApproval {
  id: string; instance_id: string; rule_name: string;
  approver_role: string; event_type: string; status: string;
  requested_at: string; responded_at: string | null;
  decision: string | null; approver_id: string | null;
}
interface WorkflowAuditEntry {
  id: string; action: string; actor: string;
  details: string; created_at: string;
}

const rulesStore: WorkflowRule[] = [
  { id: "wr-hr-status", name: "HR Status Change Alert", event: "hr.status-changed", actions: [{ type: "notify", target: "hr-director", priority: "high" }, { type: "log", target: "audit", priority: "low" }], enabled: true, created_at: "2026-01-15T10:00:00Z" },
  { id: "wr-doc-expired", name: "Document Expired Escalation", event: "document.expired", actions: [{ type: "escalate", target: "hr-compliance-officer", priority: "urgent" }, { type: "notify", target: "hr-compliance-officer", priority: "high" }], enabled: true, created_at: "2026-01-15T10:00:00Z" },
  { id: "wr-incident-critical", name: "Critical Incident Response", event: "incident.critical", actions: [{ type: "escalate", target: "managing-director", priority: "urgent" }, { type: "notify", target: "clinical-director", priority: "urgent" }, { type: "notify", target: "hr-compliance-officer", priority: "high" }], enabled: true, created_at: "2026-02-01T09:00:00Z" },
  { id: "wr-credential-expiry", name: "Credential Expiry Warning", event: "credential.expiring-soon", actions: [{ type: "notify", target: "hr-director", priority: "medium" }, { type: "notify", target: "employee", priority: "medium" }], enabled: true, created_at: "2026-02-15T11:00:00Z" },
  { id: "wr-claim-denied", name: "Claim Denied Alert", event: "revenue.claim-denied", actions: [{ type: "notify", target: "revenue-cycle-manager", priority: "high" }, { type: "escalate", target: "revenue-cycle-manager", priority: "medium" }], enabled: true, created_at: "2026-03-01T08:00:00Z" },
  { id: "wr-onboarding-complete", name: "Onboarding Complete — RTD Check", event: "onboarding.completed", actions: [{ type: "notify", target: "hr-director", priority: "medium" }, { type: "notify", target: "shift-supervisor", priority: "medium" }], enabled: true, created_at: "2026-03-15T14:00:00Z" },
  { id: "wr-audit-finding", name: "Audit Finding — CAPA Required", event: "audit.finding-created", actions: [{ type: "escalate", target: "hr-compliance-officer", priority: "high" }, { type: "notify", target: "program-director", priority: "high" }], enabled: true, created_at: "2026-04-01T10:00:00Z" },
  { id: "wr-referral-new", name: "New Referral Assignment", event: "referral.created", actions: [{ type: "notify", target: "gro-administrator", priority: "medium" }, { type: "log", target: "audit", priority: "low" }], enabled: true, created_at: "2026-04-15T09:00:00Z" },
  { id: "wr-equipment-failure", name: "Equipment Failure Response", event: "gad.equipment-failure", actions: [{ type: "escalate", target: "facilities-manager", priority: "urgent" }, { type: "notify", target: "facilities-manager", priority: "high" }], enabled: false, created_at: "2026-05-01T11:00:00Z" },
  { id: "wr-high-risk-patient", name: "High Risk Patient Alert", event: "clinical.high-risk", actions: [{ type: "escalate", target: "clinical-director", priority: "urgent" }, { type: "notify", target: "assigned-clinician", priority: "urgent" }], enabled: true, created_at: "2026-05-15T10:00:00Z" },
];

const instancesStore: WorkflowInstance[] = [
  { id: "wi1", rule_id: "wr-hr-status", rule_name: "HR Status Change Alert", event_type: "hr.status-changed", status: "completed", trigger_data: '{"personId":"h4","from":"applicant","to":"new-hire"}', triggered_by: "hr-director@amos-ops.invalid", started_at: "2026-06-20T10:00:00Z", completed_at: "2026-06-20T10:00:05Z" },
  { id: "wi2", rule_id: "wr-credential-expiry", rule_name: "Credential Expiry Warning", event_type: "credential.expiring-soon", status: "completed", trigger_data: '{"personId":"h4","credential":"LPC License","daysUntilExpiry":45}', triggered_by: "system", started_at: "2026-06-15T08:00:00Z", completed_at: "2026-06-15T08:00:03Z" },
  { id: "wi3", rule_id: "wr-incident-critical", rule_name: "Critical Incident Response", event_type: "incident.critical", status: "completed", trigger_data: '{"incidentId":"i1","type":"elopement","severity":"high"}', triggered_by: "rcs-day@amos-ops.invalid", started_at: "2026-06-15T14:30:00Z", completed_at: "2026-06-15T14:35:00Z" },
  { id: "wi4", rule_id: "wr-claim-denied", rule_name: "Claim Denied Alert", event_type: "revenue.claim-denied", status: "pending", trigger_data: '{"claimId":"c3","denialCode":"CO-29","amount":875000}', triggered_by: "system", started_at: "2026-06-12T09:00:00Z", completed_at: null },
  { id: "wi5", rule_id: "wr-audit-finding", rule_name: "Audit Finding — CAPA Required", event_type: "audit.finding-created", status: "completed", trigger_data: '{"auditId":"a1","finding":"Missing signatures","severity":"minor"}', triggered_by: "system", started_at: "2026-06-15T16:00:00Z", completed_at: "2026-06-16T10:00:00Z" },
  { id: "wi6", rule_id: "wr-referral-new", rule_name: "New Referral Assignment", event_type: "referral.created", status: "completed", trigger_data: '{"referralId":"r4","patientName":"Synthetic Youth 017","type":"crisis"}', triggered_by: "gro.admin@amos-ops.invalid", started_at: "2026-06-27T08:15:00Z", completed_at: "2026-06-27T08:15:03Z" },
  { id: "wi7", rule_id: "wr-high-risk-patient", rule_name: "High Risk Patient Alert", event_type: "clinical.high-risk", status: "completed", trigger_data: '{"patientId":"p1","riskType":"suicide-ideation","level":"moderate"}', triggered_by: "system", started_at: "2026-06-21T14:00:00Z", completed_at: "2026-06-21T14:05:00Z" },
  { id: "wi8", rule_id: "wr-doc-expired", rule_name: "Document Expired Escalation", event_type: "document.expired", status: "rejected", trigger_data: '{"documentId":"d8","title":"Incident Reporting Guide"}', triggered_by: "system", started_at: "2026-06-25T16:00:00Z", completed_at: "2026-06-26T09:00:00Z" },
  { id: "wi9", rule_id: "wr-hr-status", rule_name: "HR Status Change Alert", event_type: "hr.status-changed", status: "pending", trigger_data: '{"personId":"h5","from":"new-hire","to":"active"}', triggered_by: "hr-director@amos-ops.invalid", started_at: "2026-06-28T09:00:00Z", completed_at: null },
  { id: "wi10", rule_id: "wr-equipment-failure", rule_name: "Equipment Failure Response", event_type: "gad.equipment-failure", status: "pending", trigger_data: '{"equipment":"network-switch","location":"server-closet"}', triggered_by: "gad.ops@amos-ops.invalid", started_at: "2026-06-28T16:00:00Z", completed_at: null },
];

const approvalsStore: WorkflowApproval[] = [
  { id: "wa1", instance_id: "wi4", rule_name: "Claim Denied Alert", approver_role: "revenue-cycle-manager", event_type: "revenue.claim-denied", status: "pending", requested_at: "2026-06-12T09:00:00Z", responded_at: null, decision: null, approver_id: null },
  { id: "wa2", instance_id: "wi9", rule_name: "HR Status Change Alert", approver_role: "hr-director", event_type: "hr.status-changed", status: "pending", requested_at: "2026-06-28T09:00:00Z", responded_at: null, decision: null, approver_id: null },
  { id: "wa3", instance_id: "wi10", rule_name: "Equipment Failure Response", approver_role: "facilities-manager", event_type: "gad.equipment-failure", status: "pending", requested_at: "2026-06-28T16:00:00Z", responded_at: null, decision: null, approver_id: null },
];

const auditStore: WorkflowAuditEntry[] = [
  { id: "wl1", action: "instance.triggered", actor: "hr-director@amos-ops.invalid", details: "HR Status Change: h4 applicant → new-hire", created_at: "2026-06-20T10:00:00Z" },
  { id: "wl2", action: "instance.completed", actor: "system", details: "HR Status Change Alert completed (2 actions executed)", created_at: "2026-06-20T10:00:05Z" },
  { id: "wl3", action: "instance.triggered", actor: "system", details: "Credential LPC License expires in 45 days for h4", created_at: "2026-06-15T08:00:00Z" },
  { id: "wl4", action: "instance.triggered", actor: "rcs-day@amos-ops.invalid", details: "Critical incident: Youth eloped (INC-2026-001)", created_at: "2026-06-15T14:30:00Z" },
  { id: "wl5", action: "approval.created", actor: "system", details: "Claim Denied Alert requires revenue-cycle-manager approval", created_at: "2026-06-12T09:00:00Z" },
  { id: "wl6", action: "instance.triggered", actor: "system", details: "Audit finding created: Missing signatures (AUD-2026-001)", created_at: "2026-06-15T16:00:00Z" },
  { id: "wl7", action: "instance.triggered", actor: "gro.admin@amos-ops.invalid", details: "New crisis referral: Synthetic Youth 017 (REF-2026-004)", created_at: "2026-06-27T08:15:00Z" },
  { id: "wl8", action: "instance.rejected", actor: "Demo Executive", details: "Document Expired Escalation rejected — document intentionally archived", created_at: "2026-06-26T09:00:00Z" },
  { id: "wl9", action: "approval.created", actor: "system", details: "HR Status Change requires hr-director approval for h5", created_at: "2026-06-28T09:00:00Z" },
  { id: "wl10", action: "instance.triggered", actor: "gad.ops@amos-ops.invalid", details: "Equipment failure: Network switch (server closet)", created_at: "2026-06-28T16:00:00Z" },
];

export const m8Router = createRouter({
  listRules: authedQuery.query(() => rulesStore),

  getEventTypes: authedQuery.query(() => {
    const categoryFor = (event: string): string => {
      if (event.startsWith("hr.") || event.startsWith("onboarding.")) return "HR";
      if (event.startsWith("document.")) return "Documents";
      if (event.startsWith("training.")) return "Training";
      if (event.startsWith("clinical.")) return "Clinical";
      if (event.startsWith("incident.") || event.startsWith("audit.")) return "Compliance";
      if (event.startsWith("revenue.") || event.startsWith("claim.")) return "Revenue";
      if (event.startsWith("referral.")) return "Growth & Outreach";
      if (event.startsWith("gad.")) return "Administration";
      return "Other";
    };

    return [...new Set(rulesStore.map((rule) => rule.event))]
      .sort()
      .map((event) => ({ event, category: categoryFor(event) }));
  }),

  listInstances: authedQuery
    .input(z.object({ status: z.string().optional() }).optional())
    .query(({ input }) => {
      let results = [...instancesStore];
      if (input?.status) results = results.filter((i) => i.status === input.status);
      return results.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    }),

  listPendingApprovals: authedQuery.query(() =>
    approvalsStore.filter((a) => a.status === "pending").sort((a, b) => new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime())
  ),

  dashboardKPIs: authedQuery.query(() => {
    const totalInstances = instancesStore.length;
    const pendingInstances = instancesStore.filter((i) => i.status === "pending").length;
    const completedInstances = instancesStore.filter((i) => i.status === "completed").length;
    const rejectedInstances = instancesStore.filter((i) => i.status === "rejected").length;
    const pendingApprovals = approvalsStore.filter((a) => a.status === "pending").length;
    return { totalInstances, pendingInstances, completedInstances, rejectedInstances, pendingApprovals };
  }),

  auditLog: authedQuery.query(() =>
    [...auditStore].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  ),

  trigger: adminQuery
    .input(z.object({ ruleId: z.string(), triggerData: z.string() }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const rule = rulesStore.find((r) => r.id === input.ruleId);
      if (!rule) throw new Error("Rule not found");
      if (!rule.enabled) throw new Error("Rule is disabled");

      const instanceId = randomUUID();
      const now = new Date().toISOString();

      // Create instance
      instancesStore.push({
        id: instanceId, rule_id: rule.id, rule_name: rule.name,
        event_type: rule.event, status: "completed",
        trigger_data: input.triggerData, triggered_by: actor,
        started_at: now, completed_at: now,
      });

      // Create approvals for escalate actions
      let approvalsCreated = 0;
      for (const action of rule.actions) {
        if (action.type === "escalate") {
          const approvalId = randomUUID();
          approvalsStore.push({
            id: approvalId, instance_id: instanceId, rule_name: rule.name,
            approver_role: action.target, event_type: rule.event,
            status: "pending", requested_at: now,
            responded_at: null, decision: null, approver_id: null,
          });
          approvalsCreated++;
          auditStore.push({ id: randomUUID(), action: "approval.created", actor: "system", details: `${rule.name} requires ${action.target} approval`, created_at: now });
        }
      }

      // If approvals were created, set instance to pending
      if (approvalsCreated > 0) {
        const inst = instancesStore.find((i) => i.id === instanceId);
        if (inst) inst.status = "pending";
      }

      auditStore.push({ id: randomUUID(), action: "instance.triggered", actor, details: `${rule.name} triggered`, created_at: now });
      auditLog({ action: "m8:triggerWorkflow", actor, resource: `rule:${input.ruleId}`, details: `Triggered: ${rule.name}` });

      return { instanceId, approvalsCreated };
    }),

  respondApproval: adminQuery
    .input(z.object({
      approvalId: z.string(),
      decision: z.enum(["approved", "rejected"]),
      // Retained as an optional compatibility field for existing clients.
      // The authenticated session remains the authoritative approver identity.
      approverId: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const approverId = ctx.user.id;
      const approval = approvalsStore.find((a) => a.id === input.approvalId);
      if (!approval) throw new Error("Approval not found");
      if (approval.status !== "pending") throw new Error("Approval already responded");

      const now = new Date().toISOString();
      approval.status = "responded";
      approval.decision = input.decision;
      approval.approver_id = approverId;
      approval.responded_at = now;

      // Update instance status
      const instance = instancesStore.find((i) => i.id === approval.instance_id);
      if (instance) {
        instance.status = input.decision;
        instance.completed_at = now;
      }

      auditStore.push({
        id: randomUUID(), action: `approval.${input.decision}`, actor,
        details: `${approval.rule_name} ${input.decision} by ${actor}`, created_at: now,
      });
      auditLog({ action: "m8:respondApproval", actor, resource: `approval:${input.approvalId}`, details: `Decision: ${input.decision}` });

      return { success: true, decision: input.decision };
    }),
});
