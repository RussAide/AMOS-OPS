import type Database from "better-sqlite3";
import { sqlite } from "../queries/connection";

export type OperationalProgram = "MHTCM" | "MHRS";

type OperationalWorkStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "awaiting_approval"
  | "completed"
  | "cancelled";

interface OperationalWorkItemRow {
  readonly id: string;
  readonly case_id: string;
  readonly title: string;
  readonly status: OperationalWorkStatus;
  readonly priority: "routine" | "urgent" | "critical";
  readonly assigned_role: string;
  readonly due_at: string;
  readonly approval_status:
    "not_required" | "pending" | "approved" | "rejected";
  readonly exception_status: "none" | "open" | "resolved" | "waived";
  readonly updated_at: string;
}

interface OperationalHandoffRow {
  readonly id: string;
  readonly case_id: string;
  readonly work_item_id: string;
  readonly status:
    "initiated" | "accepted" | "rejected" | "returned" | "completed";
  readonly initiated_at: string;
  readonly due_at: string;
  readonly accepted_at: string | null;
  readonly completed_at: string | null;
}

interface OperationalLineageRow {
  readonly id: string;
  readonly case_id: string;
  readonly cans_assessment_id: string;
  readonly cans_version: number;
  readonly target_record_id: string;
  readonly target_version: number;
  readonly target_approval_status: "approved";
  readonly target_approved_at: string;
  readonly routed_at: string;
}

export interface OperationalProgramSummary {
  readonly program: OperationalProgram;
  readonly generatedAt: string;
  readonly source: {
    readonly provider: "m21_ccmg_durable";
    readonly evidenceClass: "production";
    readonly accessMode: "read_only";
  };
  readonly empty: boolean;
  readonly metrics: {
    readonly totalWorkItems: number;
    readonly activeWorkItems: number;
    readonly overdueWorkItems: number;
    readonly urgentWorkItems: number;
    readonly pendingApprovals: number;
    readonly openExceptions: number;
    readonly activeHandoffs: number;
    readonly approvedLineages: number;
  };
  readonly workItems: readonly {
    readonly id: string;
    readonly caseId: string;
    readonly title: string;
    readonly status: OperationalWorkStatus;
    readonly priority: "routine" | "urgent" | "critical";
    readonly assignedRole: string;
    readonly dueAt: string;
    readonly approvalStatus:
      "not_required" | "pending" | "approved" | "rejected";
    readonly exceptionStatus: "none" | "open" | "resolved" | "waived";
    readonly updatedAt: string;
  }[];
  readonly handoffs: readonly {
    readonly id: string;
    readonly caseId: string;
    readonly workItemId: string;
    readonly status:
      "initiated" | "accepted" | "rejected" | "returned" | "completed";
    readonly initiatedAt: string;
    readonly dueAt: string;
    readonly acceptedAt: string | null;
    readonly completedAt: string | null;
  }[];
  readonly approvedLineage: readonly {
    readonly id: string;
    readonly caseId: string;
    readonly cansAssessmentId: string;
    readonly cansVersion: number;
    readonly targetRecordId: string;
    readonly targetVersion: number;
    readonly approvedAt: string;
    readonly routedAt: string;
  }[];
}

const NONTERMINAL_WORK_STATUSES = new Set<OperationalWorkStatus>([
  "pending",
  "in_progress",
  "blocked",
  "awaiting_approval",
]);
const ACTIVE_HANDOFF_STATUSES = new Set(["initiated", "accepted", "returned"]);

function operationalScope(program: OperationalProgram): {
  queueId: "mhtcm" | "mhrs";
  department: OperationalProgram;
  targetType: "mhtcm_plan" | "mhrs_skills_goals";
} {
  return program === "MHTCM"
    ? {
        queueId: "mhtcm",
        department: "MHTCM",
        targetType: "mhtcm_plan",
      }
    : {
        queueId: "mhrs",
        department: "MHRS",
        targetType: "mhrs_skills_goals",
      };
}

/**
 * Read-only operational projection over the durable M21/CCMG handoff store.
 * It deliberately excludes youth labels, referral narratives, payer data, and
 * all synthetic evidence classes.
 */
export function buildOperationalProgramSummary(
  program: OperationalProgram,
  asOf: string,
  db: Database.Database = sqlite,
): OperationalProgramSummary {
  const asOfTimestamp = Date.parse(asOf);
  if (!Number.isFinite(asOfTimestamp)) {
    throw new Error("OPERATIONAL_PROGRAM_SUMMARY_INVALID_AS_OF");
  }
  const scope = operationalScope(program);

  const workRows = db
    .prepare(
      `SELECT id,case_id,title,status,priority,assigned_role,due_at,
              approval_status,exception_status,updated_at
       FROM m21_ccmg_work_items
       WHERE evidence_class = 'production'
         AND queue_id = ?
         AND assigned_department = ?
       ORDER BY due_at,id`,
    )
    .all(scope.queueId, scope.department) as OperationalWorkItemRow[];
  const handoffRows = db
    .prepare(
      `SELECT id,case_id,work_item_id,status,initiated_at,due_at,
              accepted_at,completed_at
       FROM m21_ccmg_handoffs
       WHERE evidence_class = 'production'
         AND to_department = ?
       ORDER BY initiated_at,id`,
    )
    .all(scope.department) as OperationalHandoffRow[];
  const lineageRows = db
    .prepare(
      `SELECT id,case_id,cans_assessment_id,cans_version,target_record_id,
              target_version,target_approval_status,target_approved_at,routed_at
       FROM m21_ccmg_plan_lineage
       WHERE evidence_class = 'production'
         AND target_type = ?
         AND target_approval_status = 'approved'
       ORDER BY routed_at,id`,
    )
    .all(scope.targetType) as OperationalLineageRow[];

  const workItems = workRows.map((row) => ({
    id: row.id,
    caseId: row.case_id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    assignedRole: row.assigned_role,
    dueAt: row.due_at,
    approvalStatus: row.approval_status,
    exceptionStatus: row.exception_status,
    updatedAt: row.updated_at,
  }));
  const handoffs = handoffRows.map((row) => ({
    id: row.id,
    caseId: row.case_id,
    workItemId: row.work_item_id,
    status: row.status,
    initiatedAt: row.initiated_at,
    dueAt: row.due_at,
    acceptedAt: row.accepted_at,
    completedAt: row.completed_at,
  }));
  const approvedLineage = lineageRows.map((row) => ({
    id: row.id,
    caseId: row.case_id,
    cansAssessmentId: row.cans_assessment_id,
    cansVersion: row.cans_version,
    targetRecordId: row.target_record_id,
    targetVersion: row.target_version,
    approvedAt: row.target_approved_at,
    routedAt: row.routed_at,
  }));

  return {
    program,
    generatedAt: asOf,
    source: {
      provider: "m21_ccmg_durable",
      evidenceClass: "production",
      accessMode: "read_only",
    },
    empty:
      workItems.length === 0 &&
      handoffs.length === 0 &&
      approvedLineage.length === 0,
    metrics: {
      totalWorkItems: workItems.length,
      activeWorkItems: workItems.filter((item) =>
        NONTERMINAL_WORK_STATUSES.has(item.status),
      ).length,
      overdueWorkItems: workItems.filter(
        (item) =>
          NONTERMINAL_WORK_STATUSES.has(item.status) &&
          Date.parse(item.dueAt) < asOfTimestamp,
      ).length,
      urgentWorkItems: workItems.filter(
        (item) => item.priority === "urgent" || item.priority === "critical",
      ).length,
      pendingApprovals: workItems.filter(
        (item) => item.approvalStatus === "pending",
      ).length,
      openExceptions: workItems.filter(
        (item) => item.exceptionStatus === "open",
      ).length,
      activeHandoffs: handoffs.filter((handoff) =>
        ACTIVE_HANDOFF_STATUSES.has(handoff.status),
      ).length,
      approvedLineages: approvedLineage.length,
    },
    workItems,
    handoffs,
    approvedLineage,
  };
}
