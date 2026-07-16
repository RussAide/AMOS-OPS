export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toRecords(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function readString(
  record: UnknownRecord,
  key: string,
  fallback = ""
): string {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

export function readNullableString(
  record: UnknownRecord,
  key: string
): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

export function readNumber(
  record: UnknownRecord,
  key: string,
  fallback = 0
): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function readNullableNumber(
  record: UnknownRecord,
  key: string
): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readBoolean(
  record: UnknownRecord,
  key: string,
  fallback = false
): boolean {
  const value = record[key];
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  return fallback;
}
