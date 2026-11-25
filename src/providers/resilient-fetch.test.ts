import { describe, expect, it, vi } from "vitest";
import { createResilientFetch } from "./resilient-fetch";

const requestPath = "http://localhost/api/trpc/hr.list?batch=1";
const validResponse = () =>
  new Response(JSON.stringify([{ result: { data: { json: [{ id: "synthetic" }] } } }]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
const fallbackResponse = () =>
  new Response(JSON.stringify([{ result: { data: { json: "fictional-fallback" } } }]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("M1.1 resilient tRPC transport", () => {
  it("preserves a valid service response", async () => {
    const transport = createResilientFetch({
      fetcher: vi.fn(async () => validResponse()),
      mayFallback: () => false,
      buildFallback: fallbackResponse,
    });
    const response = await transport(requestPath);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { result: { data: { json: [{ id: "synthetic" }] } } },
    ]);
  });

  it("keeps valid unauthorized and server error envelopes authoritative", async () => {
    for (const status of [401, 403, 404, 500]) {
      const original = new Response(
        JSON.stringify([{ error: { json: { message: `status-${status}` } } }]),
        { status, headers: { "content-type": "application/json" } },
      );
      const transport = createResilientFetch({
        fetcher: vi.fn(async () => original),
        mayFallback: () => false,
        buildFallback: fallbackResponse,
      });
      const response = await transport(requestPath);
      expect(response.status).toBe(status);
    }
  });

  it("never replaces 401, 403, or 404 with demo data even when fallback is enabled", async () => {
    for (const status of [401, 403, 404]) {
      const transport = createResilientFetch({
        fetcher: vi.fn(async () =>
          new Response(
            JSON.stringify([
              {
                error: {
                  json: {
                    message: `authoritative-${status}`,
                    data: { httpStatus: status, code: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" },
                  },
                },
              },
            ]),
            { status, headers: { "content-type": "application/json" } },
          ),
        ),
        mayFallback: () => true,
        buildFallback: fallbackResponse,
      });
      const response = await transport(requestPath);
      expect(response.status).toBe(status);
      expect(JSON.stringify(await response.json())).toContain(`authoritative-${status}`);
    }
  });

  it("preserves a client-error tRPC envelope even when the batch HTTP status is 200", async () => {
    const transport = createResilientFetch({
      fetcher: vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              error: {
                json: {
                  message: "authoritative-forbidden",
                  data: { httpStatus: 403, code: "FORBIDDEN" },
                },
              },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
      mayFallback: () => true,
      buildFallback: fallbackResponse,
    });
    const response = await transport(requestPath);
    expect(JSON.stringify(await response.json())).toContain("authoritative-forbidden");
  });

  it("normalizes malformed and HTML responses into handled tRPC errors", async () => {
    for (const response of [
      new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
      new Response("<html>offline proxy</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
    ]) {
      const transport = createResilientFetch({
        fetcher: vi.fn(async () => response),
        mayFallback: () => false,
        buildFallback: fallbackResponse,
        createRequestId: () => "req-malformed",
      });
      const normalized = await transport(requestPath);
      expect(normalized.status).toBe(502);
      expect(normalized.headers.get("x-request-id")).toBe("req-malformed");
      expect(JSON.stringify(await normalized.json())).toContain("malformed-response");
    }
  });

  it("explains a non-tRPC 403 on login as pre-auth request rejection, not an invalid identity", async () => {
    const transport = createResilientFetch({
      fetcher: vi.fn(async () =>
        new Response(JSON.stringify({ error: "Origin is not allowed" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
      ),
      mayFallback: () => false,
      buildFallback: fallbackResponse,
    });
    const response = await transport("https://amos-ops-staging.up.railway.app/api/trpc/auth.login");
    expect(response.status).toBe(403);
    const content = JSON.stringify(await response.json());
    expect(content).toContain("Sign-in request blocked before account verification.");
    expect(content).not.toContain("current identity is not permitted");
  });

  it("preserves an authoritative tRPC login denial rather than replacing it with an origin diagnosis", async () => {
    const message = "This account is not available for the requested workspace.";
    const transport = createResilientFetch({
      fetcher: vi.fn(async () => new Response(
        JSON.stringify([{error: { json: {message, data: {httpStatus: 403, code: "FORBIDDEN"}}}}]),
        {status: 403, headers: {"content-type": "application/json"}},
      )),
      mayFallback: () => false,
      buildFallback: fallbackResponse,
    });
    const response = await transport("https://amos-ops-staging.up.railway.app/api/trpc/auth.login");
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).toContain(message);
  });

  it("normalizes malformed unauthorized responses without losing 401 semantics", async () => {
    const transport = createResilientFetch({
      fetcher: vi.fn(async () =>
        new Response("<html>sign-in proxy</html>", {
          status: 401,
          headers: { "content-type": "text/html" },
        }),
      ),
      mayFallback: () => false,
      buildFallback: fallbackResponse,
    });
    const response = await transport("http://localhost/api/trpc/auth.me?batch=1");
    expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).toContain("UNAUTHORIZED");
  });

  it("uses fictional fallback for null and API-error data only when allowed", async () => {
    for (const response of [
      new Response(JSON.stringify([{ result: { data: { json: null } } }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      new Response(JSON.stringify([{ error: { json: { message: "synthetic failure" } } }]), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    ]) {
      const transport = createResilientFetch({
        fetcher: vi.fn(async () => response),
        mayFallback: () => true,
        buildFallback: fallbackResponse,
      });
      expect(JSON.stringify(await (await transport(requestPath)).json())).toContain(
        "fictional-fallback",
      );
    }
  });

  it("handles offline state without issuing a request", async () => {
    const fetcher = vi.fn(async () => validResponse());
    const transport = createResilientFetch({
      fetcher,
      mayFallback: () => false,
      buildFallback: fallbackResponse,
      isOnline: () => false,
      createRequestId: () => "req-offline",
    });
    const response = await transport(requestPath);
    expect(fetcher).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).toContain("offline");
  });

  it("converts a timeout into a recoverable 504 response", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const transport = createResilientFetch({
      fetcher,
      timeoutMs: 5,
      mayFallback: () => false,
      buildFallback: fallbackResponse,
      createRequestId: () => "req-timeout",
    });
    const response = await transport(requestPath);
    expect(response.status).toBe(504);
    expect(JSON.stringify(await response.json())).toContain("timeout");
  });
});
