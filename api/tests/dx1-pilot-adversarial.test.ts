import { describe, expect, it } from "vitest";
import { DX1_SCENARIO_ID } from "../services/dx1/contracts";
import { DX1_PILOT_FIXTURE } from "../services/dx1/fixtures";
import {
  DX1_PILOT_ACTORS,
  Dx1PilotCoordinator,
  evaluateDx1PilotAccess,
} from "../services/dx1/pilot";

describe("DX.1 pilot adversarial and atomic-gate behavior", () => {
  it("denies an out-of-order billing attempt with no business mutation", () => {
    const coordinator = new Dx1PilotCoordinator();
    const result = coordinator.attemptStage({
      stageId: "billing-gate",
      actor: DX1_PILOT_ACTORS.revenue,
    });
    expect(result).toMatchObject({
      accepted: false,
      code: "DX1_STAGE_SEQUENCE_DENIED",
      businessStageCountBefore: 0,
      businessStageCountAfter: 0,
      partialBusinessSideEffects: 0,
    });
    expect(result.businessFingerprintAfter).toBe(
      result.businessFingerprintBefore,
    );
    expect(coordinator.completedStages()).toEqual([]);
    expect(coordinator.allAuditEvents()).toHaveLength(1);
  });

  it("denies a wrong-role referral attempt without a partial intake", () => {
    const coordinator = new Dx1PilotCoordinator();
    const result = coordinator.attemptStage({
      stageId: "referral-received",
      actor: DX1_PILOT_ACTORS.executive,
    });
    expect(result.accepted).toBe(false);
    expect(result.code).toBe("DX1_STAGE_ACCESS_DENIED");
    expect(result.accessDecision?.code).toBe(
      "DX1_LEAST_PRIVILEGE_ROLE_DENIED",
    );
    expect(result.businessStageCountAfter).toBe(0);
    expect(result.businessFingerprintAfter).toBe(
      result.businessFingerprintBefore,
    );
  });

  it("holds missing QA evidence, preserves five stages, and then recovers", () => {
    const coordinator = new Dx1PilotCoordinator();
    const firstFive = [
      ["referral-received", DX1_PILOT_ACTORS.intake],
      ["intake-review", DX1_PILOT_ACTORS.intake],
      ["cans-trr-support", DX1_PILOT_ACTORS.clinician],
      ["authorization-setup", DX1_PILOT_ACTORS.revenue],
      ["service-delivery", DX1_PILOT_ACTORS.clinician],
    ] as const;
    firstFive.forEach(([stageId, actor]) =>
      expect(coordinator.attemptStage({ stageId, actor }).accepted).toBe(true),
    );
    const held = coordinator.attemptStage({
      stageId: "qa-documentation-review",
      actor: DX1_PILOT_ACTORS.qa,
      evidenceAvailable: false,
    });
    expect(held).toMatchObject({
      accepted: false,
      code: "DX1_STAGE_EVIDENCE_HELD",
      businessStageCountBefore: 5,
      businessStageCountAfter: 5,
      partialBusinessSideEffects: 0,
    });
    expect(held.businessFingerprintAfter).toBe(held.businessFingerprintBefore);
    expect(coordinator.completedStages()).toHaveLength(5);
    expect(
      coordinator
        .allAuditEvents()
        .some((event) => event.outcome === "held" && event.evidenceIds.includes("SYNTH-DX1-QA-REMEDIATION-ROUTE-001")),
    ).toBe(true);

    const recovered = coordinator.attemptStage({
      stageId: "qa-documentation-review",
      actor: DX1_PILOT_ACTORS.qa,
    });
    expect(recovered.accepted).toBe(true);
    expect(recovered.stage?.artifact.qaResult).toBe("cleared");
    expect(coordinator.completedStages()).toHaveLength(6);
  });

  it("will not allow billing to bypass the pending QA stage", () => {
    const coordinator = new Dx1PilotCoordinator();
    const firstFive = [
      ["referral-received", DX1_PILOT_ACTORS.intake],
      ["intake-review", DX1_PILOT_ACTORS.intake],
      ["cans-trr-support", DX1_PILOT_ACTORS.clinician],
      ["authorization-setup", DX1_PILOT_ACTORS.revenue],
      ["service-delivery", DX1_PILOT_ACTORS.clinician],
    ] as const;
    firstFive.forEach(([stageId, actor]) =>
      coordinator.attemptStage({ stageId, actor }),
    );
    const result = coordinator.attemptStage({
      stageId: "billing-gate",
      actor: DX1_PILOT_ACTORS.revenue,
    });
    expect(result.code).toBe("DX1_STAGE_SEQUENCE_DENIED");
    expect(result.businessStageCountAfter).toBe(5);
    expect(result.businessFingerprintAfter).toBe(
      result.businessFingerprintBefore,
    );
  });

  it.each([
    [
      "DX1_SYNTHETIC_ACTOR_REQUIRED",
      {
        actor: {
          ...DX1_PILOT_ACTORS.clinician,
          actorId: "REAL-ACTOR-NOT-ALLOWED",
        },
      },
    ],
    [
      "DX1_SYNTHETIC_SUBJECT_REQUIRED",
      { subjectId: "REAL-SUBJECT-NOT-ALLOWED" },
    ],
    [
      "DX1_MINIMUM_NECESSARY_DENIED",
      { requestedFields: ["support_context", "unbounded_phi_blob"] },
    ],
  ] as const)("denies %s before any workflow mutation", (code, override) => {
    const result = evaluateDx1PilotAccess({
      requestId: `SYNTH-DX1-ADVERSARIAL-${code}`,
      scenarioId: DX1_SCENARIO_ID,
      stageId: "cross-enterprise",
      actor: DX1_PILOT_ACTORS.clinician,
      domain: "phi-like-clinical",
      action: "view",
      recordId: DX1_PILOT_FIXTURE.episodeId,
      subjectId: DX1_PILOT_FIXTURE.youthId,
      requestedFields: ["support_context"],
      ...override,
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe(code);
    expect(result.auditEvent.outcome).toBe("denied");
  });
});
