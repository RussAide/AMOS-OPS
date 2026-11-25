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


export function isCorsExemptPublicAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/assets/") ||
    pathname === "/favicon.ico" ||
    pathname === "/release-manifest.json"
  );
}

/**
 * Privacy-preserving diagnostic classification for rejected CORS requests.
 * Log only the category, never the raw Origin, credentials or session values.
 * This is observability only; it does not add any trusted origins.
 */
export function classifyDeniedCorsOrigin(
  requestOrigin: string | undefined,
): "missing" | "opaque" | "invalid" | "staging-first-party" | "tinyfish-third-party" | "other-third-party" {
  if (!requestOrigin) return "missing";
  if (requestOrigin.trim() === "null") return "opaque";
  const origin = normalizedOrigin(requestOrigin);
  if (!origin) return "invalid";
  const host = new URL(origin).hostname.toLowerCase();
  if (host === "amos-ops-staging.up.railway.app") return "staging-first-party";
  if (host === "agent.tinyfish.ai" || host.endsWith(".tinyfish.ai")) {
    return "tinyfish-third-party";
  }
  return "other-third-party";
}
