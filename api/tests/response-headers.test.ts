import { describe, expect, it } from "vitest";
import { inheritResponseHeaders } from "../response-headers";

describe("tRPC response header inheritance", () => {
  it("preserves CORS and trace headers on an adapter error response", async () => {
    const response = new Response(
      JSON.stringify({ error: { message: "Invalid email or password." } }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          Vary: "trpc-accept, accept",
        },
      },
    );
    const inheritedHeaders = new Headers({
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": "https://amos-ops.com",
      "X-Request-ID": "request-123",
      Vary: "Origin",
    });

    const result = inheritResponseHeaders(response, inheritedHeaders);

    expect(result.status).toBe(401);
    expect(result.headers.get("content-type")).toContain("application/json");
    expect(result.headers.get("access-control-allow-origin")).toBe(
      "https://amos-ops.com",
    );
    expect(result.headers.get("access-control-allow-credentials")).toBe("true");
    expect(result.headers.get("x-request-id")).toBe("request-123");
    expect(result.headers.get("vary")?.split(/,\s*/)).toEqual([
      "trpc-accept",
      "accept",
      "Origin",
    ]);
    expect(await result.json()).toEqual({
      error: { message: "Invalid email or password." },
    });
  });

  it("deduplicates inherited Vary values case-insensitively", () => {
    const response = new Response(null, { headers: { Vary: "Origin" } });
    const inheritedHeaders = new Headers({ Vary: "origin, Accept-Encoding" });

    const result = inheritResponseHeaders(response, inheritedHeaders);

    expect(result.headers.get("vary")?.split(/,\s*/)).toEqual([
      "origin",
      "Accept-Encoding",
    ]);
  });
});
