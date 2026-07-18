import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const authRouter = readFileSync(join(root, "api/routers/auth.ts"), "utf8");
const authHook = readFileSync(join(root, "src/hooks/use-auth.ts"), "utf8");
const trpcProvider = readFileSync(join(root, "src/providers/trpc.ts"), "utf8");
const apiRequest = readFileSync(
  join(root, "src/config/api-request.ts"),
  "utf8",
);
const documentUpload = readFileSync(
  join(root, "src/components/hr/document-upload.tsx"),
  "utf8",
);

describe("bearer token transport", () => {
  it("resolves me and logout only from the Authorization header", () => {
    const meAndLogout = authRouter.slice(
      authRouter.indexOf("  me:"),
      authRouter.indexOf("  requestPasswordReset:"),
    );
    expect(meAndLogout).toContain("bearerTokenFromRequest(ctx.req)");
    expect(meAndLogout).not.toMatch(/input.*token|input\?\.token/s);
  });

  it("does not put a session token into tRPC query or mutation input", () => {
    expect(authHook).toContain("trpc.auth.me.useQuery(undefined");
    expect(authHook).toContain("logoutMutation.mutate()");
    expect(authHook).not.toContain("token ? { token }");
    expect(authHook).not.toContain("logoutMutation.mutate({ token })");
  });

  it("sends every API session through the shared Bearer-header boundary", () => {
    expect(apiRequest).toContain("Authorization: `Bearer ${token}`");
    expect(trpcProvider).toContain("return identityRequestHeaders()");
    expect(documentUpload).toContain(
      'authenticatedApiFetch("/api/upload"',
    );
  });
});
