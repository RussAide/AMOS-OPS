import type { CcmgEvidenceClass } from "./intake";

export const CCMG_AUDIT_EVENT_TYPES = [
  "access",
  "assignment",
  "approval",
  "plan_handoff",
  "material_change",
] as const;

export type CcmgAuditEventType = (typeof CCMG_AUDIT_EVENT_TYPES)[number];

export interface CcmgAuditEvent {
  id: string;
  caseId: string | null;
  referralId: string | null;
  workItemId: string | null;
  eventType: CcmgAuditEventType;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorRole: string;
  reason: string;
  before: Readonly<Record<string, unknown>> | null;
  after: Readonly<Record<string, unknown>> | null;
  changedFields: readonly string[];
  correlationId: string;
  evidenceClass: CcmgEvidenceClass;
  occurredAt: string;
}

export function changedFieldNames(
  before: Readonly<Record<string, unknown>> | null,
  after: Readonly<Record<string, unknown>> | null,
): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys]
    .filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
    .sort();
}

export function validateAuditEvent(event: CcmgAuditEvent): readonly string[] {
  const findings: string[] = [];
  if (!CCMG_AUDIT_EVENT_TYPES.includes(event.eventType)) findings.push("AUDIT_EVENT_TYPE_INVALID");
  if (!event.id.trim() || !event.entityType.trim() || !event.entityId.trim()) findings.push("AUDIT_ENTITY_REQUIRED");
  if (!event.actorId.trim() || !event.actorRole.trim()) findings.push("AUDIT_ACTOR_REQUIRED");
  if (!event.reason.trim() || !event.correlationId.trim()) findings.push("AUDIT_CONTEXT_REQUIRED");
  if (!Number.isFinite(Date.parse(event.occurredAt))) findings.push("AUDIT_TIMESTAMP_INVALID");
  if (event.eventType !== "access" && event.changedFields.length === 0) findings.push("AUDIT_CHANGED_FIELDS_REQUIRED");
  if (event.eventType === "access" && (event.before !== null || event.after !== null)) findings.push("AUDIT_ACCESS_SNAPSHOT_PROHIBITED");
  return findings;
}
