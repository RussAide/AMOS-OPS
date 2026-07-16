import {
  DX1_EVALUATED_AT,
  DX1_SCENARIO_ID,
  type Dx1AuditEvent,
  type Dx1PilotStageId,
} from "../contracts";

export function immutable<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>))
      immutable(child);
    Object.freeze(value);
  }
  return value;
}

function token(value: string): string {
  return (
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 56) || "EMPTY"
  );
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

export function dx1IntelligenceId(
  prefix: string,
  ...parts: readonly string[]
): string {
  return `${token(prefix)}-${stableHash(parts.join("|"))}`;
}

export function unique<T>(values: readonly T[]): readonly T[] {
  return immutable([...new Set(values)]);
}

export function createDx1IntelligenceAuditEvent(input: {
  action: string;
  actorId: string;
  actorRole: string;
  outcome: Dx1AuditEvent["outcome"];
  reason: string;
  evidenceIds: readonly string[];
  stageId?: Dx1PilotStageId | "cross-enterprise";
}): Readonly<Dx1AuditEvent> {
  const evidenceIds = unique(input.evidenceIds);
  if (evidenceIds.length === 0)
    throw new Error("DX1_INTELLIGENCE_AUDIT_EVIDENCE_REQUIRED");
  return immutable({
    eventId: dx1IntelligenceId(
      "SYNTH-DX1-INTELLIGENCE-AUDIT",
      input.action,
      input.actorId,
      input.outcome,
      ...evidenceIds,
    ),
    scenarioId: DX1_SCENARIO_ID,
    stageId: input.stageId ?? "cross-enterprise",
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    outcome: input.outcome,
    reason: input.reason,
    evidenceIds,
    occurredAt: DX1_EVALUATED_AT,
    synthetic: true,
  });
}

export function assertDx1Intelligence(
  condition: unknown,
  code: string,
): asserts condition {
  if (!condition) throw new Error(code);
}
