import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpClient, HttpClientError } from "../lib/http";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-correlation-id": "corr-123" },
  });
}

describe("M1.1 HTTP client failure boundaries", () => {
  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "client"],
    [500, "server"],
  ] as const)("classifies HTTP %i as %s", async (status, kind) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(status, { message: `failure-${status}` })));
    const client = new HttpClient("https://amos.invalid");
    const error = await client.get("/test").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpClientError);
    expect(error).toMatchObject({ kind, status, correlationId: "corr-123" });
  });

  it("rejects malformed success payloads without an untyped parser crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<html>not json</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    const client = new HttpClient("https://amos.invalid");
    await expect(client.get("/test")).rejects.toMatchObject({ kind: "malformed-response" });
  });

  it("preserves authorization classification for malformed proxy error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<html>sign-in proxy</html>", {
          status: 401,
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    const client = new HttpClient("https://amos.invalid");
    await expect(client.get("/test")).rejects.toMatchObject({
      kind: "unauthorized",
      status: 401,
    });
  });

  it("classifies timeouts and offline failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      ),
    );
    let client = new HttpClient("https://amos.invalid");
    await expect(client.get("/test", undefined, { timeout: 5 })).rejects.toMatchObject({
      kind: "timeout",
    });

    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    client = new HttpClient("https://amos.invalid");
    await expect(client.get("/test")).rejects.toMatchObject({ kind: "offline" });
  });

  it("returns undefined for a valid 204 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    const client = new HttpClient("https://amos.invalid");
    await expect(client.get("/test")).resolves.toBeUndefined();
  });
});
