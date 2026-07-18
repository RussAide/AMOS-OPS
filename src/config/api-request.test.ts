import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authenticatedApiFetch,
  identityRequestHeaders,
  type ApiFetcher,
} from "./api-request";
import { EVALUATION_SESSION_TOKEN, runtimeConfig } from "./runtime";

function storage(values: Record<string, string>): Pick<Storage, "getItem"> {
  return {
    getItem: (key: string) => values[key] ?? null,
  };
}

describe("direct API request boundary", () => {
  afterEach(() => {
    runtimeConfig.evaluationMode = false;
  });

  it("uses the same bearer identity and workspace headers as tRPC", () => {
    expect(
      identityRequestHeaders(
        storage({
          amos_token: "production-session",
          "amos-workspace": "training",
        }),
      ),
    ).toEqual({
      Authorization: "Bearer production-session",
      "X-AMOS-Workspace": "training",
    });
  });

  it("adds the synthetic role only for an authorized evaluation session", () => {
    runtimeConfig.evaluationMode = true;
    expect(
      identityRequestHeaders(
        storage({
          amos_token: EVALUATION_SESSION_TOKEN,
          "amos-role": "clinical-director",
        }),
      ),
    ).toEqual({
      Authorization: `Bearer ${EVALUATION_SESSION_TOKEN}`,
      "X-AMOS-Workspace": "operational",
      "X-AMOS-Evaluation-Role": "clinical-director",
    });
  });

  it("routes non-tRPC requests through the configured API resolver", async () => {
    const fetcher = vi.fn<ApiFetcher>(
      async () => new Response(null, { status: 204 }),
    );

    await authenticatedApiFetch(
      "/api/upload",
      {
        method: "POST",
        headers: { "X-Request-ID": "upload-test" },
      },
      {
        fetcher,
        storage: storage({ amos_token: "production-session" }),
      },
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [input, init] = fetcher.mock.calls[0];
    expect(input).toBe("/api/upload");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer production-session");
    expect(headers.get("X-AMOS-Workspace")).toBe("operational");
    expect(headers.get("X-Request-ID")).toBe("upload-test");
  });
});
