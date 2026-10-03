import { randomUUID } from "node:crypto";
import { sqlite } from "../queries/connection";

export type LogisticsServiceType =
  | "facilities"
  | "procurement"
  | "inventory"
  | "vendor"
  | "transportation"
  | "equipment"
  | "technology"
  | "workforce_training"
  | "safety_emergency"
  | "regulatory_support"
  | "other";

export type LogisticsPriority =
  | "routine"
  | "priority"
  | "urgent"
  | "critical";

export type LogisticsStatus =
  | "submitted"
  | "triage"
  | "assigned"
  | "in_progress"
  | "ready_for_verification"
  | "closed"
  | "returned_for_information"
  | "pending_dependency"
  | "escalated"
  | "declined"
  | "cancelled";

export type LogisticsVerificationStatus =
  | "not_required"
  | "pending"
  | "verified"
  | "returned";

export type LogisticsEventType =
  | "submitted"
  | "triaged"
  | "assigned"
  | "status_changed"
  | "information_requested"
  | "dependency_recorded"
  | "escalated"
  | "evidence_linked"
  | "verification_recorded"
  | "closed"
  | "cancelled";

export interface LogisticsRequestRow {
  id: string;
  request_number: string;
  origin_division: "eo" | "gad" | "bhc" | "gro";
  origin_department: string | null;
  requester_user_id: string;
  requester_role: string;
  facility_id: string | null;
  location: string | null;
  service_type: LogisticsServiceType;
  title: string;
  requirement: string;
  priority: LogisticsPriority;
  need_by: string | null;
  logistics_manager_id: string | null;
  logistics_coordinator_id: string | null;
  status: LogisticsStatus;
  dependency_type: string | null;
  dependency_owner: string | null;
  escalation_level: number;
  linked_work_order_id: string | null;
  linked_procurement_request_id: string | null;
  linked_vendor_id: string | null;
  linked_safety_record_id: string | null;
  verification_owner_id: string | null;
  verification_status: LogisticsVerificationStatus;
  closure_summary: string | null;
  assigned_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogisticsEventRow {
  id: string;
  request_id: string;
  sequence: number;
  event_type: LogisticsEventType;
  actor_user_id: string;
  actor_role: string;
  from_status: LogisticsStatus | null;
  to_status: LogisticsStatus | null;
  note: string | null;
  evidence_reference: string | null;
  occurred_at: string;
}

export interface CreateLogisticsRequestInput {
  originDivision: LogisticsRequestRow["origin_division"];
  originDepartment?: string | null;
  requesterUserId: string;
  requesterRole: string;
  facilityId?: string | null;
  location?: string | null;
  serviceType: LogisticsServiceType;
  title: string;
  requirement: string;
  priority: LogisticsPriority;
  needBy?: string | null;
}

export interface LogisticsRequestPatch {
  priority?: LogisticsPriority;
  status?: LogisticsStatus;
  logisticsManagerId?: string | null;
  logisticsCoordinatorId?: string | null;
  dependencyType?: string | null;
  dependencyOwner?: string | null;
  escalationLevel?: number;
  linkedWorkOrderId?: string | null;
  linkedProcurementRequestId?: string | null;
  linkedVendorId?: string | null;
  linkedSafetyRecordId?: string | null;
  verificationOwnerId?: string | null;
  verificationStatus?: LogisticsVerificationStatus;
  closureSummary?: string | null;
  assignedAt?: string | null;
  completedAt?: string | null;
  closedAt?: string | null;
}

export interface AppendLogisticsEventInput {
  requestId: string;
  eventType: LogisticsEventType;
  actorUserId: string;
  actorRole: string;
  fromStatus?: LogisticsStatus | null;
  toStatus?: LogisticsStatus | null;
  note?: string | null;
  evidenceReference?: string | null;
  occurredAt?: string;
}

function nextSequence(requestId: string): number {
  const row = sqlite
    .prepare(
      "SELECT COALESCE(MAX(sequence), 0) AS sequence FROM gad_logistics_events WHERE request_id = ?",
    )
    .get(requestId) as { sequence: number };
  return Number(row.sequence) + 1;
}

function insertEvent(input: AppendLogisticsEventInput): LogisticsEventRow {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const event: LogisticsEventRow = {
    id: randomUUID(),
    request_id: input.requestId,
    sequence: nextSequence(input.requestId),
    event_type: input.eventType,
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    note: input.note ?? null,
    evidence_reference: input.evidenceReference ?? null,
    occurred_at: occurredAt,
  };
  sqlite
    .prepare(
      `INSERT INTO gad_logistics_events
        (id, request_id, sequence, event_type, actor_user_id, actor_role,
         from_status, to_status, note, evidence_reference, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.id,
      event.request_id,
      event.sequence,
      event.event_type,
      event.actor_user_id,
      event.actor_role,
      event.from_status,
      event.to_status,
      event.note,
      event.evidence_reference,
      event.occurred_at,
    );
  return event;
}

export function appendLogisticsEvent(
  input: AppendLogisticsEventInput,
): LogisticsEventRow {
  return sqlite.transaction(() => insertEvent(input))();
}

export function getLogisticsRequest(
  id: string,
): LogisticsRequestRow | undefined {
  return sqlite
    .prepare("SELECT * FROM gad_logistics_requests WHERE id = ?")
    .get(id) as LogisticsRequestRow | undefined;
}

export function listLogisticsRequests(): LogisticsRequestRow[] {
  return sqlite
    .prepare(
      `SELECT * FROM gad_logistics_requests
       ORDER BY
         CASE priority
           WHEN 'critical' THEN 1
           WHEN 'urgent' THEN 2
           WHEN 'priority' THEN 3
           ELSE 4
         END,
         CASE WHEN need_by IS NULL THEN 1 ELSE 0 END,
         need_by ASC,
         created_at DESC`,
    )
    .all() as LogisticsRequestRow[];
}

export function listLogisticsRequestsForRequester(
  requesterUserId: string,
): LogisticsRequestRow[] {
  return sqlite
    .prepare(
      `SELECT * FROM gad_logistics_requests
       WHERE requester_user_id = ?
       ORDER BY created_at DESC`,
    )
    .all(requesterUserId) as LogisticsRequestRow[];
}

export function listLogisticsEvents(
  requestId: string,
): LogisticsEventRow[] {
  return sqlite
    .prepare(
      `SELECT * FROM gad_logistics_events
       WHERE request_id = ?
       ORDER BY sequence ASC`,
    )
    .all(requestId) as LogisticsEventRow[];
}

export function createLogisticsRequest(
  input: CreateLogisticsRequestInput,
): LogisticsRequestRow {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const requestNumber = `LOG-${createdAt.slice(0, 4)}-${randomUUID()
    .slice(0, 8)
    .toUpperCase()}`;

  sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO gad_logistics_requests
          (id, request_number, origin_division, origin_department,
           requester_user_id, requester_role, facility_id, location,
           service_type, title, requirement, priority, need_by, status,
           verification_status, escalation_level, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted',
                 'pending', 0, ?, ?)`,
      )
      .run(
        id,
        requestNumber,
        input.originDivision,
        input.originDepartment ?? null,
        input.requesterUserId,
        input.requesterRole,
        input.facilityId ?? null,
        input.location ?? null,
        input.serviceType,
        input.title,
        input.requirement,
        input.priority,
        input.needBy ?? null,
        createdAt,
        createdAt,
      );
    insertEvent({
      requestId: id,
      eventType: "submitted",
      actorUserId: input.requesterUserId,
      actorRole: input.requesterRole,
      fromStatus: null,
      toStatus: "submitted",
      occurredAt: createdAt,
    });
  })();

  return getLogisticsRequest(id)!;
}

const PATCH_COLUMNS: Readonly<
  Record<keyof LogisticsRequestPatch, string>
> = {
  priority: "priority",
  status: "status",
  logisticsManagerId: "logistics_manager_id",
  logisticsCoordinatorId: "logistics_coordinator_id",
  dependencyType: "dependency_type",
  dependencyOwner: "dependency_owner",
  escalationLevel: "escalation_level",
  linkedWorkOrderId: "linked_work_order_id",
  linkedProcurementRequestId: "linked_procurement_request_id",
  linkedVendorId: "linked_vendor_id",
  linkedSafetyRecordId: "linked_safety_record_id",
  verificationOwnerId: "verification_owner_id",
  verificationStatus: "verification_status",
  closureSummary: "closure_summary",
  assignedAt: "assigned_at",
  completedAt: "completed_at",
  closedAt: "closed_at",
};

export function updateLogisticsRequest(input: {
  id: string;
  patch: LogisticsRequestPatch;
  event: Omit<AppendLogisticsEventInput, "requestId">;
}): LogisticsRequestRow | undefined {
  const current = getLogisticsRequest(input.id);
  if (!current) return undefined;

  const entries = Object.entries(input.patch).filter(
    ([, value]) => value !== undefined,
  ) as Array<[keyof LogisticsRequestPatch, LogisticsRequestPatch[keyof LogisticsRequestPatch]]>;
  const updatedAt = new Date().toISOString();

  sqlite.transaction(() => {
    if (entries.length > 0) {
      const assignments = entries
        .map(([key]) => `${PATCH_COLUMNS[key]} = ?`)
        .join(", ");
      sqlite
        .prepare(
          `UPDATE gad_logistics_requests
           SET ${assignments}, updated_at = ?
           WHERE id = ?`,
        )
        .run(...entries.map(([, value]) => value ?? null), updatedAt, input.id);
    }
    insertEvent({
      ...input.event,
      requestId: input.id,
      fromStatus: input.event.fromStatus ?? current.status,
      toStatus:
        input.event.toStatus ??
        (input.patch.status !== undefined ? input.patch.status : current.status),
      occurredAt: input.event.occurredAt ?? updatedAt,
    });
  })();

  return getLogisticsRequest(input.id);
}

export function logisticsKpis(now = new Date()) {
  const rows = sqlite
    .prepare(
      `SELECT status, priority, need_by AS needBy, created_at AS createdAt
       FROM gad_logistics_requests`,
    )
    .all() as Array<{
      status: LogisticsStatus;
      priority: LogisticsPriority;
      needBy: string | null;
      createdAt: string;
    }>;

  const terminal = new Set<LogisticsStatus>(["closed", "cancelled", "declined"]);
  const open = rows.filter((row) => !terminal.has(row.status));
  const nowTime = now.getTime();
  const overdue = open.filter(
    (row) => row.needBy && Date.parse(row.needBy) < nowTime,
  ).length;
  const urgentCritical = open.filter(
    (row) => row.priority === "urgent" || row.priority === "critical",
  ).length;
  const pendingDependency = open.filter(
    (row) => row.status === "pending_dependency",
  ).length;
  const readyForVerification = open.filter(
    (row) => row.status === "ready_for_verification",
  ).length;
  const averageAgingDays =
    open.length === 0
      ? 0
      : Math.round(
          (open.reduce(
            (sum, row) =>
              sum + Math.max(0, nowTime - Date.parse(row.createdAt)),
            0,
          ) /
            open.length /
            86_400_000) *
            10,
        ) / 10;

  return {
    open: open.length,
    urgentCritical,
    overdue,
    pendingDependency,
    readyForVerification,
    closed: rows.filter((row) => row.status === "closed").length,
    averageAgingDays,
  };
}
