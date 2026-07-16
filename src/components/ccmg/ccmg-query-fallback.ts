import {
  mayUseEvaluationData,
  runtimeConfig,
  type EvaluationFallbackKind,
} from "@/config/runtime";

type UnknownRecord = Record<string, unknown>;

const AUTHORITATIVE_CLIENT_CODES = new Set([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_SUPPORTED",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "UNPROCESSABLE_CONTENT",
  "TOO_MANY_REQUESTS",
]);

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function errorMetadata(error: unknown): UnknownRecord[] {
  const outer = record(error);
  const data = record(outer?.data);
  const shape = record(outer?.shape);
  const shapeData = record(shape?.data);
  const cause = record(outer?.cause);
  return [outer, data, shape, shapeData, cause].filter(
    (entry): entry is UnknownRecord => entry !== null,
  );
}

/**
 * Mirrors the resilient transport policy at the page boundary. This is only a
 * last-resort evaluation fixture gate; authoritative 4xx responses, including
 * authentication and authorization denials, are never replaced.
 */
export function mayUseCcmgFixtureForError(
  error: unknown,
  procedure: string,
  kind: EvaluationFallbackKind = "api-error",
  evaluationMode = runtimeConfig.evaluationMode,
): boolean {
  if (
    !evaluationMode ||
    !mayUseEvaluationData(procedure, kind, evaluationMode)
  ) {
    return false;
  }

  const metadata = errorMetadata(error);
  const httpStatus = metadata
    .map((entry) => entry.httpStatus ?? entry.status)
    .find((value): value is number => typeof value === "number");
  if (httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500) {
    return false;
  }

  const code = metadata
    .map((entry) => entry.code)
    .find((value): value is string => typeof value === "string");
  return code === undefined || !AUTHORITATIVE_CLIENT_CODES.has(code);
}

export function isBuiltCcmgFixture(value: unknown): boolean {
  const source = record(value);
  const label = source?.evidenceLabel;
  return (
    source?.evidenceClass === "synthetic_demo" &&
    typeof label === "string" &&
    label.toLowerCase().includes("fictional synthetic")
  );
}

export const CCMG_FIXTURE_FALLBACK_NOTICE =
  "The eligible evaluation connector was unavailable, so this page is showing a fictional synthetic fixture. No production evidence or authorization decision was replaced.";
