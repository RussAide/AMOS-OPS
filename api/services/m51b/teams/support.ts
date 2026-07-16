import { createHash } from "node:crypto";

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value as Readonly<T>;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return Object.freeze(value) as Readonly<T>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function teamsDigest(...parts: readonly unknown[]): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalize(parts)))
    .digest("hex")}`;
}

export function requireTeamsSyntheticId(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^SYNTH-[A-Z0-9][A-Z0-9._:-]*$/i.test(normalized)) {
    throw new Error(`M51B_TEAMS_${label.toUpperCase()}_SYNTHETIC_ID_REQUIRED`);
  }
  return normalized;
}

export function parseTeamsTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isoAt(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

export function immutableList<T>(values: readonly T[]): readonly T[] {
  return deepFreeze([...values]);
}

