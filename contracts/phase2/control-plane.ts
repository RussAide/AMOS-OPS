export const PHASE2_DOMAINS = ["SHARED", "MHTCM", "MHRS", "GRO"] as const;
export type Phase2Domain = (typeof PHASE2_DOMAINS)[number];

export type Phase2EvidenceClass = "synthetic_demo" | "production";
export type Phase2Priority = "routine" | "urgent" | "critical";
export type Phase2EscalationLevel = "none" | "supervisor" | "director" | "executive";
export type Phase2WorkStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "awaiting_approval"
  | "completed"
  | "cancelled";
export type Phase2AlertStatus = "open" | "acknowledged" | "resolved" | "expired";

export interface Phase2Actor {
  id: string;
  role: string;
  displayLabel?: string;
}

export interface Phase2CareEpisode {
  id: string;
  caseId: string;
  referralId: string;
  youthId: string;
  youthDisplayLabel: string;
  evidenceClass: Phase2EvidenceClass;
  status: "active" | "discharging" | "discharged" | "closed";
  cansAssessmentId?: string;
  cansVersion?: number;
  mhtcmPlanId?: string;
  mhrsPlanId?: string;
  groPlacementId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Phase2CareLink {
  episodeId: string;
  caseId: string;
  sourceDomain: Phase2Domain;
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  targetDomain: Phase2Domain;
  targetType: string;
  targetId: string;
  targetVersion: number;
  relation: "derived_from" | "fulfills" | "coordinates_with" | "transitions_to" | "read_only_reference";
  evidenceClass: Phase2EvidenceClass;
  createdAt: string;
}

export interface Phase2WorkItem {
  id: string;
  episodeId: string;
  domain: Phase2Domain;
  title: string;
  sourceType: string;
  sourceId: string;
  status: Phase2WorkStatus;
  priority: Phase2Priority;
  assignedRole: string;
  assignedTo?: string;
  dueAt: string;
  escalationLevel: Phase2EscalationLevel;
  escalatedAt?: string;
  escalationReason?: string;
  exceptionCode?: string;
  exceptionReason?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Phase2Alert {
  id: string;
  episodeId: string;
  domain: Phase2Domain;
  alertType: string;
  sourceType: string;
  sourceId: string;
  title: string;
  status: Phase2AlertStatus;
  priority: Phase2Priority;
  dueAt: string;
  assignedRole: string;
  assignedTo?: string;
  escalationLevel: Phase2EscalationLevel;
  acknowledgedAt?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface Phase2Handoff {
  id: string;
  episodeId: string;
  fromDomain: Phase2Domain;
  toDomain: Phase2Domain;
  status: "initiated" | "accepted" | "rejected" | "returned" | "completed";
  reason: string;
  payload: Readonly<Record<string, unknown>>;
  initiatedBy: string;
  initiatedAt: string;
  dueAt: string;
  acceptedBy?: string;
  acceptedAt?: string;
  completedAt?: string;
  version: number;
}

export interface Phase2AuditEvent {
  id: string;
  episodeId?: string;
  domain: Phase2Domain;
  eventType: "access" | "assignment" | "approval" | "handoff" | "material_change" | "gate_decision" | "scenario";
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorRole: string;
  reason: string;
  before?: Readonly<Record<string, unknown>>;
  after?: Readonly<Record<string, unknown>>;
  changedFields: readonly string[];
  correlationId: string;
  evidenceClass: Phase2EvidenceClass;
  occurredAt: string;
}

export interface Phase2GateFinding {
  code: string;
  message: string;
  severity: "error" | "warning" | "information";
  sourceControl?: string;
}

export interface Phase2ClaimHandoff {
  id: string;
  episodeId: string;
  program: "MHTCM" | "MHRS";
  encounterId: string;
  procedureCode: "T1017" | "H2014" | "H2017";
  status: "blocked" | "ready" | "handed_off" | "returned";
  findings: readonly Phase2GateFinding[];
  evaluatorVersion: string;
  decidedAt: string;
  handedOffAt?: string;
  correlationId: string;
  evidenceClass: Phase2EvidenceClass;
}

export interface Phase2ScenarioRun {
  id: string;
  milestone: "M2.2" | "M2.3" | "M2.4" | "PHASE2_EXIT";
  scenarioType: string;
  status: "not_started" | "running" | "passed" | "failed";
  episodeId: string;
  startedAt: string;
  completedAt?: string;
  assertionsPassed: number;
  assertionsFailed: number;
  evidence: Readonly<Record<string, unknown>>;
}

function parseIso(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid ISO timestamp: ${value}`);
  return parsed;
}

export function addUtcDays(value: string, days: number): string {
  const parsed = parseIso(value);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString();
}

export function addUtcHours(value: string, hours: number): string {
  const parsed = parseIso(value);
  parsed.setUTCHours(parsed.getUTCHours() + hours);
  return parsed.toISOString();
}

export function daysBetween(earlier: string, later: string): number {
  return Math.floor((parseIso(later).getTime() - parseIso(earlier).getTime()) / 86_400_000);
}

export type Phase2DeadlineState = "upcoming" | "due" | "overdue" | "completed";

export function evaluateDeadline(
  dueAt: string,
  evaluationAt: string,
  completedAt?: string,
): Phase2DeadlineState {
  if (completedAt) return "completed";
  const due = parseIso(dueAt).getTime();
  const evaluated = parseIso(evaluationAt).getTime();
  if (evaluated > due) return "overdue";
  if (evaluated === due) return "due";
  return "upcoming";
}

export function changedFieldNames(
  before: Readonly<Record<string, unknown>> | undefined,
  after: Readonly<Record<string, unknown>> | undefined,
): string[] {
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...fields].filter((field) => JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field])).sort();
}

export function stablePhase2Id(prefix: string, ...parts: readonly string[]): string {
  const input = parts.join("|");
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

export function assertSyntheticBoundary(value: { id: string; evidenceClass: Phase2EvidenceClass }): void {
  if (value.evidenceClass !== "synthetic_demo" || !value.id.startsWith("SYNTH-")) {
    throw new Error("PHASE2_SYNTHETIC_BOUNDARY_VIOLATION");
  }
}

export function claimHandoffAllowed(handoff: Phase2ClaimHandoff): boolean {
  return handoff.status !== "blocked" && !handoff.findings.some((finding) => finding.severity === "error");
}
