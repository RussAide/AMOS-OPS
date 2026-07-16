import { z } from "zod";
import { createRouter, authedQuery, adminQuery, auditLog } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";

// ─── M1: First Vertical Slice Router ───────────────────────

interface IdRow { id: string }
interface CountRow { c: number }
interface ModuleCountRow { total: number; completed: number | null }
interface EvidenceCountRow { total: number; uploaded: number | null }
interface CredentialExpiryRow { id: string; expiry_date: string; alert_threshold_days: number }
interface EvidenceGateRow { gate_name: string; evidence_type: string; required: number }
interface EvidenceTypeRow { evidence_type: string }
interface WorkflowDefinitionRow { workflow_id: string; workflow_name: string }
interface WorkTaskRow {
  id: string;
  workflow_id: string | null;
  task_type: string | null;
  task_title: string;
  status: string;
  due_date: string | null;
  escalation_level: number | null;
  assigned_by: string | null;
  assigned_to: string | null;
}
interface WorkflowGroup {
  workflowId: string;
  workflowName: string;
  tasks: WorkTaskRow[];
  evidenceGates: { gateName: string; required: boolean; completed: boolean }[];
}
interface EscalatedTask {
  taskId: string;
  taskTitle: string;
  previousLevel: number;
  newLevel: number;
  dueDate: string | null;
  assignedTo: string | null;
  escalationReason: string;
}

export const m1Router = createRouter({
  // ─── M1.1: Onboarding Progress ───────────────────────────
  getOnboardingProgress: authedQuery
    .input(z.object({ personId: z.string() }))
    .query(async ({ input }) => {
      const rows = sqlite.prepare(
        "SELECT * FROM onboarding_progress WHERE person_id = ? ORDER BY track_id, module_id"
      ).all(input.personId) ?? [];
      return rows;
    }),

  updateModuleProgress: authedQuery
    .input(z.object({
      personId: z.string(),
      moduleId: z.string(),
      status: z.enum(["not-started", "in-progress", "completed", "overdue"]),
      score: z.number().optional(),
      evidenceUploaded: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const existing = sqlite.prepare(
        "SELECT id FROM onboarding_progress WHERE person_id = ? AND module_id = ?"
      ).get(input.personId, input.moduleId) as IdRow | undefined;

      if (existing) {
        sqlite.prepare(
          "UPDATE onboarding_progress SET status = ?, score = ?, evidence_uploaded = ?, completed_at = ? WHERE id = ?"
        ).run(
          input.status,
          input.score ?? null,
          input.evidenceUploaded ? 1 : 0,
          input.status === "completed" ? new Date().toISOString() : null,
          existing.id
        );
      } else {
        sqlite.prepare(
          "INSERT INTO onboarding_progress (id, person_id, track_id, module_id, status, score, evidence_uploaded, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          randomUUID(), input.personId, "general", input.moduleId,
          input.status, input.score ?? null, input.evidenceUploaded ? 1 : 0,
          input.status === "completed" ? new Date().toISOString() : null
        );
      }

      auditLog({
        action: "m1:updateModuleProgress",
        actor,
        resource: `person:${input.personId}`,
        details: `Module ${input.moduleId} status updated to ${input.status}`,
      });

      return { success: true };
    }),

  // ─── M1.2: Credential Expiries ───────────────────────────
  listCredentialExpiries: authedQuery
    .input(z.object({ personId: z.string().optional(), alertStatus: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM credential_expiries WHERE 1=1";
      const params: string[] = [];
      if (input?.personId) { sql += " AND person_id = ?"; params.push(input.personId); }
      if (input?.alertStatus) { sql += " AND alert_status = ?"; params.push(input.alertStatus); }
      sql += " ORDER BY expiry_date ASC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  addCredential: authedQuery
    .input(z.object({
      personId: z.string(),
      credentialType: z.string(),
      credentialName: z.string(),
      issuedDate: z.string().optional(),
      expiryDate: z.string(),
      alertThresholdDays: z.number().default(30),
      documentId: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      sqlite.prepare(
        "INSERT INTO credential_expiries (id, person_id, credential_type, credential_name, issued_date, expiry_date, alert_threshold_days, alert_status, document_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'current', ?, ?, datetime('now'))"
      ).run(id, input.personId, input.credentialType, input.credentialName,
        input.issuedDate ?? null, input.expiryDate, input.alertThresholdDays,
        input.documentId ?? null, input.notes ?? null);

      auditLog({ action: "m1:addCredential", actor, resource: `person:${input.personId}`, details: `Added credential: ${input.credentialName}` });
      return { success: true, id };
    }),

  checkCredentialAlerts: authedQuery.query(async () => {
    // Update alert_status based on expiry_date
    const rows = sqlite.prepare("SELECT id, expiry_date, alert_threshold_days FROM credential_expiries WHERE alert_status = 'current'").all() as CredentialExpiryRow[];
    const now = new Date();
    let expired = 0, warning = 0;

    for (const row of rows) {
      const expiry = new Date(row.expiry_date);
      const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 0) {
        sqlite.prepare("UPDATE credential_expiries SET alert_status = 'expired' WHERE id = ?").run(row.id);
        expired++;
      } else if (daysUntil <= row.alert_threshold_days) {
        sqlite.prepare("UPDATE credential_expiries SET alert_status = 'warning' WHERE id = ?").run(row.id);
        warning++;
      }
    }
    return { checked: rows.length, expired, warning };
  }),

  // ─── M1.4: Release-to-Duty Gate ──────────────────────────
  checkReleaseToDuty: authedQuery
    .input(z.object({ personId: z.string() }))
    .query(async ({ input }) => {
      // Check if all required modules are completed
      const modules = sqlite.prepare(
        "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM onboarding_progress WHERE person_id = ?"
      ).get(input.personId) as ModuleCountRow | undefined;

      // Check if credentials are current (no expired)
      const expiredCreds = sqlite.prepare(
        "SELECT COUNT(*) as c FROM credential_expiries WHERE person_id = ? AND alert_status = 'expired'"
      ).get(input.personId) as CountRow | undefined;

      // Check required documents (evidence uploaded)
      const evidence = sqlite.prepare(
        "SELECT COUNT(*) as total, SUM(CASE WHEN evidence_uploaded = 1 THEN 1 ELSE 0 END) as uploaded FROM onboarding_progress WHERE person_id = ?"
      ).get(input.personId) as EvidenceCountRow | undefined;

      const totalModules = modules?.total ?? 0;
      const completedModules = modules?.completed ?? 0;
      const hasExpiredCreds = (expiredCreds?.c ?? 0) > 0;
      const totalEvidence = evidence?.total ?? 0;
      const uploadedEvidence = evidence?.uploaded ?? 0;

      const isClear = totalModules > 0 && completedModules >= totalModules && !hasExpiredCreds && (totalEvidence === 0 || uploadedEvidence >= totalEvidence);

      return {
        personId: input.personId,
        isClear,
        modules: { total: totalModules, completed: completedModules },
        credentials: { expired: expiredCreds?.c ?? 0 },
        evidence: { total: totalEvidence, uploaded: uploadedEvidence ?? 0 },
        blockers: [
          ...(totalModules > 0 && completedModules < totalModules ? [`${totalModules - completedModules} modules incomplete`] : []),
          ...(hasExpiredCreds ? ["Expired credentials found"] : []),
          ...(totalEvidence > 0 && uploadedEvidence < totalEvidence ? [`${totalEvidence - uploadedEvidence} evidence items missing`] : []),
        ],
      };
    }),

  // ─── M1.5: AMOS-DMS Document ID ─────────────────────────
  generateDocumentId: authedQuery
    .input(z.object({
      category: z.string(),
      department: z.string(),
      sequence: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      // Get next sequence
      const seqResult = sqlite.prepare(
        "SELECT COUNT(*) as c FROM documents WHERE file_name LIKE ?"
      ).get(`${input.department}-${input.category}-${year}%`) as CountRow | undefined;
      const seq = input.sequence ?? ((seqResult?.c ?? 0) + 1);
      const docId = `ADL-${input.department.toUpperCase()}-${input.category.toUpperCase()}-${year}${month}-${String(seq).padStart(4, "0")}`;
      return { documentId: docId };
    }),

  // ─── M1.6: Document Templates ────────────────────────────
  listDocumentTemplates: authedQuery.query(async () => {
    return sqlite.prepare("SELECT * FROM document_templates WHERE is_active = 1 ORDER BY category, template_name").all() ?? [];
  }),

  seedDefaultTemplates: adminQuery.mutation(async ({ ctx }) => {
    const actor = ctx.user?.email ?? "unknown";
    const templates = [
      { name: "Employee Onboarding Checklist", code: "ONB-001", category: "HR", desc: "Standard onboarding checklist for new hires" },
      { name: "Credential Verification Form", code: "CRED-001", category: "HR", desc: "Credential expiry verification template" },
      { name: "Incident Report", code: "INC-001", category: "GRO", desc: "Youth incident report template" },
      { name: "Treatment Plan Review", code: "TPR-001", category: "Clinical", desc: "Clinical treatment plan review form" },
      { name: "CAP Corrective Action", code: "CAP-001", category: "QA", desc: "Corrective action plan template" },
      { name: "Authorization Request", code: "AUTH-001", category: "Revenue", desc: "Insurance authorization request form" },
      { name: "Release-to-Duty Assessment", code: "RTD-001", category: "HR", desc: "Pre-duty clearance assessment" },
      { name: "Evidence Packet Cover", code: "EPC-001", category: "DMS", desc: "Evidence packet cover sheet" },
    ];

    for (const t of templates) {
      sqlite.prepare(
        "INSERT OR IGNORE INTO document_templates (id, template_name, template_code, category, description, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
      ).run(randomUUID(), t.name, t.code, t.category, t.desc);
    }

    auditLog({ action: "m1:seedTemplates", actor, resource: "system", details: `Seeded ${templates.length} default templates` });
    return { seeded: templates.length };
  }),

  // ─── M1.7: Evidence Packets ──────────────────────────────
  listEvidencePackets: authedQuery
    .input(z.object({ personId: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM evidence_packets WHERE 1=1";
      const params: string[] = [];
      if (input?.personId) { sql += " AND person_id = ?"; params.push(input.personId); }
      if (input?.status) { sql += " AND status = ?"; params.push(input.status); }
      sql += " ORDER BY created_at DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  createEvidencePacket: authedQuery
    .input(z.object({
      packetName: z.string(),
      packetType: z.string(),
      personId: z.string().optional(),
      caseId: z.string().optional(),
      documentIds: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      sqlite.prepare(
        "INSERT INTO evidence_packets (id, packet_name, packet_type, person_id, case_id, document_ids_json, assembled_by, assembled_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
      ).run(id, input.packetName, input.packetType, input.personId ?? null, input.caseId ?? null, JSON.stringify(input.documentIds), actor);

      auditLog({ action: "m1:createPacket", actor, resource: `packet:${id}`, details: `Created evidence packet: ${input.packetName}` });
      return { success: true, id };
    }),

  // ─── M1.8: My Work Today ─────────────────────────────────
  getWorkQueue: authedQuery
    .input(z.object({ assignedTo: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM work_queue WHERE 1=1";
      const params: string[] = [];
      if (input?.assignedTo) { sql += " AND assigned_to = ?"; params.push(input.assignedTo); }
      if (input?.status) { sql += " AND status = ?"; params.push(input.status); }
      else { sql += " AND status IN ('pending', 'in-progress')"; }
      sql += " ORDER BY priority DESC, due_date ASC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  createWorkTask: authedQuery
    .input(z.object({
      taskTitle: z.string(),
      taskType: z.string(),
      description: z.string().optional(),
      assignedTo: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      workflowId: z.string().optional(),
      evidenceRequired: z.boolean().default(false),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      sqlite.prepare(
        "INSERT INTO work_queue (id, task_title, task_type, description, assigned_to, assigned_by, priority, status, entity_type, entity_id, workflow_id, evidence_required, evidence_uploaded, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 0, ?, datetime('now'))"
      ).run(id, input.taskTitle, input.taskType, input.description ?? null,
        input.assignedTo ?? null, actor, input.priority,
        input.entityType ?? null, input.entityId ?? null,
        input.workflowId ?? null,
        input.evidenceRequired ? 1 : 0, input.dueDate ?? null);

      auditLog({ action: "m1:createTask", actor, resource: `task:${id}`, details: `Created task: ${input.taskTitle}` });
      return { success: true, id };
    }),

  claimWorkTask: authedQuery
    .input(z.object({ taskId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user.email;
      const task = sqlite.prepare(
        "SELECT * FROM work_queue WHERE id = ?"
      ).get(input.taskId) as WorkTaskRow | undefined;

      if (!task) {
        throw new Error("Task not found");
      }
      if (task.status === "completed") {
        throw new Error("Completed tasks cannot be claimed");
      }
      if (task.assigned_to && task.assigned_to !== actor && task.assigned_to !== ctx.user.id) {
        throw new Error("Task is already assigned to another team member");
      }

      sqlite.prepare(
        "UPDATE work_queue SET assigned_to = ?, status = CASE WHEN status = 'pending' THEN 'in-progress' ELSE status END WHERE id = ?"
      ).run(actor, input.taskId);

      auditLog({
        action: "m1:claimWorkTask",
        actor,
        resource: `task:${input.taskId}`,
        details: "Task claimed by authenticated team member",
      });

      const claimedTask = sqlite.prepare(
        "SELECT * FROM work_queue WHERE id = ?"
      ).get(input.taskId) as WorkTaskRow;

      return { success: true, task: claimedTask };
    }),

  addWorkTaskComment: authedQuery
    .input(z.object({
      taskId: z.string().min(1),
      comment: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user.email;
      const task = sqlite.prepare(
        "SELECT id FROM work_queue WHERE id = ?"
      ).get(input.taskId) as IdRow | undefined;

      if (!task) {
        throw new Error("Task not found");
      }

      const id = randomUUID();
      const createdAt = new Date().toISOString();
      sqlite.prepare(
        "INSERT INTO workflow_audit_log (id, instance_id, action, actor, details, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, input.taskId, "m1:addWorkTaskComment", actor, input.comment, createdAt);

      return {
        success: true,
        comment: { id, taskId: input.taskId, comment: input.comment, actor, createdAt },
      };
    }),

  completeWorkTask: authedQuery
    .input(z.object({
      taskId: z.string(),
      evidenceUploaded: z.boolean().optional(),
      evidence: z.array(z.object({
        fileName: z.string(),
        filePath: z.string(),
        evidenceType: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";

      // Fetch task details including workflow
      const task = sqlite.prepare("SELECT * FROM work_queue WHERE id = ?").get(input.taskId) as WorkTaskRow | undefined;
      if (!task) {
        throw new Error("Task not found");
      }

      // ─── D003-03: Evidence gate validation ─────────────────
      if (task.workflow_id) {
        // Get required evidence gates for this workflow
        const requiredGates = sqlite.prepare(
          "SELECT gate_name, evidence_type, required FROM evidence_gates WHERE workflow_id = ? AND required = 1"
        ).all(task.workflow_id) as EvidenceGateRow[];

        if (requiredGates.length > 0) {
          // Check which evidence types have been uploaded (from input + existing)
          const existingEvidence = sqlite.prepare(
            "SELECT evidence_type FROM task_evidence WHERE task_id = ?"
          ).all(input.taskId) as EvidenceTypeRow[];

          const providedEvidenceTypes = new Set([
            ...existingEvidence.map((e) => e.evidence_type),
            ...(input.evidence ?? []).map((e) => e.evidenceType),
          ]);

          // Validate all required gates are satisfied
          const missingGates = requiredGates.filter(
            (gate) => !providedEvidenceTypes.has(gate.evidence_type)
          );

          if (missingGates.length > 0) {
            throw new Error(
              `Missing required evidence: ${missingGates.map((g) => g.gate_name).join(", ")}`
            );
          }
        }
      }

      // ─── Store evidence references ─────────────────────────
      if (input.evidence && input.evidence.length > 0) {
        const insertEvidence = sqlite.prepare(
          "INSERT INTO task_evidence (id, task_id, file_name, file_path, evidence_type, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
        );
        for (const ev of input.evidence) {
          insertEvidence.run(randomUUID(), input.taskId, ev.fileName, ev.filePath, ev.evidenceType, actor);
        }
      }

      sqlite.prepare(
        "UPDATE work_queue SET status = 'completed', completed_at = datetime('now'), completed_by = ?, evidence_uploaded = ? WHERE id = ?"
      ).run(actor, input.evidenceUploaded ? 1 : 0, input.taskId);

      auditLog({ action: "m1:completeTask", actor, resource: `task:${input.taskId}`, details: "Task completed" });
      return { success: true };
    }),

  // ─── M1.9: Task Status with Evidence Gates ───────────────
  transitionTaskStatus: authedQuery
    .input(z.object({
      taskId: z.string(),
      fromStatus: z.string(),
      toStatus: z.enum(["pending", "in-progress", "evidence-required", "completed", "rejected"]),
      evidenceProvided: z.boolean().default(false),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";

      // Evidence gate check
      if (input.toStatus === "completed" && !input.evidenceProvided) {
        throw new Error("Evidence required before completing this task");
      }

      sqlite.prepare(
        "UPDATE work_queue SET status = ?, evidence_uploaded = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END, completed_by = CASE WHEN ? = 'completed' THEN ? ELSE completed_by END WHERE id = ?"
      ).run(input.toStatus, input.evidenceProvided ? 1 : 0, input.toStatus, input.toStatus, actor, input.taskId);

      auditLog({
        action: "m1:transitionTask",
        actor,
        resource: `task:${input.taskId}`,
        details: `Status: ${input.fromStatus} -> ${input.toStatus}${input.note ? ` | ${input.note}` : ""}`,
      });

      return { success: true, toStatus: input.toStatus };
    }),

  // ═══════════════════════════════════════════════════════════
  // ═══ D003-02: Work Queue with Workflow Grouping ══════════
  // ═══════════════════════════════════════════════════════════

  getWorkQueueGrouped: authedQuery
    .input(z.object({ assignedTo: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      // Ensure default workflows exist
      const defaultWorkflows = [
        { workflow_id: "WF-001", workflow_name: "Referral Intake", category: "GRO" },
        { workflow_id: "WF-002", workflow_name: "Clinical Assessment", category: "Clinical" },
        { workflow_id: "WF-003", workflow_name: "Credential Verification", category: "HR" },
        { workflow_id: "WF-004", workflow_name: "Incident Reporting", category: "QA" },
        { workflow_id: "WF-005", workflow_name: "Authorization Request", category: "Revenue" },
        { workflow_id: "WF-006", workflow_name: "Onboarding Review", category: "HR" },
        { workflow_id: "WF-007", workflow_name: "General Task", category: "general" },
      ];

      for (const wf of defaultWorkflows) {
        sqlite.prepare(
          "INSERT OR IGNORE INTO workflow_definitions (id, workflow_id, workflow_name, category, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
        ).run(randomUUID(), wf.workflow_id, wf.workflow_name, wf.category);
      }

      // Seed default evidence gates for workflows
      const defaultGates = [
        { workflow_id: "WF-001", gate_name: "Referral Form", evidence_type: "form", required: 1 },
        { workflow_id: "WF-001", gate_name: "Consent Document", evidence_type: "consent", required: 1 },
        { workflow_id: "WF-002", gate_name: "Assessment Notes", evidence_type: "notes", required: 1 },
        { workflow_id: "WF-002", gate_name: "Care Plan", evidence_type: "plan", required: 0 },
        { workflow_id: "WF-003", gate_name: "Credential Document", evidence_type: "credential", required: 1 },
        { workflow_id: "WF-004", gate_name: "Incident Report Form", evidence_type: "form", required: 1 },
        { workflow_id: "WF-004", gate_name: "Witness Statement", evidence_type: "statement", required: 0 },
        { workflow_id: "WF-005", gate_name: "Authorization Form", evidence_type: "form", required: 1 },
        { workflow_id: "WF-006", gate_name: "Onboarding Checklist", evidence_type: "checklist", required: 1 },
      ];

      for (const g of defaultGates) {
        sqlite.prepare(
          "INSERT OR IGNORE INTO evidence_gates (id, workflow_id, gate_name, evidence_type, required, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
        ).run(randomUUID(), g.workflow_id, g.gate_name, g.evidence_type, g.required);
      }

      // Build task query
      let taskSql = "SELECT * FROM work_queue WHERE 1=1";
      const params: string[] = [];
      if (input?.assignedTo) { taskSql += " AND assigned_to = ?"; params.push(input.assignedTo); }
      if (input?.status) { taskSql += " AND status = ?"; params.push(input.status); }
      else { taskSql += " AND status IN ('pending', 'in-progress')"; }
      taskSql += " ORDER BY priority DESC, due_date ASC";

      const tasks = (sqlite.prepare(taskSql).all(...params) ?? []) as WorkTaskRow[];

      // Group tasks by workflow
      const workflowMap = new Map<string, WorkflowGroup>();

      // Always include all active workflows even if they have no tasks
      const allWorkflows = sqlite.prepare("SELECT workflow_id, workflow_name FROM workflow_definitions WHERE is_active = 1").all() as WorkflowDefinitionRow[];
      for (const wf of allWorkflows) {
        workflowMap.set(wf.workflow_id, {
          workflowId: wf.workflow_id,
          workflowName: wf.workflow_name,
          tasks: [],
          evidenceGates: [],
        });
      }

      // Distribute tasks into workflow groups
      for (const task of tasks) {
        const wfId = task.workflow_id ?? "WF-007"; // Default to General Task
        const group = workflowMap.get(wfId);
        if (group) {
          group.tasks.push(task);
        } else {
          // Workflow not in definitions — create ad-hoc group
          workflowMap.set(wfId, {
            workflowId: wfId,
            workflowName: task.task_type ?? "Uncategorized",
            tasks: [task],
            evidenceGates: [],
          });
        }
      }

      // Fetch evidence gates for each workflow
      for (const [wfId, group] of workflowMap.entries()) {
        const gates = sqlite.prepare(
          "SELECT gate_name, evidence_type, required FROM evidence_gates WHERE workflow_id = ? ORDER BY sort_order"
        ).all(wfId) as EvidenceGateRow[];

        if (gates.length > 0) {
          // Check completion status per gate for this workflow's tasks
          const allTaskIds = group.tasks.map((t) => t.id);
          const uploadedEvidence = allTaskIds.length > 0
            ? sqlite.prepare(
                `SELECT DISTINCT evidence_type FROM task_evidence WHERE task_id IN (${allTaskIds.map(() => "?").join(",")})`
              ).all(...allTaskIds) as EvidenceTypeRow[]
            : [];
          const uploadedTypes = new Set(uploadedEvidence.map((e) => e.evidence_type));

          group.evidenceGates = gates.map((g) => ({
            gateName: g.gate_name,
            required: g.required === 1,
            completed: uploadedTypes.has(g.evidence_type),
          }));
        } else {
          group.evidenceGates = [];
        }
      }

      // Filter out empty workflow groups (keep only those with tasks)
      const workflowsWithTasks = Array.from(workflowMap.values()).filter((g) => g.tasks.length > 0);

      // Compute stats
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];

      let overdue = 0;
      let dueToday = 0;
      let completed = 0;

      for (const task of tasks) {
        if (task.status === "completed") completed++;
        if (task.due_date) {
          const dueStr = task.due_date.split("T")[0];
          if (dueStr < todayStr && task.status !== "completed") overdue++;
          if (dueStr === todayStr && task.status !== "completed") dueToday++;
        }
      }

      return {
        workflows: workflowsWithTasks,
        stats: {
          total: tasks.length,
          overdue,
          dueToday,
          completed,
        },
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // ═══ D003-04: Escalation Timer ═══════════════════════════
  // ═══════════════════════════════════════════════════════════

  checkEscalation: authedQuery.query(async () => {
    const now = new Date().toISOString();

    // Find all overdue non-completed tasks
    const overdueTasks = sqlite.prepare(
      "SELECT * FROM work_queue WHERE due_date < ? AND status != 'completed' AND escalation_level < 3"
    ).all(now) as WorkTaskRow[];

    const escalated: EscalatedTask[] = [];

    for (const task of overdueTasks) {
      const previousLevel = task.escalation_level ?? 0;
      const newLevel = Math.min(previousLevel + 1, 3);

      // Update escalation level on the task
      sqlite.prepare(
        "UPDATE work_queue SET escalation_level = ?, escalated_at = datetime('now'), escalation_reason = ? WHERE id = ?"
      ).run(newLevel, `Auto-escalated: due date passed (${task.due_date})`, task.id);

      // Log escalation event
      sqlite.prepare(
        "INSERT INTO escalation_log (id, task_id, previous_level, new_level, reason, escalated_by, notification_sent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(
        randomUUID(),
        task.id,
        previousLevel,
        newLevel,
        `Auto-escalated: due date passed (${task.due_date})`,
        "system",
        1
      );

      // Generate supervisor notification
      const supervisorId = task.assigned_by ?? "shift-supervisor";
      sqlite.prepare(
        "INSERT INTO notifications (id, user_id, type, title, message, person_name, module_name, action_href, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))"
      ).run(
        randomUUID(),
        supervisorId,
        "escalation",
        `Task Escalated to Level ${newLevel}`,
        `Task "${task.task_title}" (ID: ${task.id}) has been auto-escalated to level ${newLevel} due to missed due date (${task.due_date}).`,
        task.assigned_to,
        "work-queue",
        `/work-queue/task/${task.id}`
      );

      escalated.push({
        taskId: task.id,
        taskTitle: task.task_title,
        previousLevel,
        newLevel,
        dueDate: task.due_date,
        assignedTo: task.assigned_to,
        escalationReason: `Auto-escalated: due date passed`,
      });
    }

    return {
      checkedAt: now,
      escalatedCount: escalated.length,
      escalatedTasks: escalated,
    };
  }),

  escalateWorkTask: adminQuery
    .input(z.object({
      taskId: z.string(),
      reason: z.string(),
      newLevel: z.number().min(1).max(3).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";

      const task = sqlite.prepare("SELECT * FROM work_queue WHERE id = ?").get(input.taskId) as WorkTaskRow | undefined;
      if (!task) {
        throw new Error("Task not found");
      }

      const previousLevel = task.escalation_level ?? 0;
      const resolvedNewLevel = input.newLevel ?? Math.min(previousLevel + 1, 3);

      if (previousLevel >= resolvedNewLevel) {
        throw new Error(`Task is already at escalation level ${previousLevel}. Cannot escalate to ${resolvedNewLevel}.`);
      }

      // Update task escalation
      sqlite.prepare(
        "UPDATE work_queue SET escalation_level = ?, escalated_at = datetime('now'), escalation_reason = ? WHERE id = ?"
      ).run(resolvedNewLevel, input.reason, input.taskId);

      // Log escalation event
      sqlite.prepare(
        "INSERT INTO escalation_log (id, task_id, previous_level, new_level, reason, escalated_by, notification_sent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(
        randomUUID(),
        input.taskId,
        previousLevel,
        resolvedNewLevel,
        input.reason,
        actor,
        1
      );

      // Generate supervisor notification
      const supervisorId = task.assigned_by ?? "shift-supervisor";
      sqlite.prepare(
        "INSERT INTO notifications (id, user_id, type, title, message, person_name, module_name, action_href, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))"
      ).run(
        randomUUID(),
        supervisorId,
        "escalation",
        `Task Manually Escalated to Level ${resolvedNewLevel}`,
        `Task "${task.task_title}" (ID: ${input.taskId}) has been manually escalated to level ${resolvedNewLevel} by ${actor}. Reason: ${input.reason}`,
        task.assigned_to,
        "work-queue",
        `/work-queue/task/${input.taskId}`
      );

      auditLog({
        action: "m1:escalateWorkTask",
        actor,
        resource: `task:${input.taskId}`,
        details: `Escalated from level ${previousLevel} to ${resolvedNewLevel}. Reason: ${input.reason}`,
      });

      return {
        success: true,
        taskId: input.taskId,
        previousLevel,
        newLevel: resolvedNewLevel,
        reason: input.reason,
        escalatedBy: actor,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // ═══ D003-05: Reassignment ═══════════════════════════════
  // ═══════════════════════════════════════════════════════════

  reassignWorkTask: adminQuery
    .input(z.object({
      taskId: z.string(),
      newAssigneeId: z.string(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";

      const task = sqlite.prepare("SELECT * FROM work_queue WHERE id = ?").get(input.taskId) as WorkTaskRow | undefined;
      if (!task) {
        throw new Error("Task not found");
      }

      const oldAssignee = task.assigned_to ?? null;
      const timestamp = new Date().toISOString();

      // Update the task assignment
      sqlite.prepare(
        "UPDATE work_queue SET assigned_to = ? WHERE id = ?"
      ).run(input.newAssigneeId, input.taskId);

      // Log reassignment
      sqlite.prepare(
        "INSERT INTO reassignment_log (id, task_id, old_assignee, new_assignee, reason, reassigned_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        randomUUID(),
        input.taskId,
        oldAssignee,
        input.newAssigneeId,
        input.reason,
        actor,
        timestamp
      );

      // Generate notification for new assignee
      sqlite.prepare(
        "INSERT INTO notifications (id, user_id, type, title, message, person_name, module_name, action_href, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))"
      ).run(
        randomUUID(),
        input.newAssigneeId,
        "reassignment",
        "Task Reassigned to You",
        `Task "${task.task_title}" (ID: ${input.taskId}) has been assigned to you by ${actor}. Reason: ${input.reason}`,
        input.newAssigneeId,
        "work-queue",
        `/work-queue/task/${input.taskId}`
      );

      auditLog({
        action: "m1:reassignWorkTask",
        actor,
        resource: `task:${input.taskId}`,
        details: `Reassigned from ${oldAssignee ?? "unassigned"} to ${input.newAssigneeId}. Reason: ${input.reason}`,
      });

      // Return the updated task
      const updatedTask = sqlite.prepare("SELECT * FROM work_queue WHERE id = ?").get(input.taskId);

      return {
        success: true,
        task: updatedTask,
        reassignment: {
          taskId: input.taskId,
          oldAssignee,
          newAssignee: input.newAssigneeId,
          reason: input.reason,
          reassignedBy: actor,
          reassignedAt: timestamp,
        },
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // ═══ D003: Workflow & Evidence Management ════════════════
  // ═══════════════════════════════════════════════════════════

  seedWorkflowDefinitions: adminQuery.mutation(async ({ ctx }) => {
    const actor = ctx.user?.email ?? "unknown";
    const workflows = [
      { workflow_id: "WF-001", workflow_name: "Referral Intake", category: "GRO" },
      { workflow_id: "WF-002", workflow_name: "Clinical Assessment", category: "Clinical" },
      { workflow_id: "WF-003", workflow_name: "Credential Verification", category: "HR" },
      { workflow_id: "WF-004", workflow_name: "Incident Reporting", category: "QA" },
      { workflow_id: "WF-005", workflow_name: "Authorization Request", category: "Revenue" },
      { workflow_id: "WF-006", workflow_name: "Onboarding Review", category: "HR" },
      { workflow_id: "WF-007", workflow_name: "General Task", category: "general" },
    ];

    let seeded = 0;
    for (const wf of workflows) {
      const existing = sqlite.prepare("SELECT id FROM workflow_definitions WHERE workflow_id = ?").get(wf.workflow_id) as IdRow | undefined;
      if (!existing) {
        sqlite.prepare(
          "INSERT INTO workflow_definitions (id, workflow_id, workflow_name, category, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
        ).run(randomUUID(), wf.workflow_id, wf.workflow_name, wf.category);
        seeded++;
      }
    }

    // Seed default evidence gates
    const defaultGates = [
      { workflow_id: "WF-001", gate_name: "Referral Form", evidence_type: "form", required: 1 },
      { workflow_id: "WF-001", gate_name: "Consent Document", evidence_type: "consent", required: 1 },
      { workflow_id: "WF-002", gate_name: "Assessment Notes", evidence_type: "notes", required: 1 },
      { workflow_id: "WF-002", gate_name: "Care Plan", evidence_type: "plan", required: 0 },
      { workflow_id: "WF-003", gate_name: "Credential Document", evidence_type: "credential", required: 1 },
      { workflow_id: "WF-004", gate_name: "Incident Report Form", evidence_type: "form", required: 1 },
      { workflow_id: "WF-004", gate_name: "Witness Statement", evidence_type: "statement", required: 0 },
      { workflow_id: "WF-005", gate_name: "Authorization Form", evidence_type: "form", required: 1 },
      { workflow_id: "WF-006", gate_name: "Onboarding Checklist", evidence_type: "checklist", required: 1 },
    ];

    let gatesSeeded = 0;
    for (const g of defaultGates) {
      const existing = sqlite.prepare(
        "SELECT id FROM evidence_gates WHERE workflow_id = ? AND gate_name = ?"
      ).get(g.workflow_id, g.gate_name) as IdRow | undefined;
      if (!existing) {
        sqlite.prepare(
          "INSERT INTO evidence_gates (id, workflow_id, gate_name, evidence_type, required, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
        ).run(randomUUID(), g.workflow_id, g.gate_name, g.evidence_type, g.required);
        gatesSeeded++;
      }
    }

    auditLog({ action: "m1:seedWorkflows", actor, resource: "system", details: `Seeded ${seeded} workflows and ${gatesSeeded} evidence gates` });
    return { seeded, gatesSeeded };
  }),

  listWorkflowDefinitions: authedQuery.query(async () => {
    return sqlite.prepare("SELECT * FROM workflow_definitions WHERE is_active = 1 ORDER BY category, workflow_name").all() ?? [];
  }),

  // ─── M1 Dashboard KPIs ───────────────────────────────────
  dashboardKPIs: authedQuery.query(async () => {
    const totalInOnboarding = (sqlite.prepare("SELECT COUNT(DISTINCT person_id) as c FROM onboarding_progress").get() as CountRow | undefined)?.c ?? 0;
    const modulesCompleted = (sqlite.prepare("SELECT COUNT(*) as c FROM onboarding_progress WHERE status = 'completed'").get() as CountRow | undefined)?.c ?? 0;
    const totalModules = (sqlite.prepare("SELECT COUNT(*) as c FROM onboarding_progress").get() as CountRow | undefined)?.c ?? 0;
    const credentialAlerts = (sqlite.prepare("SELECT COUNT(*) as c FROM credential_expiries WHERE alert_status IN ('warning', 'expired')").get() as CountRow | undefined)?.c ?? 0;
    const pendingTasks = (sqlite.prepare("SELECT COUNT(*) as c FROM work_queue WHERE status IN ('pending', 'in-progress')").get() as CountRow | undefined)?.c ?? 0;
    const evidencePackets = (sqlite.prepare("SELECT COUNT(*) as c FROM evidence_packets").get() as CountRow | undefined)?.c ?? 0;
    const rtdClearedRaw = sqlite.prepare("SELECT person_id FROM onboarding_progress WHERE status = 'completed' GROUP BY person_id").all();
    const rtdCleared = Array.isArray(rtdClearedRaw) ? rtdClearedRaw : [];

    return {
      totalInOnboarding,
      modulesCompleted,
      totalModules,
      completionRate: totalModules > 0 ? Math.round((modulesCompleted / totalModules) * 100) : 0,
      credentialAlerts,
      pendingTasks,
      evidencePackets,
      rtdReady: rtdCleared.length,
    };
  }),
});
