import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  authorizeAccess,
  procedureAccessResource,
} from "../../src/constants/access-control";
import {
  PHASE3_DEMO_CONTROL_ROLES,
  mayControlPhase3Demo,
} from "@contracts/phase3/shared";

describe("Phase 3 control-plane integration", () => {
  it("mounts one authorized router and one active corporate-operations route", () => {
    const router = readFileSync(
      new URL("../router.ts", import.meta.url),
      "utf8",
    );
    const access = readFileSync(
      new URL("../../src/constants/access-control.ts", import.meta.url),
      "utf8",
    );
    const shell = readFileSync(
      new URL("../../src/components/shell/app-shell.tsx", import.meta.url),
      "utf8",
    );
    const navigation = readFileSync(
      new URL("../../src/data/navData.ts", import.meta.url),
      "utf8",
    );
    expect(router).toContain("phase3: phase3Router");
    expect(access).toContain('phase3: { domain: "workflow" }');
    expect(access).toContain(
      '["/corporate-operations", { domain: "dashboard" }]',
    );
    expect(shell).toContain('path="/corporate-operations"');
    expect(shell).toContain("<Phase3CorporateOperationsPage />");
    expect(navigation).toContain('label: "Corporate Operations"');
  });

  it("exposes run, reset, linked support, strict metrics, and visible demo boundaries", () => {
    const page = readFileSync(
      new URL(
        "../../src/pages/phase3/phase3-corporate-operations-page.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const router = readFileSync(
      new URL("../routers/phase3.ts", import.meta.url),
      "utf8",
    );
    const fallback = readFileSync(
      new URL("../../src/providers/trpc.ts", import.meta.url),
      "utf8",
    );
    for (const phrase of [
      "Run integrated demo",
      "Reset",
      "Cross-enterprise support chain",
      "Days in AR",
      "Clean claim rate",
      "Credentialing cycle",
      "Annual training",
      "Facility uptime",
      "Production writes blocked",
      "DEMO - NOT FOR CARE DELIVERY",
      "Feature and component evaluator",
      "RESET_PHASE3_SYNTHETIC_DATA",
    ]) {
      expect(page).toContain(phrase);
    }
    expect(router).toContain("runPhase3IntegratedScenario");
    expect(router).toContain("evaluatePhase3Component");
    expect(router).toContain("assertPhase3DemoControlActive");
    expect(router).toContain("assertPhase3DemoResetAllowed");
    expect(router).toContain("setPhase3KillSwitch");
    expect(router).toContain("recordPhase3AccessReview");
    expect(router).toContain("resetPhase3ControlScenario");
    expect(fallback).toContain('procedure === "phase3.overview"');
    expect(fallback).toContain("PHASE3_CONTROLLED_MUTATIONS");
    expect(fallback).toContain("mayUseAmosEvaluationFallback");
    expect(fallback).not.toContain('procedure === "phase3.runDemo"');
    expect(fallback).not.toContain('procedure === "phase3.resetDemo"');
  });

  it("uses layered central and Phase 3 persona authorization", () => {
    const resource = procedureAccessResource("phase3.runDemo", "mutation");
    expect(resource).toMatchObject({ domain: "workflow", action: "update" });
    if (!resource) throw new Error("expected Phase 3 access resource");
    for (const role of PHASE3_DEMO_CONTROL_ROLES) {
      expect(
        authorizeAccess({ userId: `SYNTH-${role}`, role }, resource).allowed,
      ).toBe(true);
      expect(mayControlPhase3Demo(role)).toBe(true);
    }
    expect(mayControlPhase3Demo("rcs-day")).toBe(false);
  });

  it("mounts the persistent global evaluation label", () => {
    const shell = readFileSync(
      new URL("../../src/components/shell/app-shell.tsx", import.meta.url),
      "utf8",
    );
    const login = readFileSync(
      new URL("../../src/pages/login-page.tsx", import.meta.url),
      "utf8",
    );
    const workspaceBanner = readFileSync(
      new URL(
        "../../src/components/shell/workspace-environment-banner.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(shell).toContain("WorkspaceEnvironmentBanner");
    for (const source of [workspaceBanner, login]) {
      expect(source).toContain("DEMO - NOT FOR CARE DELIVERY");
      expect(source).toContain("AMOS-OPS-PHASE3-EVALUATION");
    }
  });

  it("provides a visible, demo-only authorized evaluator entry path", () => {
    const authRouter = readFileSync(
      new URL("../routers/auth.ts", import.meta.url),
      "utf8",
    );
    const login = readFileSync(
      new URL("../../src/pages/login-page.tsx", import.meta.url),
      "utf8",
    );
    const authHook = readFileSync(
      new URL("../../src/hooks/use-auth.ts", import.meta.url),
      "utf8",
    );
    expect(authRouter).toContain("evaluationSession:");
    expect(authRouter).toContain("!env.isDemo || !env.evaluationMode");
    expect(authRouter).toContain('token: "amos-evaluation-session"');
    expect(authRouter).toContain('.default("administrator")');
    expect(login).toContain("Enter synthetic evaluation workspace");
    expect(login).toContain("No credentials or real records are required");
    expect(authHook).toContain("trpc.auth.evaluationSession.useMutation()");
  });
});
