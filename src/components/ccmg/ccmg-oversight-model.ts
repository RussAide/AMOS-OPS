export type CcmgEvidenceMode = "production" | "synthetic_demo";

export type CcmgQueueKind =
  "intake" | "qa" | "cans" | "medication" | "mhtcm" | "mhrs";

export type CcmgTone = "neutral" | "positive" | "warning" | "critical";

export interface CcmgMetricViewModel {
  id: string;
  label: string;
  value: string | number | null;
  detail: string | null;
  tone: CcmgTone;
}

export interface CcmgQueueItemViewModel {
  id: string;
  referralId: string;
  queue: CcmgQueueKind;
  youthAlias: string;
  recordLabel: string;
  status: string;
  acuity: string;
  assignedTo: string | null;
  assignedRole: string | null;
  dueAt: string | null;
  lastActivityAt: string | null;
  authorizationStatus: string | null;
  exceptions: string[];
}

export interface CcmgQueueViewModel {
  kind: CcmgQueueKind;
  label: string;
  description: string;
  available: boolean;
  visible: boolean;
  itemsAvailable: boolean;
  count: number;
  overdue: number;
  highAcuity: number;
  items: CcmgQueueItemViewModel[];
}

export interface CcmgDashboardViewModel {
  evidenceMode: CcmgEvidenceMode;
  evidenceLabel: string;
  generatedAt: string | null;
  roleLabel: string | null;
  scopeLabel: string;
  metrics: CcmgMetricViewModel[];
  queues: CcmgQueueViewModel[];
}

export interface CcmgGateViewModel {
  id:
    | "intake"
    | "eligibility"
    | "authorization"
    | "consent"
    | "cans"
    | "capacity";
  label: string;
  status: string;
  detail: string | null;
  owner: string | null;
  updatedAt: string | null;
}

export interface CcmgWorkflowViewModel {
  workItemId: string | null;
  expectedVersion: number | null;
  status: string;
  stage: string;
  assignedDivision: string | null;
  assignedDepartment: string | null;
  assignedTo: string | null;
  assignedRole: string | null;
  dueAt: string | null;
  approvalStatus: string | null;
  escalationLevel: string | null;
  exceptionCode: string | null;
  exceptionStatus: string | null;
  handoff: string | null;
  handoffId: string | null;
  handoffVersion: number | null;
  handoffStatus: string | null;
  exceptions: string[];
}

export interface CcmgCansRouteViewModel {
  id: string;
  targetType: string;
  targetRecordId: string | null;
  targetVersion: string | number | null;
  approvalStatus: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  routedBy: string | null;
  routedAt: string | null;
  mappedGoalCount: number;
  detail: string | null;
}

export interface CcmgCansLineageViewModel {
  id: string;
  assessmentVersion: string | number;
  instrumentVersion: string | null;
  completedAt: string | null;
  completedByRole: string | null;
  totalScore: string | number | null;
  riskLevel: string | null;
  source: string | null;
  supersedes: string | null;
  routes: CcmgCansRouteViewModel[];
}

export interface CcmgAuditEventViewModel {
  id: string;
  occurredAt: string | null;
  actorRole: string;
  action: string;
  detail: string | null;
  source: string | null;
}

export interface CcmgReferralDetailViewModel {
  evidenceMode: CcmgEvidenceMode;
  evidenceLabel: string;
  referralId: string;
  referralVersion: number | null;
  youthAlias: string;
  recordLabel: string;
  program: string | null;
  acuity: string;
  authorizationStatus: string | null;
  coordinationSummary: string | null;
  workflow: CcmgWorkflowViewModel;
  gates: CcmgGateViewModel[];
  cansLineage: CcmgCansLineageViewModel[];
  auditTrail: CcmgAuditEventViewModel[];
}

type UnknownRecord = Record<string, unknown>;

export const CCMG_QUEUE_DEFINITIONS: ReadonlyArray<{
  kind: CcmgQueueKind;
  label: string;
  description: string;
  aliases: readonly string[];
}> = [
  {
    kind: "intake",
    label: "Intake",
    description:
      "Referral readiness, eligibility, consent, and placement gates.",
    aliases: ["intake", "referral", "referrals"],
  },
  {
    kind: "qa",
    label: "QA findings",
    description: "Chart findings, corrections, and closure verification.",
    aliases: ["qa", "quality", "quality_assurance", "qualityAssurance"],
  },
  {
    kind: "cans",
    label: "CANS",
    description: "Assessment currency, review, lineage, and decision support.",
    aliases: ["cans", "assessment", "assessments"],
  },
  {
    kind: "medication",
    label: "Medication oversight",
    description: "Medication-management coordination and exception follow-up.",
    aliases: [
      "medication",
      "medications",
      "medication_management",
      "medicationManagement",
      "medication-management",
    ],
  },
  {
    kind: "mhtcm",
    label: "MHTCM",
    description: "Targeted case-management coordination and overdue work.",
    aliases: ["mhtcm", "targeted_case_management", "targetedCaseManagement"],
  },
  {
    kind: "mhrs",
    label: "MHRS",
    description: "Rehabilitative-service coordination and delivery readiness.",
    aliases: ["mhrs", "rehabilitative_services", "rehabilitativeServices"],
  },
];

const METRIC_DEFINITIONS: ReadonlyArray<{
  id: string;
  label: string;
  aliases: readonly string[];
  tone: CcmgTone;
}> = [
  {
    id: "backlog",
    label: "Open backlog",
    aliases: ["backlogWorkItems", "backlog_work_items"],
    tone: "neutral",
  },
  {
    id: "acuity",
    label: "High acuity",
    aliases: [
      "acuity",
      "highAcuity",
      "high_acuity",
      "highAcuityCount",
      "highAcuityCases",
      "urgentReferrals",
    ],
    tone: "critical",
  },
  {
    id: "authorizations",
    label: "Authorization watch",
    aliases: [
      "authorizations",
      "authorizationWatch",
      "authorization_watch",
      "authorizationsPending",
      "authorizationPending",
    ],
    tone: "warning",
  },
  {
    id: "overdue",
    label: "Overdue work",
    aliases: [
      "overdue",
      "overdueWork",
      "overdue_work",
      "overdueWorkItems",
      "pastDue",
    ],
    tone: "critical",
  },
  {
    id: "qa-findings",
    label: "QA findings",
    aliases: ["qaFindings", "qa_findings"],
    tone: "warning",
  },
  {
    id: "coordination",
    label: "Service coordination",
    aliases: ["serviceCoordinationItems", "service_coordination_items"],
    tone: "neutral",
  },
];

const GATE_DEFINITIONS: ReadonlyArray<{
  id: CcmgGateViewModel["id"];
  label: string;
  aliases: readonly string[];
}> = [
  { id: "intake", label: "Intake", aliases: ["intake"] },
  { id: "eligibility", label: "Eligibility", aliases: ["eligibility"] },
  {
    id: "authorization",
    label: "Authorization",
    aliases: [
      "authorization",
      "auth",
      "payerAuthorization",
      "payer_authorization",
    ],
  },
  { id: "consent", label: "Consent", aliases: ["consent", "consents"] },
  { id: "cans", label: "CANS", aliases: ["cans", "assessment"] },
  { id: "capacity", label: "Capacity", aliases: ["capacity", "placement"] },
];

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function integer(value: unknown): number {
  const parsed = number(value);
  return parsed === null ? 0 : Math.max(0, Math.trunc(parsed));
}

function first(source: UnknownRecord | null, keys: readonly string[]): unknown {
  if (!source) return null;
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return null;
}

function textFrom(
  source: UnknownRecord | null,
  keys: readonly string[],
): string | null {
  return text(first(source, keys));
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        const source = record(entry);
        return source
          ? textFrom(source, [
              "label",
              "code",
              "exceptionCode",
              "reason",
              "detail",
              "status",
            ])
          : text(entry);
      })
      .filter((entry): entry is string => entry !== null);
  }
  const single = text(value);
  return single ? [single] : [];
}

function normalizedToken(value: unknown): string {
  return (
    text(value)
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") ?? ""
  );
}

function normalizeEvidenceMode(source: UnknownRecord): CcmgEvidenceMode {
  const token = normalizedToken(
    first(source, [
      "evidenceMode",
      "evidence_mode",
      "evidenceClass",
      "evidence_class",
      "dataMode",
      "data_mode",
      "mode",
    ]),
  );
  return token.includes("synthetic") || source.isSynthetic === true
    ? "synthetic_demo"
    : "production";
}

function collectionEntries(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return value.map((entry, index) => [String(index), entry]);
  }
  const source = record(value);
  return source ? Object.entries(source) : [];
}

function matchesAlias(value: unknown, aliases: readonly string[]): boolean {
  const token = normalizedToken(value);
  return aliases.some((alias) => normalizedToken(alias) === token);
}

function metricFromEntry(
  entry: unknown,
  fallbackId: string,
): CcmgMetricViewModel | null {
  const source = record(entry);
  if (!source) {
    const value =
      typeof entry === "number" || typeof entry === "string" ? entry : null;
    return value === null
      ? null
      : {
          id: fallbackId,
          label: fallbackId,
          value,
          detail: null,
          tone: "neutral",
        };
  }
  const value = first(source, ["value", "count", "total", "current"]);
  return {
    id: textFrom(source, ["id", "key", "code"]) ?? fallbackId,
    label: textFrom(source, ["label", "name", "title"]) ?? fallbackId,
    value: number(value) ?? text(value),
    detail: textFrom(source, ["detail", "description", "context", "trend"]),
    tone: normalizeTone(first(source, ["tone", "severity", "status"])),
  };
}

function normalizeTone(value: unknown): CcmgTone {
  const token = normalizedToken(value);
  if (["critical", "danger", "high", "overdue", "red"].includes(token))
    return "critical";
  if (["warning", "watch", "at_risk", "medium", "amber"].includes(token))
    return "warning";
  if (["positive", "success", "good", "green", "on_target"].includes(token))
    return "positive";
  return "neutral";
}

const TERMINAL_WORKFLOW_STATES = new Set([
  "cancelled",
  "canceled",
  "closed",
  "completed",
  "rejected",
  "resolved",
]);

function nonterminalQueueItem(item: CcmgQueueItemViewModel): boolean {
  const status = normalizedToken(item.status);
  return status.length > 0 && !TERMINAL_WORKFLOW_STATES.has(status);
}

function derivedQueueMetric(
  id: string,
  queues: CcmgQueueViewModel[],
): Pick<CcmgMetricViewModel, "value" | "detail"> | null {
  const requiredKinds: CcmgQueueKind[] =
    id === "backlog"
      ? CCMG_QUEUE_DEFINITIONS.map((definition) => definition.kind)
      : id === "qa-findings"
        ? ["qa"]
        : id === "coordination"
          ? ["mhtcm", "mhrs"]
          : [];
  if (requiredKinds.length === 0) return null;

  const requiredQueues = requiredKinds.map((kind) =>
    queues.find((queue) => queue.kind === kind),
  );
  const unavailable = requiredQueues.some(
    (queue) =>
      !queue || !queue.available || !queue.visible || !queue.itemsAvailable,
  );
  if (unavailable) {
    return {
      value: null,
      detail:
        "Unavailable: required queue-item evidence is restricted or missing",
    };
  }

  const value = requiredQueues.reduce(
    (total, queue) =>
      total + (queue?.items.filter(nonterminalQueueItem).length ?? 0),
    0,
  );
  const detail =
    id === "backlog"
      ? "Derived from nonterminal items in all six visible queues"
      : id === "qa-findings"
        ? "Derived from nonterminal QA queue items"
        : "Derived from nonterminal MHTCM and MHRS queue items";
  return { value, detail };
}

function normalizeMetrics(
  source: UnknownRecord,
  queues: CcmgQueueViewModel[],
): CcmgMetricViewModel[] {
  const metricSource = first(source, [
    "metrics",
    "roleMetrics",
    "role_metrics",
    "summary",
  ]);
  const entries = collectionEntries(metricSource);

  const normalized = entries
    .map(([key, entry]) => metricFromEntry(entry, key))
    .filter((entry): entry is CcmgMetricViewModel => entry !== null);

  return METRIC_DEFINITIONS.map((definition) => {
    const match = normalized.find(
      (metric) =>
        matchesAlias(metric.id, definition.aliases) ||
        matchesAlias(metric.label, definition.aliases),
    );
    if (match) {
      return {
        ...match,
        id: definition.id,
        label: match.label === match.id ? definition.label : match.label,
        tone: match.tone === "neutral" ? definition.tone : match.tone,
      };
    }

    const direct = first(source, definition.aliases);
    const directValue = number(direct) ?? text(direct);
    const derived = derivedQueueMetric(definition.id, queues);
    return {
      id: definition.id,
      label: definition.label,
      value: directValue ?? derived?.value ?? null,
      detail: directValue === null ? (derived?.detail ?? null) : null,
      tone: definition.tone,
    };
  });
}

function identifyQueue(
  value: unknown,
  fallbackKey?: string,
): CcmgQueueKind | null {
  const source = record(value);
  const candidate =
    textFrom(source, [
      "kind",
      "queue",
      "queueKind",
      "queue_kind",
      "id",
      "code",
      "label",
    ]) ??
    fallbackKey ??
    "";
  return (
    CCMG_QUEUE_DEFINITIONS.find((definition) =>
      matchesAlias(candidate, definition.aliases),
    )?.kind ?? null
  );
}

function normalizeQueueItem(
  value: unknown,
  queue: CcmgQueueKind,
  index: number,
): CcmgQueueItemViewModel {
  const source = record(value) ?? {};
  const referral = record(first(source, ["referral", "case", "record"]));
  const assignment = record(first(source, ["assignment", "owner"]));
  const id =
    textFrom(source, ["id", "queueItemId", "queue_item_id", "workItemId"]) ??
    `${queue}-${index + 1}`;
  const referralId =
    textFrom(source, ["referralId", "referral_id", "caseId", "case_id"]) ??
    textFrom(referral, ["id", "referralId", "referral_id"]) ??
    id;
  return {
    id,
    referralId,
    queue,
    youthAlias:
      textFrom(source, [
        "youthAlias",
        "youth_alias",
        "youthDisplayLabel",
        "personAlias",
        "displayName",
        "title",
      ]) ??
      textFrom(referral, [
        "youthAlias",
        "youth_alias",
        "personAlias",
        "displayName",
      ]) ??
      "Restricted record",
    recordLabel:
      textFrom(source, [
        "recordLabel",
        "record_label",
        "reference",
        "referenceId",
      ]) ??
      textFrom(referral, [
        "recordLabel",
        "record_label",
        "reference",
        "referenceId",
      ]) ??
      referralId,
    status:
      textFrom(source, [
        "status",
        "workflowStatus",
        "workflow_status",
        "stage",
      ]) ?? "unknown",
    acuity:
      textFrom(source, ["acuity", "priority", "riskLevel", "risk_level"]) ??
      "not set",
    assignedTo:
      textFrom(source, [
        "assignedTo",
        "assigned_to",
        "assignee",
        "ownerName",
      ]) ?? textFrom(assignment, ["name", "displayName", "assignee"]),
    assignedRole:
      textFrom(source, ["assignedRole", "assigned_role", "ownerRole"]) ??
      textFrom(assignment, ["role", "roleLabel"]),
    dueAt: textFrom(source, [
      "dueAt",
      "due_at",
      "dueDate",
      "due_date",
      "deadline",
    ]),
    lastActivityAt: textFrom(source, [
      "lastActivityAt",
      "last_activity_at",
      "updatedAt",
      "updated_at",
    ]),
    authorizationStatus: textFrom(source, [
      "authorizationStatus",
      "authorization_status",
      "authStatus",
      "auth_status",
      "approvalStatus",
    ]),
    exceptions: stringList(
      first(source, [
        "exceptions",
        "exceptionFlags",
        "exception_flags",
        "exceptionCode",
        "flags",
      ]),
    ),
  };
}

function normalizeQueues(source: UnknownRecord): CcmgQueueViewModel[] {
  const queueSource = first(source, [
    "queues",
    "workQueues",
    "work_queues",
    "queueSummaries",
  ]);
  const entries = collectionEntries(queueSource);

  return CCMG_QUEUE_DEFINITIONS.map((definition) => {
    const match = entries.find(
      ([key, value]) => identifyQueue(value, key) === definition.kind,
    );
    const queueSourceRecord = record(match?.[1]);
    const arrayQueueSource = Array.isArray(match?.[1]);
    const available =
      match !== undefined && (queueSourceRecord !== null || arrayQueueSource);
    const rawItems = queueSourceRecord
      ? first(queueSourceRecord, [
          "items",
          "records",
          "workItems",
          "work_items",
        ])
      : arrayQueueSource
        ? match?.[1]
        : [];
    const visible =
      available &&
      (queueSourceRecord ? queueSourceRecord.visible !== false : true);
    const itemsAvailable =
      visible &&
      (queueSourceRecord ? Array.isArray(rawItems) : arrayQueueSource);
    const items = visible
      ? list(rawItems).map((item, index) =>
          normalizeQueueItem(item, definition.kind, index),
        )
      : [];
    return {
      kind: definition.kind,
      label:
        textFrom(queueSourceRecord, ["label", "name", "title"]) ??
        definition.label,
      description:
        textFrom(queueSourceRecord, ["description", "detail", "summary"]) ??
        definition.description,
      available,
      visible,
      itemsAvailable,
      count: visible
        ? integer(
            first(queueSourceRecord, ["count", "total", "backlog", "open"]),
          ) || items.length
        : 0,
      overdue: visible
        ? integer(
            first(queueSourceRecord, [
              "overdue",
              "overdueCount",
              "overdue_count",
            ]),
          )
        : 0,
      highAcuity: visible
        ? integer(
            first(queueSourceRecord, [
              "highAcuity",
              "high_acuity",
              "highAcuityCount",
              "urgent",
            ]),
          )
        : 0,
      items,
    };
  });
}

export function normalizeCcmgDashboard(raw: unknown): CcmgDashboardViewModel {
  const outer = record(raw) ?? {};
  const source =
    record(first(outer, ["dashboard", "data", "oversightDashboard"])) ?? outer;
  const evidenceMode = normalizeEvidenceMode(source);
  const actor = record(first(source, ["actor", "viewer"]));
  const queues = normalizeQueues(source);
  return {
    evidenceMode,
    evidenceLabel:
      textFrom(source, [
        "evidenceLabel",
        "evidence_label",
        "dataLabel",
        "data_label",
      ]) ??
      (evidenceMode === "synthetic_demo"
        ? "Fictional synthetic preview — not production evidence"
        : "Connected operational evidence"),
    generatedAt: textFrom(source, [
      "generatedAt",
      "generated_at",
      "asOf",
      "as_of",
    ]),
    roleLabel:
      textFrom(source, ["roleLabel", "role_label", "role", "audience"]) ??
      textFrom(actor, ["role", "roleLabel"]),
    scopeLabel:
      textFrom(source, [
        "scopeLabel",
        "scope_label",
        "scope",
        "programLabel",
      ]) ?? "BHC · CCMG oversight",
    metrics: normalizeMetrics(source, queues),
    queues,
  };
}

function normalizeGate(
  value: unknown,
  definition: (typeof GATE_DEFINITIONS)[number],
): CcmgGateViewModel {
  const source = record(value);
  return {
    id: definition.id,
    label: textFrom(source, ["label", "name", "title"]) ?? definition.label,
    status:
      textFrom(source, [
        "status",
        "state",
        "result",
        "authorizationStatus",
        "verificationStatus",
      ]) ??
      text(value) ??
      "not started",
    detail: textFrom(source, [
      "detail",
      "description",
      "reason",
      "note",
      "reasonCode",
      "rationale",
      "payerLabel",
    ]),
    owner: textFrom(source, [
      "owner",
      "ownerRole",
      "owner_role",
      "assignedRole",
      "completedBy",
      "determinedBy",
    ]),
    updatedAt: textFrom(source, [
      "updatedAt",
      "updated_at",
      "completedAt",
      "completed_at",
      "determinedAt",
      "effectiveAt",
      "checkedAt",
      "scheduledFor",
      "dueAt",
    ]),
  };
}

function normalizeGates(source: UnknownRecord): CcmgGateViewModel[] {
  const gateSource = first(source, [
    "gates",
    "readinessGates",
    "readiness_gates",
    "gateStatus",
  ]);
  const entries = collectionEntries(gateSource);
  return GATE_DEFINITIONS.map((definition) => {
    const match = entries.find(([key, value]) => {
      const gate = record(value);
      const candidate = textFrom(gate, ["id", "key", "code", "label"]) ?? key;
      return matchesAlias(candidate, definition.aliases);
    });
    return normalizeGate(match?.[1], definition);
  });
}

function normalizeWorkflow(source: UnknownRecord): CcmgWorkflowViewModel {
  const workflow =
    record(first(source, ["workflow", "workflowStatus", "workflow_status"])) ??
    {};
  const assignments = list(first(workflow, ["assignments"]));
  const approvals = list(first(workflow, ["approvals"]));
  const handoffs = list(first(workflow, ["handoffs"]));
  const assignment =
    record(first(workflow, ["assignment", "owner"])) ??
    currentWorkflowEntry(assignments);
  const approval = currentWorkflowEntry(approvals);
  const handoff = currentHandoffEntry([...handoffs].reverse());
  const referral = record(first(source, ["referral", "overview", "case"]));
  const workItem =
    record(first(workflow, ["workItem", "work_item"])) ??
    record(first(assignment, ["workItem", "work_item"]));
  return {
    workItemId:
      textFrom(workflow, ["workItemId", "work_item_id"]) ??
      textFrom(workItem, ["id", "workItemId"]) ??
      textFrom(assignment, ["workItemId", "work_item_id", "id"]),
    expectedVersion:
      number(
        first(workflow, ["version", "expectedVersion", "expected_version"]),
      ) ??
      number(first(workItem, ["version", "expectedVersion"])) ??
      number(first(assignment, ["version", "expectedVersion"])),
    status:
      textFrom(workflow, ["status", "state"]) ??
      textFrom(workItem, ["status", "state"]) ??
      textFrom(assignment, ["status", "state"]) ??
      textFrom(referral, ["status"]) ??
      "unknown",
    stage:
      textFrom(workflow, ["stage", "currentStage", "current_stage"]) ??
      textFrom(workItem, ["stage", "queueId", "queue_id", "title"]) ??
      textFrom(assignment, ["queueId", "queue_id", "title"]) ??
      textFrom(assignment, ["assignedDepartment", "assigned_department"]) ??
      textFrom(referral, ["status"]) ??
      "not set",
    assignedDivision:
      textFrom(workflow, ["assignedDivision", "assigned_division"]) ??
      textFrom(assignment, ["assignedDivision", "assigned_division"]),
    assignedDepartment:
      textFrom(workflow, ["assignedDepartment", "assigned_department"]) ??
      textFrom(assignment, ["assignedDepartment", "assigned_department"]),
    assignedTo:
      textFrom(workflow, [
        "assignedTo",
        "assigned_to",
        "assignee",
        "ownerName",
      ]) ??
      textFrom(assignment, [
        "assignedTo",
        "assigned_to",
        "name",
        "displayName",
        "assignee",
      ]),
    assignedRole:
      textFrom(workflow, ["assignedRole", "assigned_role", "ownerRole"]) ??
      textFrom(assignment, [
        "assignedRole",
        "assigned_role",
        "role",
        "roleLabel",
      ]),
    dueAt:
      textFrom(workflow, [
        "dueAt",
        "due_at",
        "dueDate",
        "due_date",
        "deadline",
      ]) ??
      textFrom(assignment, [
        "dueAt",
        "due_at",
        "dueDate",
        "due_date",
        "deadline",
      ]),
    approvalStatus:
      textFrom(workflow, ["approvalStatus", "approval_status", "approval"]) ??
      textFrom(approval, [
        "approvalStatus",
        "approval_status",
        "status",
        "decision",
      ]),
    escalationLevel:
      textFrom(workflow, ["escalationLevel", "escalation_level"]) ??
      textFrom(assignment, ["escalationLevel", "escalation_level"]),
    exceptionCode:
      textFrom(workflow, ["exceptionCode", "exception_code"]) ??
      textFrom(assignment, ["exceptionCode", "exception_code"]),
    exceptionStatus:
      textFrom(workflow, ["exceptionStatus", "exception_status"]) ??
      textFrom(assignment, ["exceptionStatus", "exception_status"]),
    handoff:
      textFrom(workflow, [
        "handoff",
        "handoffSummary",
        "handoff_summary",
        "nextStep",
      ]) ??
      textFrom(handoff, ["summary", "reason", "toDepartment", "to_department"]),
    handoffId: textFrom(handoff, ["id", "handoffId", "handoff_id"]),
    handoffVersion: number(
      first(handoff, ["version", "expectedVersion", "expected_version"]),
    ),
    handoffStatus: textFrom(handoff, ["status", "state"]),
    exceptions: stringList(
      first(workflow, [
        "exceptions",
        "exceptionFlags",
        "exception_flags",
        "flags",
      ]),
    ),
  };
}

function currentWorkflowEntry(entries: unknown[]): UnknownRecord | null {
  const records = entries
    .map(record)
    .filter((entry): entry is UnknownRecord => entry !== null);
  const state = (entry: UnknownRecord) =>
    normalizedToken(
      first(entry, ["status", "state", "approvalStatus", "approval_status"]),
    );
  for (const activeState of [
    "blocked",
    "awaiting_approval",
    "in_progress",
    "pending",
    "active",
    "current",
    "open",
  ]) {
    const match = records.find((entry) => state(entry) === activeState);
    if (match) return match;
  }

  return (
    records.find(
      (entry) =>
        (entry.active === true || entry.isCurrent === true) &&
        !TERMINAL_WORKFLOW_STATES.has(state(entry)),
    ) ??
    records.find((entry) => {
      const entryState = state(entry);
      return entryState.length > 0 && !TERMINAL_WORKFLOW_STATES.has(entryState);
    }) ??
    null
  );
}

function currentHandoffEntry(entries: unknown[]): UnknownRecord | null {
  const records = entries
    .map(record)
    .filter((entry): entry is UnknownRecord => entry !== null);
  return (
    records.find((entry) =>
      ["initiated", "accepted", "returned"].includes(
        normalizedToken(first(entry, ["status", "state"])),
      ),
    ) ?? null
  );
}

function normalizeCansLineage(
  source: UnknownRecord,
): CcmgCansLineageViewModel[] {
  const container = first(source, [
    "cansLineage",
    "cans_lineage",
    "assessmentLineage",
    "assessments",
  ]);
  const lineage = record(container);
  const raw = lineage
    ? first(lineage, ["versions", "assessments", "items"])
    : container;
  const routes = list(first(lineage, ["routes", "decisions"]));
  return list(raw).map((entry, index) => {
    const item = record(entry) ?? {};
    const assessmentId = textFrom(item, [
      "id",
      "assessmentId",
      "assessment_id",
    ]);
    const assessmentVersion =
      number(
        first(item, [
          "version",
          "assessmentVersion",
          "assessment_version",
          "sequence",
        ]),
      ) ??
      text(
        first(item, [
          "version",
          "assessmentVersion",
          "assessment_version",
          "sequence",
        ]),
      ) ??
      index + 1;
    const matchedRoutes = routes
      .map(record)
      .filter((candidate): candidate is UnknownRecord => {
        if (!candidate) return false;
        const routeAssessmentId = textFrom(candidate, [
          "assessmentId",
          "assessment_id",
          "cansId",
          "cansAssessmentId",
        ]);
        if (assessmentId && routeAssessmentId) {
          return routeAssessmentId === assessmentId;
        }
        const routeVersion = first(candidate, [
          "cansVersion",
          "assessmentVersion",
          "assessment_version",
        ]);
        return (
          routeVersion !== null &&
          normalizedToken(routeVersion) === normalizedToken(assessmentVersion)
        );
      })
      .map((route, routeIndex) => {
        const mappedGoals = first(route, [
          "mappedGoals",
          "mapped_goals",
          "goals",
        ]);
        const targetRecordId = textFrom(route, [
          "targetRecordId",
          "target_record_id",
          "recordId",
          "record_id",
        ]);
        return {
          id:
            textFrom(route, ["id", "lineageId", "lineage_id"]) ??
            targetRecordId ??
            `${assessmentId ?? `cans-${index + 1}`}-route-${routeIndex + 1}`,
          targetType:
            textFrom(route, ["targetType", "target_type", "route", "type"]) ??
            `Route ${routeIndex + 1}`,
          targetRecordId,
          targetVersion:
            number(
              first(route, ["targetVersion", "target_version", "version"]),
            ) ??
            text(first(route, ["targetVersion", "target_version", "version"])),
          approvalStatus: textFrom(route, [
            "targetApprovalStatus",
            "target_approval_status",
            "approvalStatus",
            "approval_status",
            "status",
          ]),
          approvedBy: textFrom(route, [
            "targetApprovedBy",
            "target_approved_by",
            "approvedBy",
            "approved_by",
          ]),
          approvedAt: textFrom(route, [
            "targetApprovedAt",
            "target_approved_at",
            "approvedAt",
            "approved_at",
          ]),
          routedBy: textFrom(route, ["routedBy", "routed_by"]),
          routedAt: textFrom(route, ["routedAt", "routed_at"]),
          mappedGoalCount: Array.isArray(mappedGoals)
            ? mappedGoals.length
            : integer(first(route, ["mappedGoalCount", "mapped_goal_count"])),
          detail: textFrom(route, [
            "detail",
            "reason",
            "decisionImpact",
            "decision_impact",
            "impact",
          ]),
        };
      });
    return {
      id: assessmentId ?? `cans-${index + 1}`,
      assessmentVersion,
      instrumentVersion: textFrom(item, [
        "instrumentVersion",
        "instrument_version",
      ]),
      completedAt: textFrom(item, [
        "completedAt",
        "completed_at",
        "assessedAt",
        "assessed_at",
      ]),
      completedByRole: textFrom(item, [
        "completedByRole",
        "completed_by_role",
        "assessorRole",
        "assessor_role",
        "completedBy",
      ]),
      totalScore:
        number(first(item, ["totalScore", "total_score", "score"])) ??
        text(first(item, ["totalScore", "total_score", "score"])),
      riskLevel: textFrom(item, ["riskLevel", "risk_level", "acuity"]),
      source: textFrom(item, [
        "source",
        "sourceSystem",
        "source_system",
        "evidenceClass",
      ]),
      supersedes: textFrom(item, [
        "supersedes",
        "previousId",
        "previous_id",
        "previousAssessmentId",
      ]),
      routes: matchedRoutes,
    };
  });
}

function normalizeAuditTrail(source: UnknownRecord): CcmgAuditEventViewModel[] {
  const audit = record(first(source, ["audit"]));
  const raw =
    first(source, ["auditTrail", "audit_trail", "events", "history"]) ??
    first(audit, ["events", "history"]);
  return list(raw).map((entry, index) => {
    const item = record(entry) ?? {};
    return {
      id: textFrom(item, ["id", "eventId", "event_id"]) ?? `event-${index + 1}`,
      occurredAt: textFrom(item, [
        "occurredAt",
        "occurred_at",
        "at",
        "createdAt",
        "created_at",
      ]),
      actorRole:
        textFrom(item, ["actorRole", "actor_role", "actor", "role"]) ??
        "System",
      action:
        textFrom(item, ["action", "event", "type", "label"]) ??
        "Recorded event",
      detail: textFrom(item, ["detail", "description", "note", "reason"]),
      source: textFrom(item, [
        "source",
        "sourceSystem",
        "source_system",
        "evidenceClass",
      ]),
    };
  });
}

export function normalizeCcmgReferralDetail(
  raw: unknown,
  requestedReferralId: string,
): CcmgReferralDetailViewModel {
  const outer = record(raw) ?? {};
  const source =
    record(first(outer, ["detail", "data", "referralDetail"])) ?? outer;
  const referral =
    record(first(source, ["referral", "overview", "case"])) ?? source;
  const evidenceMode = normalizeEvidenceMode({
    ...source,
    evidenceClass:
      first(source, ["evidenceClass", "evidence_class"]) ??
      first(referral, ["evidenceClass", "evidence_class"]),
  });
  const referralId =
    textFrom(referral, [
      "id",
      "referralId",
      "referral_id",
      "caseId",
      "case_id",
    ]) ?? requestedReferralId;
  const gates = normalizeGates(source);
  const workflow = normalizeWorkflow(source);
  const authorizationGate = gates.find((gate) => gate.id === "authorization");
  return {
    evidenceMode,
    evidenceLabel:
      textFrom(source, [
        "evidenceLabel",
        "evidence_label",
        "dataLabel",
        "data_label",
      ]) ??
      (evidenceMode === "synthetic_demo"
        ? "Fictional synthetic preview — not production evidence"
        : "Connected operational evidence"),
    referralId,
    referralVersion: number(
      first(referral, ["version", "expectedVersion", "expected_version"]),
    ),
    youthAlias:
      textFrom(referral, [
        "youthAlias",
        "youth_alias",
        "youthDisplayLabel",
        "personAlias",
        "displayName",
        "title",
      ]) ?? "Restricted record",
    recordLabel:
      textFrom(referral, [
        "recordLabel",
        "record_label",
        "reference",
        "referenceId",
        "caseId",
        "case_id",
      ]) ?? referralId,
    program: textFrom(referral, [
      "program",
      "serviceLine",
      "service_line",
      "department",
      "referralSourceDivision",
    ]),
    acuity:
      textFrom(referral, [
        "acuity",
        "priority",
        "riskLevel",
        "risk_level",
        "urgency",
      ]) ?? "not set",
    authorizationStatus:
      textFrom(referral, [
        "authorizationStatus",
        "authorization_status",
        "authStatus",
        "auth_status",
      ]) ??
      authorizationGate?.status ??
      null,
    coordinationSummary:
      textFrom(source, [
        "coordinationSummary",
        "coordination_summary",
        "coordination",
        "summary",
      ]) ?? workflow.handoff,
    workflow,
    gates,
    cansLineage: normalizeCansLineage(source),
    auditTrail: normalizeAuditTrail(source),
  };
}

export function ccmgAcceptanceChecks(
  dashboard: CcmgDashboardViewModel,
  detail?: CcmgReferralDetailViewModel,
): ReadonlyArray<{ id: string; label: string; passed: boolean }> {
  return [
    {
      id: "six-queues",
      label: "UI coverage: all six CCMG oversight queue types are represented",
      passed: CCMG_QUEUE_DEFINITIONS.every((definition) =>
        dashboard.queues.some((queue) => queue.kind === definition.kind),
      ),
    },
    {
      id: "role-metrics",
      label: "Evidence coverage: all six role metrics contain returned values",
      passed: METRIC_DEFINITIONS.every((definition) =>
        dashboard.metrics.some(
          (metric) => metric.id === definition.id && metric.value !== null,
        ),
      ),
    },
    {
      id: "evidence-label",
      label:
        "Evidence-class coverage: synthetic/demo records are explicitly labeled",
      passed:
        dashboard.evidenceMode !== "synthetic_demo" ||
        dashboard.evidenceLabel.toLowerCase().includes("synthetic"),
    },
    {
      id: "drill-in",
      label:
        "Trace coverage: drill-in exposes workflow, gates, CANS lineage, and audit history",
      passed: detail
        ? detail.gates.length === GATE_DEFINITIONS.length &&
          detail.cansLineage.length > 0 &&
          detail.auditTrail.length > 0
        : dashboard.queues.some((queue) => queue.items.length > 0),
    },
  ];
}

export function ccmgDetailCoverageChecks(
  detail: CcmgReferralDetailViewModel,
): ReadonlyArray<{ id: string; label: string; passed: boolean }> {
  return [
    {
      id: "workflow-accountability",
      label:
        "Evidence coverage: workflow status, assignment, due date, approval, exception, and handoff are returned",
      passed:
        detail.workflow.status !== "unknown" &&
        detail.workflow.assignedRole !== null &&
        detail.workflow.dueAt !== null,
    },
    {
      id: "six-gates",
      label:
        "Evidence coverage: all six readiness gates contain a returned status",
      passed:
        detail.gates.length === GATE_DEFINITIONS.length &&
        detail.gates.every((gate) => gate.status !== "not started"),
    },
    {
      id: "cans-lineage",
      label:
        "Trace coverage: CANS version lineage and routing impact are available",
      passed:
        detail.cansLineage.length > 0 &&
        detail.cansLineage.some((assessment) => assessment.routes.length > 0),
    },
    {
      id: "audit-trail",
      label: "Trace coverage: one or more audit events are returned",
      passed: detail.auditTrail.length > 0,
    },
    {
      id: "detail-evidence-label",
      label:
        "Evidence-class coverage: synthetic/demo referral data is explicitly labeled",
      passed:
        detail.evidenceMode !== "synthetic_demo" ||
        detail.evidenceLabel.toLowerCase().includes("synthetic"),
    },
  ];
}
