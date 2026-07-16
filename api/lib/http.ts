interface RequestConfig extends Omit<RequestInit, "body"> {
  baseUrl?: string;
  params?: Record<string, string | number>;
  timeout?: number;
  body?: unknown;
}

export type HttpFailureKind =
  | "unauthorized"
  | "forbidden"
  | "client"
  | "server"
  | "timeout"
  | "offline"
  | "malformed-response"
  | "aborted"
  | "network";

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly kind: HttpFailureKind,
    public readonly status?: number,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = "HttpClientError";
  }
}

function statusKind(status: number): HttpFailureKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status >= 500) return "server";
  return "client";
}

async function parseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    throw new HttpClientError(
      "Service returned a non-JSON response",
      "malformed-response",
      response.status,
      response.headers.get("x-correlation-id") ?? response.headers.get("x-request-id") ?? undefined,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new HttpClientError(
      "Service returned malformed JSON",
      "malformed-response",
      response.status,
      response.headers.get("x-correlation-id") ?? response.headers.get("x-request-id") ?? undefined,
    );
  }
}

export class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string, opts?: { headers?: Record<string, string> }) {
    this.baseUrl = baseURL;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...opts?.headers,
    };
  }

  async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const {
      method = "GET",
      params,
      body,
      headers,
      timeout = 30000,
      ...rest
    } = config;

    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) =>
        url.searchParams.append(key, value.toString()),
      );
    }

    const controller = new AbortController();
    let timedOut = false;
    const onCallerAbort = () => controller.abort(config.signal?.reason);
    config.signal?.addEventListener("abort", onCallerAbort, { once: true });
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(url.toString(), {
        ...rest,
        method,
        headers: { ...this.defaultHeaders, ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const correlationId =
          response.headers.get("x-correlation-id") ??
          response.headers.get("x-request-id") ??
          undefined;
        let message = `HTTP Error: ${response.status}`;
        try {
          const errorData = (await parseJson(response)) as Record<string, unknown>;
          if (typeof errorData.message === "string") message = errorData.message;
          if (typeof errorData.error === "string") message = errorData.error;
        } catch {
          // Preserve the HTTP authorization/client/server classification even
          // when an upstream proxy returned a malformed error document.
        }
        throw new HttpClientError(message, statusKind(response.status), response.status, correlationId);
      }

      if (response.status === 204) return undefined as T;
      return (await parseJson(response)) as T;
    } catch (error: unknown) {
      if (error instanceof HttpClientError) throw error;
      if (timedOut) {
        throw new HttpClientError("Request timeout", "timeout");
      }
      if (config.signal?.aborted) {
        throw new HttpClientError("Request aborted", "aborted");
      }
      if (globalThis.navigator?.onLine === false) {
        throw new HttpClientError("Device is offline", "offline");
      }
      throw new HttpClientError(
        error instanceof Error ? error.message : "Network request failed",
        "network",
      );
    } finally {
      clearTimeout(timeoutId);
      config.signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  get<T>(
    url: string,
    params?: RequestConfig["params"],
    config?: RequestConfig,
  ) {
    return this.request<T>(url, { ...config, method: "GET", params });
  }

  post<T>(url: string, body?: unknown, config?: RequestConfig) {
    return this.request<T>(url, { ...config, method: "POST", body });
  }
}
