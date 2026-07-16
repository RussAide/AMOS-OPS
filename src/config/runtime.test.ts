import { describe, expect, it } from "vitest";
import {
  fetchRuntimeConfig,
  isAuthenticationRequest,
  isAuthoritativeCcmgWriteRequest,
  mayUseEvaluationData,
} from "./runtime";

describe("runtime evaluation boundary", () => {
  it("loads and validates the server-issued demo contract", async () => {
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          schemaVersion: 2,
          mode: "demo",
          appEnvironment: "demo",
          environmentId: "amos-ops-demo",
          apiUrl: "/api/trpc",
          evaluationMode: true,
          productionReleaseAuthorized: false,
          productionReleaseId: null,
          deploymentPosture: "demo",
          reviewDeployment: false,
          candidateId: null,
          buildId: "test-build",
          banner: "DEMO — FICTIONAL DATA",
          safeguards: {
            syntheticDataOnly: true,
            evaluationFallbacksAllowed: true,
            productionDataAllowed: false,
            externalWritesAllowed: false,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    await expect(fetchRuntimeConfig(fetcher)).resolves.toMatchObject({
      mode: "demo",
      evaluationMode: true,
      safeguards: { syntheticDataOnly: true },
    });
  });

  it("fails closed when the runtime contract contradicts its mode", async () => {
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          schemaVersion: 2,
          mode: "production",
          appEnvironment: "production",
          environmentId: "amos-ops-production",
          apiUrl: "/api/trpc",
          evaluationMode: true,
          productionReleaseAuthorized: true,
          productionReleaseId: "RG1-GO-001",
          deploymentPosture: "live",
          reviewDeployment: false,
          candidateId: null,
          buildId: "test-build",
          banner: "PRODUCTION",
          safeguards: {
            syntheticDataOnly: false,
            evaluationFallbacksAllowed: false,
            productionDataAllowed: true,
            externalWritesAllowed: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    await expect(fetchRuntimeConfig(fetcher)).rejects.toThrow(
      /Production runtime configuration violates/,
    );
  });

  it("recognizes authentication procedures in tRPC URLs", () => {
    expect(
      isAuthenticationRequest(
        "https://example.test/api/trpc/auth.login?batch=1",
      ),
    ).toBe(true);
    expect(isAuthenticationRequest("/api/trpc/auth.me,hr.list?batch=1")).toBe(
      true,
    );
    expect(isAuthenticationRequest("/api/trpc/hr.list?batch=1")).toBe(false);
  });

  it("never supplies fictional data when evaluation mode is disabled", () => {
    expect(
      mayUseEvaluationData("/api/trpc/hr.list", "unavailable", false),
    ).toBe(false);
    expect(mayUseEvaluationData("/api/trpc/hr.list", "api-error", false)).toBe(
      false,
    );
  });

  it("keeps responding authentication errors authoritative in evaluation mode", () => {
    expect(
      mayUseEvaluationData("/api/trpc/auth.login?batch=1", "api-error", true),
    ).toBe(false);
    expect(
      mayUseEvaluationData("/api/trpc/auth.me?batch=1", "api-error", true),
    ).toBe(false);
    expect(
      mayUseEvaluationData("/api/trpc/auth.login?batch=1", "unavailable", true),
    ).toBe(true);
  });

  it("allows fictional application data only in evaluation mode", () => {
    expect(
      mayUseEvaluationData("/api/trpc/hr.list?batch=1", "api-error", true),
    ).toBe(true);
    expect(
      mayUseEvaluationData("/api/trpc/hr.list?batch=1", "empty", true),
    ).toBe(true);
  });

  it("fails closed for every controlled CCMG mutation", () => {
    const writes = [
      "transitionWorkflow",
      "assignWorkflow",
      "approveWorkflow",
      "handoffWorkflow",
      "escalateWorkflow",
      "setExceptionDisposition",
      "decideHandoff",
      "recordReferralGate",
      "finalizeCansVersion",
      "approveCansTargetRoute",
      "createMedicationOversightAlert",
    ];

    for (const procedure of writes) {
      const path = `/api/trpc/m21.${procedure}?batch=1`;
      expect(isAuthoritativeCcmgWriteRequest(path)).toBe(true);
      expect(mayUseEvaluationData(path, "unavailable", true)).toBe(false);
      expect(mayUseEvaluationData(path, "api-error", true)).toBe(false);
      expect(mayUseEvaluationData(path, "empty", true)).toBe(false);
    }
  });
});
