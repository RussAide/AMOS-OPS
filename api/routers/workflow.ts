import { z } from "zod";
import {
  createRouter,
  publicQuery,
  authedQuery,
  adminQuery,
} from "../middleware";
import { sqlite } from "../queries/connection";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";

// ═══════════════════════════════════════════════════════════════
// D005: Workflow Engine — 8 Complete Workflow Definitions
// Tasks: D005-01 through D005-09
// ═══════════════════════════════════════════════════════════════

// ─── Workflow Configuration Types ────────────────────────────

interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  statusMap: string[];
  evidenceGates: EvidenceGateConfig[];
  escalationRules: EscalationRuleConfig[];
  entityType: string;
}

interface EvidenceGateConfig {
  name: string;
  required: boolean;
  description: string;
}

interface EscalationRuleConfig {
  condition: string;
  triggerDescription: string;
  target: string;
  maxHours?: number;
  maxDays?: number;
}

interface EvidenceSubmissionRow {
  gateName: string;
  fileName: string | null;
  filePath: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  validated: number;
}

interface WorkflowIdRow {
  workflow_id: string;
}

interface WorkflowInstanceRow extends Record<string, unknown> {
  id: number;
  workflow_id: string;
  current_status: string;
  updated_at: string | null;
  escalation_level: number | null;
  escalation_reason: string | null;
  notes: string | null;
}

export const M41C_WORKFLOW_LEGACY_CANS_LOGIC_QUARANTINED =
  "M41C_LEGACY_CANS_LOGIC_QUARANTINED" as const;

export function quarantineWf002LegacyCansLogic(): never {
  throw new Error(M41C_WORKFLOW_LEGACY_CANS_LOGIC_QUARANTINED);
}

export function assertWf002TransitionInputAllowed(toStatus: string): void {
  if (toStatus === "CANS-COMPLETE") {
    quarantineWf002LegacyCansLogic();
  }
}

export function assertWf002EvidenceInputAllowed(gateName: string): void {
  if (gateName === "cans_assessment") {
    quarantineWf002LegacyCansLogic();
  }
}

export function assertWf002TransitionSequence(
  fromStatus: string,
  toStatus: string,
): void {
  if (fromStatus === "CANS-COMPLETE") {
    quarantineWf002LegacyCansLogic();
  }
  if (toStatus === "PLAN-DEVELOPED" && fromStatus !== "IN-PROGRESS") {
    throw new Error("WF002_PLAN_DEVELOPMENT_SEQUENCE_REQUIRED");
  }
}

// ─── 8 Workflow Definitions ──────────────────────────────────

const WORKFLOW_DEFINITIONS: WorkflowConfig[] = [
  // WF-001: Referral Intake
  {
    id: "WF-001",
    name: "Referral Intake",
    description:
      "Youth referral intake workflow from receipt through scheduling",
    statusMap: ["RECEIVED", "SCREENING", "ACCEPTED", "DECLINED", "SCHEDULED"],
    evidenceGates: [
      {
        name: "demographics_form",
        required: true,
        description: "Complete demographics form for the youth",
      },
      {
        name: "insurance_verification",
        required: true,
        description: "Insurance eligibility verification completed",
      },
      {
        name: "clinical_criteria_checklist",
        required: true,
        description: "Clinical criteria checklist for admission",
      },
    ],
    escalationRules: [
      {
        condition: "unscreened_over_48h",
        triggerDescription: ">48 hours unscreened",
        target: "clinical-supervisor",
        maxHours: 48,
      },
      {
        condition: "clinical_risk_detected",
        triggerDescription: "Clinical risk detected during screening",
        target: "Treatment Director",
      },
    ],
    entityType: "patient",
  },
  // WF-002: Clinical Assessment
  {
    id: "WF-002",
    name: "Clinical Assessment",
    description:
      "Structured clinical assessment and treatment plan development",
    statusMap: ["SCHEDULED", "IN-PROGRESS", "PLAN-DEVELOPED"],
    evidenceGates: [
      {
        name: "treatment_review_report",
        required: true,
        description: "Treatment Review Report (TRR)",
      },
      {
        name: "diagnosis_documentation",
        required: true,
        description: "DSM-5 diagnosis documentation with ICD-10 codes",
      },
      {
        name: "treatment_plan_draft",
        required: true,
        description: "Individualized treatment plan draft",
      },
    ],
    escalationRules: [
      {
        condition: "incomplete_over_5_days",
        triggerDescription: ">5 days incomplete",
        target: "Clinical Director",
        maxDays: 5,
      },
      {
        condition: "risk_flags",
        triggerDescription: "Risk flags identified during assessment",
        target: "clinical-supervisor",
      },
    ],
    entityType: "patient",
  },
  // WF-003: Service Delivery
  {
    id: "WF-003",
    name: "Service Delivery",
    description: "Ongoing clinical service delivery with progress tracking",
    statusMap: [
      "AUTHORIZED",
      "ACTIVE",
      "PROGRESS-REVIEW",
      "COMPLETED",
      "DISCHARGE",
    ],
    evidenceGates: [
      {
        name: "service_notes",
        required: true,
        description: "Service notes for each session delivered",
      },
      {
        name: "outcome_measures",
        required: true,
        description: "Outcome measurement scores (CANS, PHQ-9, etc.)",
      },
      {
        name: "progress_summaries",
        required: true,
        description: "Progress summaries at review intervals",
      },
    ],
    escalationRules: [
      {
        condition: "no_note_over_7_days",
        triggerDescription: ">7 days without a service note",
        target: "clinical-supervisor",
        maxDays: 7,
      },
      {
        condition: "deteriorating_outcomes",
        triggerDescription: "Deteriorating outcome scores",
        target: "clinical review",
      },
    ],
    entityType: "patient",
  },
  // WF-004: GRO Shift Operations
  {
    id: "WF-004",
    name: "GRO Shift Operations",
    description: "GRO residential shift lifecycle from start through handoff",
    statusMap: ["SHIFT-START", "ROUNDS", "ACTIVITIES", "SHIFT-END", "HANDOFF"],
    evidenceGates: [
      {
        name: "shift_log",
        required: true,
        description: "Complete shift log documentation",
      },
      {
        name: "safety_round_checklist",
        required: true,
        description: "Safety round checklist completion",
      },
      {
        name: "youth_care_notes",
        required: true,
        description: "Youth care notes for the shift",
      },
      {
        name: "incident_reports",
        required: false,
        description: "Incident reports (if applicable)",
      },
    ],
    escalationRules: [
      {
        condition: "incident_occurred",
        triggerDescription: "Incident occurred during shift",
        target: "on-call supervisor",
      },
      {
        condition: "safety_concern",
        triggerDescription: "Safety concern identified",
        target: "GRO Administrator",
      },
    ],
    entityType: "shift",
  },
  // WF-005: Incident Reporting
  {
    id: "WF-005",
    name: "Incident Reporting",
    description:
      "Incident reporting, investigation, and corrective action workflow",
    statusMap: [
      "REPORTED",
      "REVIEWED",
      "INVESTIGATION",
      "CORRECTIVE-ACTION",
      "CLOSED",
    ],
    evidenceGates: [
      {
        name: "incident_report_form",
        required: true,
        description: "Completed incident report form",
      },
      {
        name: "witness_statements",
        required: true,
        description: "Witness statements documentation",
      },
      {
        name: "investigation_notes",
        required: true,
        description: "Investigation notes and findings",
      },
      {
        name: "corrective_action_plan",
        required: true,
        description: "Corrective action plan with assigned owners",
      },
    ],
    escalationRules: [
      {
        condition: "serious_injury_or_abuse",
        triggerDescription: "Serious injury or abuse allegation",
        target: "Administrator/LCCA + state reporting",
      },
      {
        condition: "unreviewed_over_24h",
        triggerDescription: ">24 hours unreviewed",
        target: "shift-supervisor",
        maxHours: 24,
      },
    ],
    entityType: "incident",
  },
  // WF-006: CAP/Audit Readiness
  {
    id: "WF-006",
    name: "CAP/Audit Readiness",
    description: "Corrective Action Plan workflow for audit findings",
    statusMap: [
      "IDENTIFIED",
      "ASSIGNED",
      "IN-PROGRESS",
      "EVIDENCE-SUBMITTED",
      "VERIFIED",
      "CLOSED",
    ],
    evidenceGates: [
      {
        name: "cap_plan",
        required: true,
        description: "Corrective Action Plan with timelines",
      },
      {
        name: "evidence_of_correction",
        required: true,
        description: "Evidence that corrective actions were implemented",
      },
      {
        name: "sustainability_measures",
        required: true,
        description: "Sustainability measures to prevent recurrence",
      },
      {
        name: "verification_documentation",
        required: true,
        description: "Verification documentation from QA",
      },
    ],
    escalationRules: [
      {
        condition: "overdue_over_30_days",
        triggerDescription: ">30 days overdue",
        target: "Administrator/LCCA",
        maxDays: 30,
      },
      {
        condition: "repeat_finding",
        triggerDescription: "Repeat finding from prior audit",
        target: "Board",
      },
    ],
    entityType: "audit",
  },
  // WF-007: Billing Gate
  {
    id: "WF-007",
    name: "Billing Gate",
    description:
      "Revenue cycle billing workflow from service documentation to payment",
    statusMap: [
      "SERVICE-DOCUMENTED",
      "REVIEWED",
      "AUTH-VERIFIED",
      "SUBMITTED",
      "PAID",
      "DENIED",
    ],
    evidenceGates: [
      {
        name: "service_note_billing_code",
        required: true,
        description: "Service note with correct billing code",
      },
      {
        name: "authorization_match",
        required: true,
        description: "Authorization match verification",
      },
      {
        name: "proof_of_service",
        required: true,
        description: "Proof of service delivery",
      },
    ],
    escalationRules: [
      {
        condition: "service_to_doc_over_48h",
        triggerDescription: ">48 hours from service to documentation",
        target: "clinical-supervisor",
        maxHours: 48,
      },
      {
        condition: "claim_denied",
        triggerDescription: "Claim denied",
        target: "appeal workflow",
      },
    ],
    entityType: "claim",
  },
  // WF-008: Executive Decision Routing
  {
    id: "WF-008",
    name: "Executive Decision Routing",
    description:
      "Executive-level decision routing for high-impact organizational decisions",
    statusMap: [
      "SUBMITTED",
      "ADMIN-REVIEW",
      "BOARD-PREVIEW",
      "APPROVED",
      "REJECTED",
      "IMPLEMENTED",
    ],
    evidenceGates: [
      {
        name: "decision_memo",
        required: true,
        description: "Decision memo with rationale",
      },
      {
        name: "financial_impact_analysis",
        required: true,
        description: "Financial impact analysis",
      },
      {
        name: "risk_assessment",
        required: true,
        description: "Risk assessment documentation",
      },
      {
        name: "stakeholder_input",
        required: true,
        description: "Stakeholder input documentation",
      },
    ],
    escalationRules: [
      {
        condition: "pending_over_14_days",
        triggerDescription: ">14 days pending",
        target: "Board chair",
        maxDays: 14,
      },
      {
        condition: "urgent_risk",
        triggerDescription: "Urgent risk identified",
        target: "emergency session",
      },
    ],
    entityType: "decision",
  },
];

// ─── Helper: Get workflow config by ID ───────────────────────

function getWorkflowConfig(workflowId: string): WorkflowConfig {
  const cfg = WORKFLOW_DEFINITIONS.find((w) => w.id === workflowId);
  if (!cfg) throw new Error(`Workflow definition not found: ${workflowId}`);
  return cfg;
}

// ─── Helper: Log workflow transition ─────────────────────────

function logTransition(opts: {
  instanceId: number;
  fromStatus: string;
  toStatus: string;
  actor: string;
  reason?: string;
}) {
  sqlite
    .prepare(
      `INSERT INTO workflow_transitions_v2 (instance_id, from_status, to_status, actor, reason, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(
      opts.instanceId,
      opts.fromStatus,
      opts.toStatus,
      opts.actor,
      opts.reason ?? null,
    );
}

// ─── Helper: Check if status transition is valid ─────────────

function isValidTransition(
  workflowId: string,
  fromStatus: string,
  toStatus: string,
): boolean {
  const cfg = getWorkflowConfig(workflowId);
  const statuses = cfg.statusMap;
  const fromIdx = statuses.indexOf(fromStatus);
  const toIdx = statuses.indexOf(toStatus);
  if (fromIdx === -1 || toIdx === -1) return false;
  // Allow forward transitions (including skipping), no backward
  return toIdx > fromIdx;
}

// ─── Helper: Get evidence submission status for instance ─────

function getEvidenceStatus(instanceId: number): Array<{
  gateName: string;
  required: boolean;
  submitted: boolean;
  fileName: string | null;
  filePath: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  validated: boolean;
}> {
  const evidence = sqlite
    .prepare(
      `SELECT gate_name as gateName, file_name as fileName, file_path as filePath,
            submitted_by as submittedBy, submitted_at as submittedAt, validated
     FROM workflow_evidence_v2 WHERE instance_id = ?`,
    )
    .all(instanceId) as EvidenceSubmissionRow[];

  const instance = sqlite
    .prepare(`SELECT workflow_id FROM workflow_instances_v2 WHERE id = ?`)
    .get(instanceId) as WorkflowIdRow | undefined;
  if (!instance) return [];

  const cfg = getWorkflowConfig(instance.workflow_id);
  return cfg.evidenceGates.map((gate) => {
    const ev = evidence.find((e) => e.gateName === gate.name);
    return {
      gateName: gate.name,
      required: gate.required,
      submitted: !!ev,
      fileName: ev?.fileName ?? null,
      filePath: ev?.filePath ?? null,
      submittedBy: ev?.submittedBy ?? null,
      submittedAt: ev?.submittedAt ?? null,
      validated: ev?.validated === 1,
    };
  });
}

// ─── Helper: Build escalation check result ───────────────────

function checkEscalation(
  instance: WorkflowInstanceRow,
  cfg: WorkflowConfig,
): {
  isEscalated: boolean;
  escalationLevel: number;
  escalationReason: string | null;
  escalationTarget: string | null;
  hoursInStatus: number | null;
} {
  const now = new Date();
  const updatedAt = instance.updated_at ? new Date(instance.updated_at) : now;
  const hoursInStatus = Math.floor(
    (now.getTime() - updatedAt.getTime()) / 3600000,
  );
  const daysInStatus = Math.floor(hoursInStatus / 24);

  let escalationLevel = instance.escalation_level ?? 0;
  let escalationReason = instance.escalation_reason;
  let escalationTarget: string | null = null;
  let isEscalated = false;

  for (const rule of cfg.escalationRules) {
    let triggered = false;
    if (rule.maxHours && hoursInStatus >= rule.maxHours) triggered = true;
    if (rule.maxDays && daysInStatus >= rule.maxDays) triggered = true;
    if (
      rule.condition === "clinical_risk_detected" &&
      instance.notes?.includes("RISK:")
    )
      triggered = true;
    if (rule.condition === "risk_flags" && instance.notes?.includes("RISK:"))
      triggered = true;
    if (
      rule.condition === "incident_occurred" &&
      instance.notes?.includes("INCIDENT:")
    )
      triggered = true;
    if (
      rule.condition === "safety_concern" &&
      instance.notes?.includes("SAFETY:")
    )
      triggered = true;
    if (
      rule.condition === "serious_injury_or_abuse" &&
      instance.notes?.includes("SERIOUS:")
    )
      triggered = true;
    if (
      rule.condition === "deteriorating_outcomes" &&
      instance.notes?.includes("DETERIORATING:")
    )
      triggered = true;
    if (
      rule.condition === "claim_denied" &&
      instance.current_status === "DENIED"
    )
      triggered = true;
    if (
      rule.condition === "repeat_finding" &&
      instance.notes?.includes("REPEAT:")
    )
      triggered = true;
    if (rule.condition === "urgent_risk" && instance.notes?.includes("URGENT:"))
      triggered = true;

    if (triggered) {
      escalationLevel = Math.max(escalationLevel, 1);
      escalationReason = rule.triggerDescription;
      escalationTarget = rule.target;
      isEscalated = true;
      break;
    }
  }

  return {
    isEscalated,
    escalationLevel,
    escalationReason,
    escalationTarget,
    hoursInStatus: hoursInStatus || 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// SHARED WORKFLOW ENDPOINTS
// ═══════════════════════════════════════════════════════════════

export const workflowRouter = createRouter({
  // ─── List Workflow Definitions ─────────────────────────────

  listWorkflowDefinitions: authedQuery.query(async () => {
    return WORKFLOW_DEFINITIONS.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      statusMap: w.statusMap,
      evidenceGateCount: w.evidenceGates.length,
      escalationRuleCount: w.escalationRules.length,
      entityType: w.entityType,
    }));
  }),

  // ─── Get Single Workflow Definition ────────────────────────

  getWorkflowDefinition: authedQuery
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ input }) => {
      const cfg = getWorkflowConfig(input.workflowId);
      return {
        id: cfg.id,
        name: cfg.name,
        description: cfg.description,
        statusMap: cfg.statusMap,
        evidenceGates: cfg.evidenceGates,
        escalationRules: cfg.escalationRules,
        entityType: cfg.entityType,
      };
    }),

  // ─── Seed All Workflow Definitions into DB ─────────────────

  seedWorkflowDefinitions: adminQuery.mutation(async () => {
    assertSyntheticScenarioRuntime(env);
    const now = new Date().toISOString();
    const stmt = sqlite.prepare(
      `INSERT OR IGNORE INTO workflow_definitions_v2 (id, name, description, status_map, evidence_gates, escalation_rules, entity_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const w of WORKFLOW_DEFINITIONS) {
      stmt.run(
        w.id,
        w.name,
        w.description,
        JSON.stringify(w.statusMap),
        JSON.stringify(w.evidenceGates),
        JSON.stringify(w.escalationRules),
        w.entityType,
        now,
      );
    }
    const wf002 = getWorkflowConfig("WF-002");
    sqlite
      .prepare(
        `UPDATE workflow_definitions_v2
       SET name = ?, description = ?, status_map = ?, evidence_gates = ?, escalation_rules = ?, entity_type = ?
       WHERE id = 'WF-002'`,
      )
      .run(
        wf002.name,
        wf002.description,
        JSON.stringify(wf002.statusMap),
        JSON.stringify(wf002.evidenceGates),
        JSON.stringify(wf002.escalationRules),
        wf002.entityType,
      );
    return { seeded: WORKFLOW_DEFINITIONS.length };
  }),

  // ═══════════════════════════════════════════════════════════════
  // WF-001: REFERRAL INTAKE (D005-01)
  // ═══════════════════════════════════════════════════════════════

  createReferralIntakeInstance: adminQuery
    .input(
      z.object({
        entityId: z.string(),
        assignedTo: z.string(),
        notes: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      const result = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, 0, ?)`,
        )
        .run(
          "WF-001",
          input.entityId,
          "patient",
          "RECEIVED",
          "",
          input.assignedTo,
          actor,
          input.dueDate ?? null,
          input.notes ?? null,
        );
      const instanceId = Number(result.lastInsertRowid);
      logTransition({
        instanceId,
        fromStatus: "",
        toStatus: "RECEIVED",
        actor,
        reason: "Instance created",
      });
      return { instanceId, workflowId: "WF-001", status: "RECEIVED" };
    }),

  transitionReferralIntakeStatus: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        toStatus: z.enum([
          "RECEIVED",
          "SCREENING",
          "ACCEPTED",
          "DECLINED",
          "SCHEDULED",
        ]),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      if (instance.workflow_id !== "WF-001")
        throw new Error("Not a WF-001 instance");
      if (
        !isValidTransition("WF-001", instance.current_status, input.toStatus)
      ) {
        throw new Error(
          `Invalid transition: ${instance.current_status} -> ${input.toStatus}`,
        );
      }
      const actor = ctx.user.email;
      const fromStatus = instance.current_status;
      sqlite
        .prepare(
          `UPDATE workflow_instances_v2 SET current_status = ?, previous_status = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .run(input.toStatus, fromStatus, input.instanceId);
      logTransition({
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
        actor,
        reason: input.reason,
      });
      return {
        success: true,
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
      };
    }),

  getReferralIntakeInstance: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      const evidence = getEvidenceStatus(input.instanceId);
      const cfg = getWorkflowConfig(instance.workflow_id);
      const escalation = checkEscalation(instance, cfg);
      return { ...instance, evidence, escalation };
    }),

  listReferralIntakeInstances: authedQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          limit: z.number().default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = `SELECT * FROM workflow_instances_v2 WHERE workflow_id = 'WF-001'`;
      const params: unknown[] = [];
      if (input?.status) {
        sql += ` AND current_status = ?`;
        params.push(input.status);
      }
      sql += ` ORDER BY updated_at DESC LIMIT ?`;
      params.push(input?.limit ?? 50);
      const rows = sqlite.prepare(sql).all(...params) as WorkflowInstanceRow[];
      return rows.map((r) => ({
        ...r,
        escalation: checkEscalation(r, getWorkflowConfig("WF-001")),
      }));
    }),

  getReferralIntakeEvidenceGates: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT workflow_id FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowIdRow | undefined;
      if (!instance) throw new Error("Instance not found");
      return { evidence: getEvidenceStatus(input.instanceId) };
    }),

  submitReferralIntakeEvidence: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        gateName: z.enum([
          "demographics_form",
          "insurance_verification",
          "clinical_criteria_checklist",
        ]),
        fileName: z.string(),
        filePath: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      sqlite
        .prepare(
          `INSERT INTO workflow_evidence_v2 (instance_id, gate_name, file_name, file_path, submitted_by, submitted_at, validated)
         VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`,
        )
        .run(
          input.instanceId,
          input.gateName,
          input.fileName,
          input.filePath,
          actor,
        );
      return { success: true, gateName: input.gateName };
    }),

  checkReferralIntakeEscalation: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      const cfg = getWorkflowConfig("WF-001");
      return checkEscalation(instance, cfg);
    }),

  // ═══════════════════════════════════════════════════════════════
  // WF-002: CLINICAL ASSESSMENT (D005-02)
  // ═══════════════════════════════════════════════════════════════

  createClinicalAssessmentInstance: adminQuery
    .input(
      z.object({
        entityId: z.string(),
        assignedTo: z.string(),
        notes: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      const result = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, 0, ?)`,
        )
        .run(
          "WF-002",
          input.entityId,
          "patient",
          "SCHEDULED",
          "",
          input.assignedTo,
          actor,
          input.dueDate ?? null,
          input.notes ?? null,
        );
      const instanceId = Number(result.lastInsertRowid);
      logTransition({
        instanceId,
        fromStatus: "",
        toStatus: "SCHEDULED",
        actor,
        reason: "Instance created",
      });
      return { instanceId, workflowId: "WF-002", status: "SCHEDULED" };
    }),

  transitionClinicalAssessmentStatus: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        toStatus: z.enum([
          "SCHEDULED",
          "IN-PROGRESS",
          "CANS-COMPLETE",
          "PLAN-DEVELOPED",
        ]),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertWf002TransitionInputAllowed(input.toStatus);
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      if (instance.workflow_id !== "WF-002")
        throw new Error("Not a WF-002 instance");
      assertWf002TransitionSequence(instance.current_status, input.toStatus);
      if (
        !isValidTransition("WF-002", instance.current_status, input.toStatus)
      ) {
        throw new Error(
          `Invalid transition: ${instance.current_status} -> ${input.toStatus}`,
        );
      }
      const actor = ctx.user.email;
      const fromStatus = instance.current_status;
      sqlite
        .prepare(
          `UPDATE workflow_instances_v2 SET current_status = ?, previous_status = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .run(input.toStatus, fromStatus, input.instanceId);
      logTransition({
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
        actor,
        reason: input.reason,
      });
      return {
        success: true,
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
      };
    }),

  getClinicalAssessmentInstance: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      const evidence = getEvidenceStatus(input.instanceId);
      const cfg = getWorkflowConfig(instance.workflow_id);
      const escalation = checkEscalation(instance, cfg);
      return { ...instance, evidence, escalation };
    }),

  listClinicalAssessmentInstances: authedQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          limit: z.number().default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = `SELECT * FROM workflow_instances_v2 WHERE workflow_id = 'WF-002'`;
      const params: unknown[] = [];
      if (input?.status) {
        sql += ` AND current_status = ?`;
        params.push(input.status);
      }
      sql += ` ORDER BY updated_at DESC LIMIT ?`;
      params.push(input?.limit ?? 50);
      const rows = sqlite.prepare(sql).all(...params) as WorkflowInstanceRow[];
      return rows.map((r) => ({
        ...r,
        escalation: checkEscalation(r, getWorkflowConfig("WF-002")),
      }));
    }),

  getClinicalAssessmentEvidenceGates: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      return { evidence: getEvidenceStatus(input.instanceId) };
    }),

  submitClinicalAssessmentEvidence: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        gateName: z.enum([
          "cans_assessment",
          "treatment_review_report",
          "diagnosis_documentation",
          "treatment_plan_draft",
        ]),
        fileName: z.string(),
        filePath: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertWf002EvidenceInputAllowed(input.gateName);
      const actor = ctx.user.email;
      sqlite
        .prepare(
          `INSERT INTO workflow_evidence_v2 (instance_id, gate_name, file_name, file_path, submitted_by, submitted_at, validated)
         VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`,
        )
        .run(
          input.instanceId,
          input.gateName,
          input.fileName,
          input.filePath,
          actor,
        );
      return { success: true, gateName: input.gateName };
    }),

  checkClinicalAssessmentEscalation: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      return checkEscalation(instance, getWorkflowConfig("WF-002"));
    }),

  // ═══════════════════════════════════════════════════════════════
  // WF-003: SERVICE DELIVERY (D005-03)
  // ═══════════════════════════════════════════════════════════════

  createServiceDeliveryInstance: adminQuery
    .input(
      z.object({
        entityId: z.string(),
        assignedTo: z.string(),
        notes: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      const result = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, 0, ?)`,
        )
        .run(
          "WF-003",
          input.entityId,
          "patient",
          "AUTHORIZED",
          "",
          input.assignedTo,
          actor,
          input.dueDate ?? null,
          input.notes ?? null,
        );
      const instanceId = Number(result.lastInsertRowid);
      logTransition({
        instanceId,
        fromStatus: "",
        toStatus: "AUTHORIZED",
        actor,
        reason: "Instance created",
      });
      return { instanceId, workflowId: "WF-003", status: "AUTHORIZED" };
    }),

  transitionServiceDeliveryStatus: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        toStatus: z.enum([
          "AUTHORIZED",
          "ACTIVE",
          "PROGRESS-REVIEW",
          "COMPLETED",
          "DISCHARGE",
        ]),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      if (instance.workflow_id !== "WF-003")
        throw new Error("Not a WF-003 instance");
      if (
        !isValidTransition("WF-003", instance.current_status, input.toStatus)
      ) {
        throw new Error(
          `Invalid transition: ${instance.current_status} -> ${input.toStatus}`,
        );
      }
      const actor = ctx.user.email;
      const fromStatus = instance.current_status;
      sqlite
        .prepare(
          `UPDATE workflow_instances_v2 SET current_status = ?, previous_status = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .run(input.toStatus, fromStatus, input.instanceId);
      logTransition({
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
        actor,
        reason: input.reason,
      });
      return {
        success: true,
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
      };
    }),

  getServiceDeliveryInstance: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      const evidence = getEvidenceStatus(input.instanceId);
      const cfg = getWorkflowConfig(instance.workflow_id);
      const escalation = checkEscalation(instance, cfg);
      return { ...instance, evidence, escalation };
    }),

  listServiceDeliveryInstances: authedQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          limit: z.number().default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = `SELECT * FROM workflow_instances_v2 WHERE workflow_id = 'WF-003'`;
      const params: unknown[] = [];
      if (input?.status) {
        sql += ` AND current_status = ?`;
        params.push(input.status);
      }
      sql += ` ORDER BY updated_at DESC LIMIT ?`;
      params.push(input?.limit ?? 50);
      const rows = sqlite.prepare(sql).all(...params) as WorkflowInstanceRow[];
      return rows.map((r) => ({
        ...r,
        escalation: checkEscalation(r, getWorkflowConfig("WF-003")),
      }));
    }),

  getServiceDeliveryEvidenceGates: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      return { evidence: getEvidenceStatus(input.instanceId) };
    }),

  submitServiceDeliveryEvidence: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        gateName: z.enum([
          "service_notes",
          "outcome_measures",
          "progress_summaries",
        ]),
        fileName: z.string(),
        filePath: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      sqlite
        .prepare(
          `INSERT INTO workflow_evidence_v2 (instance_id, gate_name, file_name, file_path, submitted_by, submitted_at, validated)
         VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`,
        )
        .run(
          input.instanceId,
          input.gateName,
          input.fileName,
          input.filePath,
          actor,
        );
      return { success: true, gateName: input.gateName };
    }),

  checkServiceDeliveryEscalation: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      return checkEscalation(instance, getWorkflowConfig("WF-003"));
    }),

  // ═══════════════════════════════════════════════════════════════
  // WF-004: GRO SHIFT OPERATIONS (D005-04)
  // ═══════════════════════════════════════════════════════════════

  createGROShiftInstance: adminQuery
    .input(
      z.object({
        entityId: z.string(),
        assignedTo: z.string(),
        notes: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      const result = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, 0, ?)`,
        )
        .run(
          "WF-004",
          input.entityId,
          "shift",
          "SHIFT-START",
          "",
          input.assignedTo,
          actor,
          input.dueDate ?? null,
          input.notes ?? null,
        );
      const instanceId = Number(result.lastInsertRowid);
      logTransition({
        instanceId,
        fromStatus: "",
        toStatus: "SHIFT-START",
        actor,
        reason: "Shift workflow created",
      });
      return { instanceId, workflowId: "WF-004", status: "SHIFT-START" };
    }),

  transitionGROShiftStatus: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        toStatus: z.enum([
          "SHIFT-START",
          "ROUNDS",
          "ACTIVITIES",
          "SHIFT-END",
          "HANDOFF",
        ]),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      if (instance.workflow_id !== "WF-004")
        throw new Error("Not a WF-004 instance");
      if (
        !isValidTransition("WF-004", instance.current_status, input.toStatus)
      ) {
        throw new Error(
          `Invalid transition: ${instance.current_status} -> ${input.toStatus}`,
        );
      }
      const actor = ctx.user.email;
      const fromStatus = instance.current_status;
      sqlite
        .prepare(
          `UPDATE workflow_instances_v2 SET current_status = ?, previous_status = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .run(input.toStatus, fromStatus, input.instanceId);
      logTransition({
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
        actor,
        reason: input.reason,
      });
      return {
        success: true,
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
      };
    }),

  getGROShiftInstance: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      const evidence = getEvidenceStatus(input.instanceId);
      const cfg = getWorkflowConfig(instance.workflow_id);
      const escalation = checkEscalation(instance, cfg);
      return { ...instance, evidence, escalation };
    }),

  listGROShiftInstances: authedQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          limit: z.number().default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = `SELECT * FROM workflow_instances_v2 WHERE workflow_id = 'WF-004'`;
      const params: unknown[] = [];
      if (input?.status) {
        sql += ` AND current_status = ?`;
        params.push(input.status);
      }
      sql += ` ORDER BY updated_at DESC LIMIT ?`;
      params.push(input?.limit ?? 50);
      const rows = sqlite.prepare(sql).all(...params) as WorkflowInstanceRow[];
      return rows.map((r) => ({
        ...r,
        escalation: checkEscalation(r, getWorkflowConfig("WF-004")),
      }));
    }),

  getGROShiftEvidenceGates: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      return { evidence: getEvidenceStatus(input.instanceId) };
    }),

  submitGROShiftEvidence: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        gateName: z.enum([
          "shift_log",
          "safety_round_checklist",
          "youth_care_notes",
          "incident_reports",
        ]),
        fileName: z.string(),
        filePath: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      sqlite
        .prepare(
          `INSERT INTO workflow_evidence_v2 (instance_id, gate_name, file_name, file_path, submitted_by, submitted_at, validated)
         VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`,
        )
        .run(
          input.instanceId,
          input.gateName,
          input.fileName,
          input.filePath,
          actor,
        );
      return { success: true, gateName: input.gateName };
    }),

  checkGROShiftEscalation: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      return checkEscalation(instance, getWorkflowConfig("WF-004"));
    }),

  // ═══════════════════════════════════════════════════════════════
  // WF-005: INCIDENT REPORTING (D005-05)
  // ═══════════════════════════════════════════════════════════════

  createIncidentReportingInstance: adminQuery
    .input(
      z.object({
        entityId: z.string(),
        assignedTo: z.string(),
        notes: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      const result = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, 0, ?)`,
        )
        .run(
          "WF-005",
          input.entityId,
          "incident",
          "REPORTED",
          "",
          input.assignedTo,
          actor,
          input.dueDate ?? null,
          input.notes ?? null,
        );
      const instanceId = Number(result.lastInsertRowid);
      logTransition({
        instanceId,
        fromStatus: "",
        toStatus: "REPORTED",
        actor,
        reason: "Incident report created",
      });
      return { instanceId, workflowId: "WF-005", status: "REPORTED" };
    }),

  transitionIncidentReportingStatus: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        toStatus: z.enum([
          "REPORTED",
          "REVIEWED",
          "INVESTIGATION",
          "CORRECTIVE-ACTION",
          "CLOSED",
        ]),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      if (instance.workflow_id !== "WF-005")
        throw new Error("Not a WF-005 instance");
      if (
        !isValidTransition("WF-005", instance.current_status, input.toStatus)
      ) {
        throw new Error(
          `Invalid transition: ${instance.current_status} -> ${input.toStatus}`,
        );
      }
      const actor = ctx.user.email;
      const fromStatus = instance.current_status;
      sqlite
        .prepare(
          `UPDATE workflow_instances_v2 SET current_status = ?, previous_status = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .run(input.toStatus, fromStatus, input.instanceId);
      logTransition({
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
        actor,
        reason: input.reason,
      });
      return {
        success: true,
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
      };
    }),

  getIncidentReportingInstance: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      const evidence = getEvidenceStatus(input.instanceId);
      const cfg = getWorkflowConfig(instance.workflow_id);
      const escalation = checkEscalation(instance, cfg);
      return { ...instance, evidence, escalation };
    }),

  listIncidentReportingInstances: authedQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          limit: z.number().default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = `SELECT * FROM workflow_instances_v2 WHERE workflow_id = 'WF-005'`;
      const params: unknown[] = [];
      if (input?.status) {
        sql += ` AND current_status = ?`;
        params.push(input.status);
      }
      sql += ` ORDER BY updated_at DESC LIMIT ?`;
      params.push(input?.limit ?? 50);
      const rows = sqlite.prepare(sql).all(...params) as WorkflowInstanceRow[];
      return rows.map((r) => ({
        ...r,
        escalation: checkEscalation(r, getWorkflowConfig("WF-005")),
      }));
    }),

  getIncidentReportingEvidenceGates: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      return { evidence: getEvidenceStatus(input.instanceId) };
    }),

  submitIncidentReportingEvidence: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        gateName: z.enum([
          "incident_report_form",
          "witness_statements",
          "investigation_notes",
          "corrective_action_plan",
        ]),
        fileName: z.string(),
        filePath: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      sqlite
        .prepare(
          `INSERT INTO workflow_evidence_v2 (instance_id, gate_name, file_name, file_path, submitted_by, submitted_at, validated)
         VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`,
        )
        .run(
          input.instanceId,
          input.gateName,
          input.fileName,
          input.filePath,
          actor,
        );
      return { success: true, gateName: input.gateName };
    }),

  checkIncidentReportingEscalation: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      return checkEscalation(instance, getWorkflowConfig("WF-005"));
    }),

  // ═══════════════════════════════════════════════════════════════
  // WF-006: CAP/AUDIT READINESS (D005-06)
  // ═══════════════════════════════════════════════════════════════

  createCAPAuditInstance: adminQuery
    .input(
      z.object({
        entityId: z.string(),
        assignedTo: z.string(),
        notes: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      const result = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, 0, ?)`,
        )
        .run(
          "WF-006",
          input.entityId,
          "audit",
          "IDENTIFIED",
          "",
          input.assignedTo,
          actor,
          input.dueDate ?? null,
          input.notes ?? null,
        );
      const instanceId = Number(result.lastInsertRowid);
      logTransition({
        instanceId,
        fromStatus: "",
        toStatus: "IDENTIFIED",
        actor,
        reason: "CAP/Audit instance created",
      });
      return { instanceId, workflowId: "WF-006", status: "IDENTIFIED" };
    }),

  transitionCAPAuditStatus: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        toStatus: z.enum([
          "IDENTIFIED",
          "ASSIGNED",
          "IN-PROGRESS",
          "EVIDENCE-SUBMITTED",
          "VERIFIED",
          "CLOSED",
        ]),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      if (instance.workflow_id !== "WF-006")
        throw new Error("Not a WF-006 instance");
      if (
        !isValidTransition("WF-006", instance.current_status, input.toStatus)
      ) {
        throw new Error(
          `Invalid transition: ${instance.current_status} -> ${input.toStatus}`,
        );
      }
      const actor = ctx.user.email;
      const fromStatus = instance.current_status;
      sqlite
        .prepare(
          `UPDATE workflow_instances_v2 SET current_status = ?, previous_status = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .run(input.toStatus, fromStatus, input.instanceId);
      logTransition({
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
        actor,
        reason: input.reason,
      });
      return {
        success: true,
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
      };
    }),

  getCAPAuditInstance: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      const evidence = getEvidenceStatus(input.instanceId);
      const cfg = getWorkflowConfig(instance.workflow_id);
      const escalation = checkEscalation(instance, cfg);
      return { ...instance, evidence, escalation };
    }),

  listCAPAuditInstances: authedQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          limit: z.number().default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = `SELECT * FROM workflow_instances_v2 WHERE workflow_id = 'WF-006'`;
      const params: unknown[] = [];
      if (input?.status) {
        sql += ` AND current_status = ?`;
        params.push(input.status);
      }
      sql += ` ORDER BY updated_at DESC LIMIT ?`;
      params.push(input?.limit ?? 50);
      const rows = sqlite.prepare(sql).all(...params) as WorkflowInstanceRow[];
      return rows.map((r) => ({
        ...r,
        escalation: checkEscalation(r, getWorkflowConfig("WF-006")),
      }));
    }),

  getCAPAuditEvidenceGates: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      return { evidence: getEvidenceStatus(input.instanceId) };
    }),

  submitCAPAuditEvidence: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        gateName: z.enum([
          "cap_plan",
          "evidence_of_correction",
          "sustainability_measures",
          "verification_documentation",
        ]),
        fileName: z.string(),
        filePath: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      sqlite
        .prepare(
          `INSERT INTO workflow_evidence_v2 (instance_id, gate_name, file_name, file_path, submitted_by, submitted_at, validated)
         VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`,
        )
        .run(
          input.instanceId,
          input.gateName,
          input.fileName,
          input.filePath,
          actor,
        );
      return { success: true, gateName: input.gateName };
    }),

  checkCAPAuditEscalation: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      return checkEscalation(instance, getWorkflowConfig("WF-006"));
    }),

  // ═══════════════════════════════════════════════════════════════
  // WF-007: BILLING GATE (D005-07)
  // ═══════════════════════════════════════════════════════════════

  createBillingGateInstance: adminQuery
    .input(
      z.object({
        entityId: z.string(),
        assignedTo: z.string(),
        notes: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      const result = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, 0, ?)`,
        )
        .run(
          "WF-007",
          input.entityId,
          "claim",
          "SERVICE-DOCUMENTED",
          "",
          input.assignedTo,
          actor,
          input.dueDate ?? null,
          input.notes ?? null,
        );
      const instanceId = Number(result.lastInsertRowid);
      logTransition({
        instanceId,
        fromStatus: "",
        toStatus: "SERVICE-DOCUMENTED",
        actor,
        reason: "Billing instance created",
      });
      return { instanceId, workflowId: "WF-007", status: "SERVICE-DOCUMENTED" };
    }),

  transitionBillingGateStatus: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        toStatus: z.enum([
          "SERVICE-DOCUMENTED",
          "REVIEWED",
          "AUTH-VERIFIED",
          "SUBMITTED",
          "PAID",
          "DENIED",
        ]),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      if (instance.workflow_id !== "WF-007")
        throw new Error("Not a WF-007 instance");
      if (
        !isValidTransition("WF-007", instance.current_status, input.toStatus)
      ) {
        throw new Error(
          `Invalid transition: ${instance.current_status} -> ${input.toStatus}`,
        );
      }
      const actor = ctx.user.email;
      const fromStatus = instance.current_status;
      sqlite
        .prepare(
          `UPDATE workflow_instances_v2 SET current_status = ?, previous_status = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .run(input.toStatus, fromStatus, input.instanceId);
      logTransition({
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
        actor,
        reason: input.reason,
      });
      return {
        success: true,
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
      };
    }),

  getBillingGateInstance: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      const evidence = getEvidenceStatus(input.instanceId);
      const cfg = getWorkflowConfig(instance.workflow_id);
      const escalation = checkEscalation(instance, cfg);
      return { ...instance, evidence, escalation };
    }),

  listBillingGateInstances: authedQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          limit: z.number().default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = `SELECT * FROM workflow_instances_v2 WHERE workflow_id = 'WF-007'`;
      const params: unknown[] = [];
      if (input?.status) {
        sql += ` AND current_status = ?`;
        params.push(input.status);
      }
      sql += ` ORDER BY updated_at DESC LIMIT ?`;
      params.push(input?.limit ?? 50);
      const rows = sqlite.prepare(sql).all(...params) as WorkflowInstanceRow[];
      return rows.map((r) => ({
        ...r,
        escalation: checkEscalation(r, getWorkflowConfig("WF-007")),
      }));
    }),

  getBillingGateEvidenceGates: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      return { evidence: getEvidenceStatus(input.instanceId) };
    }),

  submitBillingGateEvidence: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        gateName: z.enum([
          "service_note_billing_code",
          "authorization_match",
          "proof_of_service",
        ]),
        fileName: z.string(),
        filePath: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      sqlite
        .prepare(
          `INSERT INTO workflow_evidence_v2 (instance_id, gate_name, file_name, file_path, submitted_by, submitted_at, validated)
         VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`,
        )
        .run(
          input.instanceId,
          input.gateName,
          input.fileName,
          input.filePath,
          actor,
        );
      return { success: true, gateName: input.gateName };
    }),

  checkBillingGateEscalation: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      return checkEscalation(instance, getWorkflowConfig("WF-007"));
    }),

  // ═══════════════════════════════════════════════════════════════
  // WF-008: EXECUTIVE DECISION ROUTING (D005-08)
  // ═══════════════════════════════════════════════════════════════

  createExecutiveDecisionInstance: adminQuery
    .input(
      z.object({
        entityId: z.string(),
        assignedTo: z.string(),
        notes: z.string().optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      const result = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, 0, ?)`,
        )
        .run(
          "WF-008",
          input.entityId,
          "decision",
          "SUBMITTED",
          "",
          input.assignedTo,
          actor,
          input.dueDate ?? null,
          input.notes ?? null,
        );
      const instanceId = Number(result.lastInsertRowid);
      logTransition({
        instanceId,
        fromStatus: "",
        toStatus: "SUBMITTED",
        actor,
        reason: "Executive decision instance created",
      });
      return { instanceId, workflowId: "WF-008", status: "SUBMITTED" };
    }),

  transitionExecutiveDecisionStatus: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        toStatus: z.enum([
          "SUBMITTED",
          "ADMIN-REVIEW",
          "BOARD-PREVIEW",
          "APPROVED",
          "REJECTED",
          "IMPLEMENTED",
        ]),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      if (instance.workflow_id !== "WF-008")
        throw new Error("Not a WF-008 instance");
      if (
        !isValidTransition("WF-008", instance.current_status, input.toStatus)
      ) {
        throw new Error(
          `Invalid transition: ${instance.current_status} -> ${input.toStatus}`,
        );
      }
      const actor = ctx.user.email;
      const fromStatus = instance.current_status;
      sqlite
        .prepare(
          `UPDATE workflow_instances_v2 SET current_status = ?, previous_status = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .run(input.toStatus, fromStatus, input.instanceId);
      logTransition({
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
        actor,
        reason: input.reason,
      });
      return {
        success: true,
        instanceId: input.instanceId,
        fromStatus,
        toStatus: input.toStatus,
      };
    }),

  getExecutiveDecisionInstance: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      const evidence = getEvidenceStatus(input.instanceId);
      const cfg = getWorkflowConfig(instance.workflow_id);
      const escalation = checkEscalation(instance, cfg);
      return { ...instance, evidence, escalation };
    }),

  listExecutiveDecisionInstances: authedQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          limit: z.number().default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = `SELECT * FROM workflow_instances_v2 WHERE workflow_id = 'WF-008'`;
      const params: unknown[] = [];
      if (input?.status) {
        sql += ` AND current_status = ?`;
        params.push(input.status);
      }
      sql += ` ORDER BY updated_at DESC LIMIT ?`;
      params.push(input?.limit ?? 50);
      const rows = sqlite.prepare(sql).all(...params) as WorkflowInstanceRow[];
      return rows.map((r) => ({
        ...r,
        escalation: checkEscalation(r, getWorkflowConfig("WF-008")),
      }));
    }),

  getExecutiveDecisionEvidenceGates: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      return { evidence: getEvidenceStatus(input.instanceId) };
    }),

  submitExecutiveDecisionEvidence: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        gateName: z.enum([
          "decision_memo",
          "financial_impact_analysis",
          "risk_assessment",
          "stakeholder_input",
        ]),
        fileName: z.string(),
        filePath: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = ctx.user.email;
      sqlite
        .prepare(
          `INSERT INTO workflow_evidence_v2 (instance_id, gate_name, file_name, file_path, submitted_by, submitted_at, validated)
         VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`,
        )
        .run(
          input.instanceId,
          input.gateName,
          input.fileName,
          input.filePath,
          actor,
        );
      return { success: true, gateName: input.gateName };
    }),

  checkExecutiveDecisionEscalation: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      const instance = sqlite
        .prepare(`SELECT * FROM workflow_instances_v2 WHERE id = ?`)
        .get(input.instanceId) as WorkflowInstanceRow | undefined;
      if (!instance) throw new Error("Instance not found");
      return checkEscalation(instance, getWorkflowConfig("WF-008"));
    }),

  // ═══════════════════════════════════════════════════════════════
  // D005-09: SEED DATA — 2-3 Instances Per Workflow (16-24 total)
  // ═══════════════════════════════════════════════════════════════

  seedWorkflowInstances: adminQuery.mutation(async ({ ctx }) => {
    assertSyntheticScenarioRuntime(env);
    const actor = ctx.user.email;
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
    const fourDaysAgo = new Date(now.getTime() - 4 * 86400000).toISOString();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const tenDaysAgo = new Date(now.getTime() - 10 * 86400000).toISOString();
    const fourteenDaysAgo = new Date(
      now.getTime() - 14 * 86400000,
    ).toISOString();
    const twentyDaysAgo = new Date(now.getTime() - 20 * 86400000).toISOString();
    const thirtyFiveDaysAgo = new Date(
      now.getTime() - 35 * 86400000,
    ).toISOString();

    const seeded: Array<{
      workflowId: string;
      instanceId: number;
      status: string;
    }> = [];

    // ─── WF-001: Referral Intake (3 instances) ─────────────────
    const wf001 = [
      {
        entityId: "YTH-2026-0041",
        status: "RECEIVED",
        assignedTo: "intake-coordinator@example.invalid",
        notes: "New referral from Dallas ISD for 14yo male",
        dueDate: threeDaysAgo,
      },
      {
        entityId: "YTH-2026-0042",
        status: "SCREENING",
        assignedTo: "clinical-screener@example.invalid",
        notes: "DCF referral, screening in progress",
        dueDate: twoDaysAgo,
      },
      {
        entityId: "YTH-2026-0038",
        status: "SCHEDULED",
        assignedTo: "intake-coordinator@example.invalid",
        notes: "Accepted, intake scheduled for next week",
        dueDate: now.toISOString(),
      },
    ];
    for (const d of wf001) {
      const r = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        )
        .run(
          "WF-001",
          d.entityId,
          "patient",
          d.status,
          d.status === "RECEIVED" ? "" : "RECEIVED",
          d.assignedTo,
          actor,
          fourDaysAgo,
          threeDaysAgo,
          d.dueDate,
          d.notes,
        );
      const id = Number(r.lastInsertRowid);
      logTransition({
        instanceId: id,
        fromStatus: "",
        toStatus: "RECEIVED",
        actor,
        reason: "Seed data",
      });
      if (d.status !== "RECEIVED")
        logTransition({
          instanceId: id,
          fromStatus: "RECEIVED",
          toStatus: d.status,
          actor,
          reason: "Seed transition",
        });
      seeded.push({ workflowId: "WF-001", instanceId: id, status: d.status });
    }

    // ─── WF-002: Clinical Assessment (3 instances) ─────────────
    const wf002 = [
      {
        entityId: "YTH-2026-0015",
        status: "SCHEDULED",
        assignedTo: "therapist-smith@example.invalid",
        notes: "Clinical assessment scheduled for 3/15",
        dueDate: fourteenDaysAgo,
      },
      {
        entityId: "YTH-2026-0022",
        status: "IN-PROGRESS",
        assignedTo: "therapist-jones@example.invalid",
        notes:
          "Clinical assessment in progress, awaiting treatment review report",
        dueDate: sevenDaysAgo,
      },
      {
        entityId: "YTH-2026-0018",
        status: "PLAN-DEVELOPED",
        assignedTo: "clinical-director@example.invalid",
        notes: "Treatment plan approved and active",
        dueDate: now.toISOString(),
      },
    ];
    for (const d of wf002) {
      const prev =
        d.status === "SCHEDULED"
          ? ""
          : d.status === "IN-PROGRESS"
            ? "SCHEDULED"
            : "IN-PROGRESS";
      const r = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        )
        .run(
          "WF-002",
          d.entityId,
          "patient",
          d.status,
          prev,
          d.assignedTo,
          actor,
          tenDaysAgo,
          fiveDaysAgo,
          d.dueDate,
          d.notes,
        );
      const id = Number(r.lastInsertRowid);
      logTransition({
        instanceId: id,
        fromStatus: "",
        toStatus: "SCHEDULED",
        actor,
        reason: "Seed data",
      });
      if (d.status === "IN-PROGRESS")
        logTransition({
          instanceId: id,
          fromStatus: "SCHEDULED",
          toStatus: "IN-PROGRESS",
          actor,
          reason: "Seed transition",
        });
      if (d.status === "PLAN-DEVELOPED") {
        logTransition({
          instanceId: id,
          fromStatus: "SCHEDULED",
          toStatus: "IN-PROGRESS",
          actor,
          reason: "Seed transition",
        });
        logTransition({
          instanceId: id,
          fromStatus: "IN-PROGRESS",
          toStatus: "PLAN-DEVELOPED",
          actor,
          reason: "Seed transition",
        });
      }
      seeded.push({ workflowId: "WF-002", instanceId: id, status: d.status });
    }

    // ─── WF-003: Service Delivery (3 instances) ────────────────
    const wf003 = [
      {
        entityId: "YTH-2026-0010",
        status: "ACTIVE",
        assignedTo: "case-manager-lee@example.invalid",
        notes: "Weekly sessions ongoing, CANS improving",
        dueDate: now.toISOString(),
      },
      {
        entityId: "YTH-2026-0012",
        status: "PROGRESS-REVIEW",
        assignedTo: "clinical-supervisor@example.invalid",
        notes: "90-day review due, progress summary submitted",
        dueDate: sevenDaysAgo,
      },
      {
        entityId: "YTH-2026-0005",
        status: "DISCHARGE",
        assignedTo: "discharge-coordinator@example.invalid",
        notes: "Discharge planning complete, final summary filed",
        dueDate: twoDaysAgo,
      },
    ];
    for (const d of wf003) {
      const r = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        )
        .run(
          "WF-003",
          d.entityId,
          "patient",
          d.status,
          "AUTHORIZED",
          d.assignedTo,
          actor,
          twentyDaysAgo,
          threeDaysAgo,
          d.dueDate,
          d.notes,
        );
      const id = Number(r.lastInsertRowid);
      logTransition({
        instanceId: id,
        fromStatus: "",
        toStatus: "AUTHORIZED",
        actor,
        reason: "Seed data",
      });
      logTransition({
        instanceId: id,
        fromStatus: "AUTHORIZED",
        toStatus: "ACTIVE",
        actor,
        reason: "Seed transition",
      });
      if (d.status !== "ACTIVE") {
        logTransition({
          instanceId: id,
          fromStatus: "ACTIVE",
          toStatus: d.status === "DISCHARGE" ? "COMPLETED" : d.status,
          actor,
          reason: "Seed transition",
        });
        if (d.status === "DISCHARGE")
          logTransition({
            instanceId: id,
            fromStatus: "COMPLETED",
            toStatus: "DISCHARGE",
            actor,
            reason: "Seed transition",
          });
      }
      seeded.push({ workflowId: "WF-003", instanceId: id, status: d.status });
    }

    // ─── WF-004: GRO Shift Operations (2 instances) ────────────
    const wf004 = [
      {
        entityId: "SHIFT-20260315-DAY",
        status: "SHIFT-START",
        assignedTo: "rcs-lead-davis@example.invalid",
        notes: "Day shift beginning, 8 youth on campus",
        dueDate: now.toISOString(),
      },
      {
        entityId: "SHIFT-20260314-NGT",
        status: "HANDOFF",
        assignedTo: "rcs-night-wilson@example.invalid",
        notes: "Night shift completed, handoff to day team done",
        dueDate: now.toISOString(),
      },
    ];
    for (const d of wf004) {
      const r = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        )
        .run(
          "WF-004",
          d.entityId,
          "shift",
          d.status,
          d.status === "HANDOFF" ? "SHIFT-END" : "",
          d.assignedTo,
          actor,
          now.toISOString(),
          now.toISOString(),
          d.dueDate,
          d.notes,
        );
      const id = Number(r.lastInsertRowid);
      logTransition({
        instanceId: id,
        fromStatus: "",
        toStatus: "SHIFT-START",
        actor,
        reason: "Seed data",
      });
      if (d.status === "HANDOFF") {
        ["ROUNDS", "ACTIVITIES", "SHIFT-END", "HANDOFF"].forEach(
          (s, i, arr) => {
            if (i > 0)
              logTransition({
                instanceId: id,
                fromStatus: arr[i - 1],
                toStatus: s,
                actor,
                reason: "Seed transition",
              });
          },
        );
      }
      seeded.push({ workflowId: "WF-004", instanceId: id, status: d.status });
    }

    // ─── WF-005: Incident Reporting (3 instances) ──────────────
    const wf005 = [
      {
        entityId: "INC-2026-0092",
        status: "REPORTED",
        assignedTo: "shift-supervisor@example.invalid",
        notes: "Minor property damage during group activity, no injuries",
        dueDate: now.toISOString(),
      },
      {
        entityId: "INC-2026-0088",
        status: "INVESTIGATION",
        assignedTo: "safety-officer@example.invalid",
        notes: "Investigation ongoing for behavioral incident on Unit B",
        dueDate: threeDaysAgo,
      },
      {
        entityId: "INC-2026-0075",
        status: "CLOSED",
        assignedTo: "hr-compliance-officer@amos-ops.invalid",
        notes: "Incident closed, CAP implemented, all documentation filed",
        dueDate: sevenDaysAgo,
      },
    ];
    for (const d of wf005) {
      const r = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        )
        .run(
          "WF-005",
          d.entityId,
          "incident",
          d.status,
          "REPORTED",
          d.assignedTo,
          actor,
          fiveDaysAgo,
          twoDaysAgo,
          d.dueDate,
          d.notes,
        );
      const id = Number(r.lastInsertRowid);
      logTransition({
        instanceId: id,
        fromStatus: "",
        toStatus: "REPORTED",
        actor,
        reason: "Seed data",
      });
      if (d.status === "INVESTIGATION") {
        logTransition({
          instanceId: id,
          fromStatus: "REPORTED",
          toStatus: "REVIEWED",
          actor,
          reason: "Seed transition",
        });
        logTransition({
          instanceId: id,
          fromStatus: "REVIEWED",
          toStatus: "INVESTIGATION",
          actor,
          reason: "Seed transition",
        });
      }
      if (d.status === "CLOSED") {
        ["REVIEWED", "INVESTIGATION", "CORRECTIVE-ACTION", "CLOSED"].forEach(
          (s, i, arr) => {
            const from = i === 0 ? "REPORTED" : arr[i - 1];
            logTransition({
              instanceId: id,
              fromStatus: from,
              toStatus: s,
              actor,
              reason: "Seed transition",
            });
          },
        );
      }
      seeded.push({ workflowId: "WF-005", instanceId: id, status: d.status });
    }

    // ─── WF-006: CAP/Audit Readiness (3 instances) ─────────────
    const wf006 = [
      {
        entityId: "AUDIT-2026-Q1-003",
        status: "ASSIGNED",
        assignedTo: "cap-coordinator@example.invalid",
        notes: "CAP assigned for documentation deficiency finding",
        dueDate: fourteenDaysAgo,
      },
      {
        entityId: "AUDIT-2026-Q1-001",
        status: "EVIDENCE-SUBMITTED",
        assignedTo: "qa-manager@example.invalid",
        notes:
          "Evidence submitted, awaiting verification for training compliance",
        dueDate: sevenDaysAgo,
      },
      {
        entityId: "AUDIT-2025-Q4-012",
        status: "CLOSED",
        assignedTo: "administrator@example.invalid",
        notes: "Repeat finding: RCS-007. CAP closed after verification.",
        dueDate: thirtyFiveDaysAgo,
      },
    ];
    for (const d of wf006) {
      const r = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        )
        .run(
          "WF-006",
          d.entityId,
          "audit",
          d.status,
          d.status === "ASSIGNED" ? "IDENTIFIED" : "IN-PROGRESS",
          d.assignedTo,
          actor,
          twentyDaysAgo,
          fiveDaysAgo,
          d.dueDate,
          d.notes,
        );
      const id = Number(r.lastInsertRowid);
      logTransition({
        instanceId: id,
        fromStatus: "",
        toStatus: "IDENTIFIED",
        actor,
        reason: "Seed data",
      });
      if (d.status === "ASSIGNED")
        logTransition({
          instanceId: id,
          fromStatus: "IDENTIFIED",
          toStatus: "ASSIGNED",
          actor,
          reason: "Seed transition",
        });
      if (d.status === "EVIDENCE-SUBMITTED") {
        ["ASSIGNED", "IN-PROGRESS", "EVIDENCE-SUBMITTED"].forEach(
          (s, i, arr) => {
            const from = i === 0 ? "IDENTIFIED" : arr[i - 1];
            logTransition({
              instanceId: id,
              fromStatus: from,
              toStatus: s,
              actor,
              reason: "Seed transition",
            });
          },
        );
      }
      if (d.status === "CLOSED") {
        [
          "ASSIGNED",
          "IN-PROGRESS",
          "EVIDENCE-SUBMITTED",
          "VERIFIED",
          "CLOSED",
        ].forEach((s, i, arr) => {
          const from = i === 0 ? "IDENTIFIED" : arr[i - 1];
          logTransition({
            instanceId: id,
            fromStatus: from,
            toStatus: s,
            actor,
            reason: "Seed transition",
          });
        });
      }
      seeded.push({ workflowId: "WF-006", instanceId: id, status: d.status });
    }

    // ─── WF-007: Billing Gate (2 instances) ────────────────────
    const wf007 = [
      {
        entityId: "CLM-2026-0315-044",
        status: "REVIEWED",
        assignedTo: "billing-specialist@example.invalid",
        notes: "Service note reviewed, billing code H2017 verified",
        dueDate: now.toISOString(),
      },
      {
        entityId: "CLM-2026-0310-039",
        status: "PAID",
        assignedTo: "revenue-cycle-mgr@example.invalid",
        notes: "Claim paid, $185.00 received from Medicaid",
        dueDate: twoDaysAgo,
      },
    ];
    for (const d of wf007) {
      const r = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        )
        .run(
          "WF-007",
          d.entityId,
          "claim",
          d.status,
          d.status === "PAID" ? "SUBMITTED" : "SERVICE-DOCUMENTED",
          d.assignedTo,
          actor,
          sevenDaysAgo,
          twoDaysAgo,
          d.dueDate,
          d.notes,
        );
      const id = Number(r.lastInsertRowid);
      logTransition({
        instanceId: id,
        fromStatus: "",
        toStatus: "SERVICE-DOCUMENTED",
        actor,
        reason: "Seed data",
      });
      if (d.status === "REVIEWED")
        logTransition({
          instanceId: id,
          fromStatus: "SERVICE-DOCUMENTED",
          toStatus: "REVIEWED",
          actor,
          reason: "Seed transition",
        });
      if (d.status === "PAID") {
        ["REVIEWED", "AUTH-VERIFIED", "SUBMITTED", "PAID"].forEach(
          (s, i, arr) => {
            const from = i === 0 ? "SERVICE-DOCUMENTED" : arr[i - 1];
            logTransition({
              instanceId: id,
              fromStatus: from,
              toStatus: s,
              actor,
              reason: "Seed transition",
            });
          },
        );
      }
      seeded.push({ workflowId: "WF-007", instanceId: id, status: d.status });
    }

    // ─── WF-008: Executive Decision Routing (2 instances) ──────
    const wf008 = [
      {
        entityId: "DEC-2026-004",
        status: "ADMIN-REVIEW",
        assignedTo: "administrator@example.invalid",
        notes: "Proposal to expand Phase 2 capacity from 16 to 24 beds",
        dueDate: fourteenDaysAgo,
      },
      {
        entityId: "DEC-2026-002",
        status: "IMPLEMENTED",
        assignedTo: "managing-director@example.invalid",
        notes: "New EHR integration approved and implemented",
        dueDate: sevenDaysAgo,
      },
    ];
    for (const d of wf008) {
      const r = sqlite
        .prepare(
          `INSERT INTO workflow_instances_v2 (workflow_id, entity_id, entity_type, current_status, previous_status, assigned_to, created_by, created_at, updated_at, due_date, escalation_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        )
        .run(
          "WF-008",
          d.entityId,
          "decision",
          d.status,
          d.status === "IMPLEMENTED" ? "APPROVED" : "SUBMITTED",
          d.assignedTo,
          actor,
          twentyDaysAgo,
          fiveDaysAgo,
          d.dueDate,
          d.notes,
        );
      const id = Number(r.lastInsertRowid);
      logTransition({
        instanceId: id,
        fromStatus: "",
        toStatus: "SUBMITTED",
        actor,
        reason: "Seed data",
      });
      if (d.status === "ADMIN-REVIEW")
        logTransition({
          instanceId: id,
          fromStatus: "SUBMITTED",
          toStatus: "ADMIN-REVIEW",
          actor,
          reason: "Seed transition",
        });
      if (d.status === "IMPLEMENTED") {
        ["ADMIN-REVIEW", "BOARD-PREVIEW", "APPROVED", "IMPLEMENTED"].forEach(
          (s, i, arr) => {
            const from = i === 0 ? "SUBMITTED" : arr[i - 1];
            logTransition({
              instanceId: id,
              fromStatus: from,
              toStatus: s,
              actor,
              reason: "Seed transition",
            });
          },
        );
      }
      seeded.push({ workflowId: "WF-008", instanceId: id, status: d.status });
    }

    // ─── Submit sample evidence for some instances ─────────────
    const evidenceSeed = [
      {
        instanceId: seeded[0].instanceId,
        gate: "demographics_form",
        file: "demographics_YTH0041.pdf",
      },
      {
        instanceId: seeded[0].instanceId,
        gate: "insurance_verification",
        file: "ins_verif_YTH0041.pdf",
      },
      {
        instanceId: seeded[6].instanceId,
        gate: "service_notes",
        file: "session_notes_wk1.pdf",
      },
      {
        instanceId: seeded[8].instanceId,
        gate: "service_notes",
        file: "discharge_summary_YTH0005.pdf",
      },
      {
        instanceId: seeded[11].instanceId,
        gate: "incident_report_form",
        file: "incident_0088.pdf",
      },
      {
        instanceId: seeded[15].instanceId,
        gate: "cap_plan",
        file: "cap_AUDIT_Q1_003.pdf",
      },
      {
        instanceId: seeded[18].instanceId,
        gate: "service_note_billing_code",
        file: "h2017_note_0315.pdf",
      },
    ];
    for (const ev of evidenceSeed) {
      sqlite
        .prepare(
          `INSERT INTO workflow_evidence_v2 (instance_id, gate_name, file_name, file_path, submitted_by, submitted_at, validated)
         VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`,
        )
        .run(ev.instanceId, ev.gate, ev.file, `/uploads/${ev.file}`, actor);
    }

    return {
      totalSeeded: seeded.length,
      byWorkflow: seeded.reduce((acc: Record<string, number>, s) => {
        acc[s.workflowId] = (acc[s.workflowId] ?? 0) + 1;
        return acc;
      }, {}),
      evidenceSeeded: evidenceSeed.length,
      instances: seeded,
    };
  }),

  // ─── Cross-Workflow: List All Instances ────────────────────

  listAllWorkflowInstances: authedQuery
    .input(
      z
        .object({
          workflowId: z.string().optional(),
          status: z.string().optional(),
          limit: z.number().default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      let sql = `SELECT * FROM workflow_instances_v2 WHERE 1=1`;
      const params: unknown[] = [];
      if (input?.workflowId) {
        sql += ` AND workflow_id = ?`;
        params.push(input.workflowId);
      }
      if (input?.status) {
        sql += ` AND current_status = ?`;
        params.push(input.status);
      }
      sql += ` ORDER BY updated_at DESC LIMIT ?`;
      params.push(input?.limit ?? 50);
      const rows = sqlite.prepare(sql).all(...params) as WorkflowInstanceRow[];
      return rows.map((r) => ({
        ...r,
        escalation: checkEscalation(r, getWorkflowConfig(r.workflow_id)),
      }));
    }),

  // ─── Cross-Workflow: Get Instance Transitions ──────────────

  getInstanceTransitions: authedQuery
    .input(z.object({ instanceId: z.number() }))
    .query(async ({ input }) => {
      return sqlite
        .prepare(
          `SELECT * FROM workflow_transitions_v2 WHERE instance_id = ? ORDER BY created_at DESC`,
        )
        .all(input.instanceId);
    }),

  // ─── Cross-Workflow: Validate Evidence ─────────────────────

  validateEvidence: adminQuery
    .input(z.object({ evidenceId: z.number(), validated: z.boolean() }))
    .mutation(async ({ input }) => {
      sqlite
        .prepare(`UPDATE workflow_evidence_v2 SET validated = ? WHERE id = ?`)
        .run(input.validated ? 1 : 0, input.evidenceId);
      return {
        success: true,
        evidenceId: input.evidenceId,
        validated: input.validated,
      };
    }),

  // ─── Cross-Workflow: Update Escalation ─────────────────────

  updateEscalation: adminQuery
    .input(
      z.object({
        instanceId: z.number(),
        escalationLevel: z.number(),
        escalationReason: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      sqlite
        .prepare(
          `UPDATE workflow_instances_v2 SET escalation_level = ?, escalation_reason = ? WHERE id = ?`,
        )
        .run(input.escalationLevel, input.escalationReason, input.instanceId);
      return {
        success: true,
        instanceId: input.instanceId,
        escalationLevel: input.escalationLevel,
      };
    }),

  // ═══════════════════════════════════════════════════════════════
  // LEGACY ENDPOINTS (maintained for backward compatibility)
  // ═══════════════════════════════════════════════════════════════

  // ─── List Rules ────────────────────────────────────────────

  listRules: publicQuery.query(() => {
    return WORKFLOW_DEFINITIONS.map((w) => ({
      id: w.id,
      name: w.name,
      statusMap: w.statusMap,
      evidenceGates: w.evidenceGates.map((g) => g.name),
    }));
  }),

  // ─── Event Types ───────────────────────────────────────────

  getEventTypes: publicQuery.query(() => {
    return [
      {
        event: "referral.received",
        label: "Referral Received",
        category: "Intake",
      },
      {
        event: "assessment.scheduled",
        label: "Assessment Scheduled",
        category: "Clinical",
      },
      {
        event: "service.authorized",
        label: "Service Authorized",
        category: "Service",
      },
      { event: "shift.started", label: "Shift Started", category: "GRO" },
      {
        event: "incident.reported",
        label: "Incident Reported",
        category: "Safety",
      },
      {
        event: "audit.finding-identified",
        label: "Audit Finding Identified",
        category: "QA",
      },
      {
        event: "claim.submitted",
        label: "Claim Submitted",
        category: "Billing",
      },
      {
        event: "decision.submitted",
        label: "Decision Submitted",
        category: "Executive",
      },
    ];
  }),
});
