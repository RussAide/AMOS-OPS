import { createHash } from "node:crypto";
import type {
  M52JsonObject,
  M52JsonValue,
  M52RecordPayload,
  M52SyncLineage,
  M52SyncRecord,
} from "./types";

function normalizeJson(
  value: unknown,
  ancestors: ReadonlySet<object>,
): M52JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("M52_JSON_NUMBER_MUST_BE_FINITE");
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new Error("M52_JSON_VALUE_UNSUPPORTED");
  }
  if (ancestors.has(value)) {
    throw new Error("M52_JSON_PAYLOAD_CYCLE_PROHIBITED");
  }
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((item) => normalizeJson(item, nextAncestors)),
    );
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("M52_JSON_OBJECT_MUST_BE_PLAIN");
  }
  const entries = Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const normalized: Record<string, M52JsonValue> = {};
  for (const [key, item] of entries) {
    normalized[key] = normalizeJson(item, nextAncestors);
  }
  return Object.freeze(normalized) as M52JsonObject;
}

export function m52FreezePayload(payload: M52RecordPayload): M52RecordPayload {
  const normalized = normalizeJson(payload, new Set());
  if (
    Array.isArray(normalized) ||
    normalized === null ||
    typeof normalized !== "object"
  ) {
    throw new Error("M52_RECORD_PAYLOAD_MUST_BE_JSON_OBJECT");
  }
  return normalized as M52RecordPayload;
}

export function m52Hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function m52PayloadFingerprint(input: {
  recordId: string;
  workflow: string;
  payload: M52RecordPayload;
  lineage?: Readonly<M52SyncLineage>;
}): string {
  return m52Hash(
    JSON.stringify({
      recordId: input.recordId,
      workflow: input.workflow,
      payload: m52FreezePayload(input.payload),
      lineage: input.lineage ?? null,
    }),
  );
}

export function m52RequestFingerprint(input: {
  recordId: string;
  workflow: string;
  payload: M52RecordPayload;
  expectedDestinationVersion: number;
  deviceUpdatedAt: string;
  deviceClockOffsetMs: number;
  lineage: Readonly<M52SyncLineage>;
}): string {
  return m52Hash(
    JSON.stringify({
      recordId: input.recordId,
      workflow: input.workflow,
      payload: m52FreezePayload(input.payload),
      expectedDestinationVersion: input.expectedDestinationVersion,
      deviceUpdatedAt: input.deviceUpdatedAt,
      deviceClockOffsetMs: input.deviceClockOffsetMs,
      lineage: input.lineage,
    }),
  );
}

export function m52RecordFingerprint(record: M52SyncRecord): string {
  return m52Hash(
    JSON.stringify({
      recordId: record.recordId,
      workflow: record.workflow,
      payload: m52FreezePayload(record.payload),
      version: record.version,
      updatedAt: record.updatedAt,
      synthetic: record.synthetic,
    }),
  );
}
