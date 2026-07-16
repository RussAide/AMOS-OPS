import { createHash, timingSafeEqual } from "node:crypto";
import {
  M52_SYNTHETIC_BOUNDARY,
  type M52JsonValue,
} from "./types";

export function requireSyntheticId(value: string, label: string): void {
  if (!value.startsWith("SYNTH-") || value.length < 12) {
    throw new Error(`M52_${label.toUpperCase()}_MUST_BE_SYNTHETIC`);
  }
}

export function parseTimestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`M52_${label.toUpperCase()}_TIMESTAMP_INVALID`);
  }
  return parsed;
}

export function requireSyntheticBoundary(input: {
  readonly boundary: string;
  readonly synthetic: boolean;
}): void {
  if (input.boundary !== M52_SYNTHETIC_BOUNDARY || !input.synthetic) {
    throw new Error("M52_SYNTHETIC_BOUNDARY_REQUIRED");
  }
}

export function sha256(...parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    const encoded = Buffer.from(part, "utf8");
    hash.update(Buffer.from(String(encoded.length), "utf8"));
    hash.update(Buffer.from(":"));
    hash.update(encoded);
    hash.update(Buffer.from("|"));
  }
  return hash.digest("hex");
}

export function digestsEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function canonicalJson(value: M52JsonValue): string {
  return JSON.stringify(canonicalValue(value));
}

function canonicalValue(value: M52JsonValue): M52JsonValue {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("M52_CACHE_JSON_NUMBER_INVALID");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalValue(item));
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("M52_CACHE_JSON_OBJECT_INVALID");
  }
  const objectValue = value as { readonly [key: string]: M52JsonValue };
  return Object.fromEntries(
    Object.keys(objectValue)
      .sort()
      .map((key) => {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          throw new Error("M52_CACHE_JSON_KEY_PROHIBITED");
        }
        const item = objectValue[key];
        if (item === undefined) throw new Error("M52_CACHE_JSON_VALUE_INVALID");
        return [key, canonicalValue(item)];
      }),
  );
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) {
      if (item && typeof item === "object" && !ArrayBuffer.isView(item)) {
        deepFreeze(item);
      }
    }
  }
  return value;
}

export function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

export function addReason(
  reasonCodes: string[],
  condition: boolean,
  reasonCode: string,
): void {
  if (condition && !reasonCodes.includes(reasonCode)) reasonCodes.push(reasonCode);
}
