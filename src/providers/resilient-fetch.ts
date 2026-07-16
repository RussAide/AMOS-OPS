import type { EvaluationFallbackKind } from "@/config/runtime";

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ResilientFetchOptions {
  fetcher?: FetchImplementation;
  timeoutMs?: number;
  mayFallback: (path: string, kind: EvaluationFallbackKind) => boolean;
  buildFallback: (path: string) => Response;
  isOnline?: () => boolean;
  createRequestId?: () => string;
}

type TransportFailureKind = "timeout" | "offline" | "network" | "malformed-response";

const STATUS_BY_FAILURE: Record<TransportFailureKind, number> = {
  timeout: 504,
  offline: 503,
  network: 503,
  "malformed-response": 502,
};

function defaultRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `client-${Date.now().toString(36)}`;
}

function procedurePaths(requestPath: string): string[] {
  try {
    const url = new URL(requestPath, globalThis.location?.origin ?? "http://localhost");
    const marker = "/api/trpc/";
    const segments = url.pathname.split("/").filter(Boolean);
    const path = url.pathname.includes(marker)
      ? url.pathname.slice(url.pathname.indexOf(marker) + marker.length)
      : segments[segments.length - 1] ?? "unknown";
    return path.split(",").map((part) => part.trim()).filter(Boolean);
  } catch {
    return ["unknown"];
  }
}

function transportErrorResponse(
  requestPath: string,
  kind: TransportFailureKind,
  createRequestId: () => string,
  statusOverride?: number,
): Response {
  const status = statusOverride ?? STATUS_BY_FAILURE[kind];
  const requestId = createRequestId();
  const code =
    status === 401
      ? "UNAUTHORIZED"
      : status === 403
        ? "FORBIDDEN"
        : kind === "timeout"
          ? "TIMEOUT"
          : status >= 400 && status < 500
            ? "BAD_REQUEST"
            : "INTERNAL_SERVER_ERROR";
  const message =
    status === 401
      ? "Authentication is required or the session has expired."
      : status === 403
        ? "The current identity is not permitted to perform this action."
        : kind === "timeout"
      ? "The service did not respond in time. Please retry."
      : kind === "offline"
        ? "The device is offline. Reconnect and retry."
        : kind === "malformed-response"
          ? "The service returned an invalid response."
          : "The service is temporarily unavailable.";
  const body = procedurePaths(requestPath).map((path) => ({
    error: {
      json: {
        message,
        code: -32603,
        data: { code, httpStatus: status, path, requestId, transportKind: kind },
      },
    },
  }));
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
  });
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("application/json") || contentType.includes("+json");
}

function hasTrpcError(item: unknown): boolean {
  return typeof item === "object" && item !== null && "error" in item;
}

function isAuthoritativeClientError(item: unknown): boolean {
  if (typeof item !== "object" || item === null || !("error" in item)) return false;
  const error = item.error;
  if (typeof error !== "object" || error === null) return false;
  const envelope = "json" in error ? error.json : error;
  if (typeof envelope !== "object" || envelope === null || !("data" in envelope)) return false;
  const data = envelope.data;
  if (typeof data !== "object" || data === null) return false;
  const httpStatus = "httpStatus" in data ? data.httpStatus : undefined;
  if (typeof httpStatus === "number" && httpStatus >= 400 && httpStatus < 500) return true;
  const code = "code" in data ? data.code : undefined;
  return typeof code === "string" && [
    "BAD_REQUEST",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "METHOD_NOT_SUPPORTED",
    "TIMEOUT",
    "CONFLICT",
    "PRECONDITION_FAILED",
    "PAYLOAD_TOO_LARGE",
    "UNPROCESSABLE_CONTENT",
    "TOO_MANY_REQUESTS",
  ].includes(code);
}

function hasNullTrpcJson(item: unknown): boolean {
  if (typeof item !== "object" || item === null || !("result" in item)) return false;
  const result = item.result;
  if (typeof result !== "object" || result === null || !("data" in result)) return false;
  const data = result.data;
  return typeof data === "object" && data !== null && "json" in data && data.json === null;
}

async function inspectJsonResponse(
  response: Response,
): Promise<{ valid: boolean; hasError: boolean; hasClientError: boolean; allNull: boolean }> {
  if (!isJsonResponse(response)) {
    return { valid: false, hasError: false, hasClientError: false, allNull: false };
  }
  try {
    const text = await response.clone().text();
    if (!text.trim()) {
      return { valid: false, hasError: false, hasClientError: false, allNull: false };
    }
    const body: unknown = JSON.parse(text);
    if (!Array.isArray(body)) {
      return { valid: false, hasError: false, hasClientError: false, allNull: false };
    }
    return {
      valid: true,
      hasError: body.some(hasTrpcError),
      hasClientError: body.some(isAuthoritativeClientError),
      allNull: body.length > 0 && body.every(hasNullTrpcJson),
    };
  } catch {
    return { valid: false, hasError: false, hasClientError: false, allNull: false };
  }
}

export function createResilientFetch(options: ResilientFetchOptions): FetchImplementation {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? 15_000;
  const isOnline = options.isOnline ?? (() => globalThis.navigator?.onLine !== false);
  const createRequestId = options.createRequestId ?? defaultRequestId;

  return async (input, init) => {
    const requestPath = input.toString();
    if (!isOnline()) {
      return options.mayFallback(requestPath, "unavailable")
        ? options.buildFallback(requestPath)
        : transportErrorResponse(requestPath, "offline", createRequestId);
    }

    const controller = new AbortController();
    let timedOut = false;
    const onCallerAbort = () => controller.abort(init?.signal?.reason);
    init?.signal?.addEventListener("abort", onCallerAbort, { once: true });
    const timeoutId = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException("Request timed out", "TimeoutError"));
    }, timeoutMs);

    try {
      const response = await fetcher(input, {
        ...(init ?? {}),
        credentials: "include",
        signal: controller.signal,
      });
      const inspection = await inspectJsonResponse(response);

      if (!response.ok) {
        if (response.status >= 500 && options.mayFallback(requestPath, "api-error")) {
          return options.buildFallback(requestPath);
        }
        return inspection.valid
          ? response
          : transportErrorResponse(
              requestPath,
              "malformed-response",
              createRequestId,
              response.status,
            );
      }
      if (!inspection.valid) {
        return options.mayFallback(requestPath, "unavailable")
          ? options.buildFallback(requestPath)
          : transportErrorResponse(requestPath, "malformed-response", createRequestId);
      }
      if (
        inspection.hasError &&
        !inspection.hasClientError &&
        options.mayFallback(requestPath, "api-error")
      ) {
        return options.buildFallback(requestPath);
      }
      if (inspection.allNull && options.mayFallback(requestPath, "empty")) {
        return options.buildFallback(requestPath);
      }
      return response;
    } catch {
      const kind: TransportFailureKind = timedOut
        ? "timeout"
        : isOnline()
          ? "network"
          : "offline";
      return options.mayFallback(requestPath, "unavailable")
        ? options.buildFallback(requestPath)
        : transportErrorResponse(requestPath, kind, createRequestId);
    } finally {
      globalThis.clearTimeout(timeoutId);
      init?.signal?.removeEventListener("abort", onCallerAbort);
    }
  };
}
