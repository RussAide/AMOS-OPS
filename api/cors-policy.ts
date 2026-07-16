export interface CorsDecision {
  allowed: boolean;
  responseOrigin?: string;
  reason: "no-origin" | "same-origin" | "allowlist" | "denied";
}

function normalizedOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function exactConfiguredOrigin(value: string): string | null {
  const candidate = value.trim();
  const normalized = normalizedOrigin(candidate);
  return normalized === candidate ? normalized : null;
}

export function evaluateCorsOrigin(
  requestOrigin: string | undefined,
  requestUrl: string,
  allowedOrigins: readonly string[],
): CorsDecision {
  if (!requestOrigin) return { allowed: true, reason: "no-origin" };
  const origin = normalizedOrigin(requestOrigin);
  const serviceOrigin = normalizedOrigin(requestUrl);
  if (!origin) return { allowed: false, reason: "denied" };
  if (origin === serviceOrigin) {
    return { allowed: true, responseOrigin: origin, reason: "same-origin" };
  }
  const normalizedAllowlist = new Set(
    allowedOrigins
      .map(exactConfiguredOrigin)
      .filter((value): value is string => Boolean(value)),
  );
  if (normalizedAllowlist.has(origin)) {
    return { allowed: true, responseOrigin: origin, reason: "allowlist" };
  }
  return { allowed: false, reason: "denied" };
}
