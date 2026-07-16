import { describe, expect, it } from "vitest";
import {
  DX1_PILOT_STAGE_IDS,
  DX1_SCENARIO_ID,
} from "../services/dx1/contracts";
import { DX1_PILOT_FIXTURE } from "../services/dx1/fixtures";
import { runDx1SecurityPilotStream } from "../services/dx1/pilot";

const result = runDx1SecurityPilotStream();

describe("DX.1-10 deterministic referral-to-executive pilot", () => {
  it("returns the shared security-pilot stream contract with both owned criteria complete", () => {
    expect(result).toMatchObject({
      streamId: "security-pilot",
      passed: true,
      assertionCount: 21,
      scenarioId: DX1_SCENARIO_ID,
      status: "completed",
      completedStageCount: 8,
      skippedStageCount: 0,
      orphanedArtifactCount: 0,
      inconsistentSummaryCount: 0,
      partialSideEffectCount: 0,
    });
    expect(result.criteria.map((criterion) => criterion.criterionId)).toEqual([
      "DX.1-08",
      "DX.1-10",
    ]);
    expect(result.criteria.every((criterion) => criterion.status === "Complete")).toBe(
      true,
    );
  });

  it("completes the exact eight stages in frozen order under one scenario", () => {
    expect(result.stages.map((stage) => stage.stageId)).toEqual(
      DX1_PILOT_STAGE_IDS,
    );
    expect(result.stages.map((stage) => stage.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(result.stages.every((stage) => stage.scenarioId === DX1_SCENARIO_ID)).toBe(
      true,
    );
    expect(result.stages.every((stage) => stage.evidenceGate === "passed")).toBe(
      true,
    );
  });

  it("retains the shared referral, youth, episode, authorization, service, and packet identity", () => {
    const [referral, intake, trr, authorization, service] = result.stages;
    expect(referral.artifact).toMatchObject({
      referralId: DX1_PILOT_FIXTURE.referralId,
      youthId: DX1_PILOT_FIXTURE.youthId,
    });
    expect(intake.artifact).toMatchObject({
      referralId: DX1_PILOT_FIXTURE.referralId,
      episodeId: DX1_PILOT_FIXTURE.episodeId,
    });
    expect(trr.artifact).toMatchObject({
      episodeId: DX1_PILOT_FIXTURE.episodeId,
      subjectId: DX1_PILOT_FIXTURE.youthId,
    });
    expect(authorization.artifact).toMatchObject({
      packetId: DX1_PILOT_FIXTURE.documentPacketId,
      authorizationId: DX1_PILOT_FIXTURE.authorizationId,
      episodeId: DX1_PILOT_FIXTURE.episodeId,
    });
    expect(service.artifact).toMatchObject({
      serviceEventId: DX1_PILOT_FIXTURE.serviceEventId,
      authorizationId: DX1_PILOT_FIXTURE.authorizationId,
      episodeId: DX1_PILOT_FIXTURE.episodeId,
    });
  });

  it("keeps CANS/TRR support bounded to evidence and qualified human review", () => {
    const support = result.stages[2].artifact;
    expect(support.authorityBoundary).toEqual({
      autonomousScoring: false,
      liveLevelOfCareActivation: false,
      treatmentDirection: false,
      qualifiedHumanReviewRequired: true,
    });
    expect(support.humanGateStatus).toBe("qualified_human_review_required");
    expect(support.clinicalAccessDecision).toBe("M41C_ACCESS_ALLOWED");
  });

  it("assembles an AMOS-governed authorization packet without a production repository", () => {
    const packet = result.stages[3].artifact;
    expect(packet.approvalState).toBe("approved_synthetic");
    expect(packet.version).toBe("1.0");
    expect(packet.productionRepositoryConnected).toBe(false);
    expect(packet.manifest).toContain(DX1_PILOT_FIXTURE.referralId);
    expect(result.stages[3].sourceModules).toContain("M4.2 AMOS-DMS governance");
  });

  it("records a versioned synthetic service note with authorization provenance", () => {
    const service = result.stages[4].artifact;
    expect(service.status).toBe("documented_synthetic_service");
    expect(Number(service.noteVersion)).toBeGreaterThan(0);
    expect(service.provenanceIds).toContain(DX1_PILOT_FIXTURE.documentPacketId);
    expect(service.liveServiceDelivered).toBe(false);
  });

  it("requires QA clearance before billing readiness", () => {
    const qa = result.stages[5];
    const billing = result.stages[6];
    expect(qa.artifact).toMatchObject({
      qaResult: "cleared",
      evidenceGate: "passed",
      remediationState: "not_required",
    });
    expect(billing.artifact).toMatchObject({
      qaReviewId: qa.artifactId,
      decision: "READY",
      status: "ready_for_revenue",
      amountNature: "synthetic_projection_only",
      liveClaimSubmitted: false,
    });
    expect(Number(billing.artifact.serviceUnits)).toBeGreaterThan(0);
  });

  it("reconciles the same scenario into the executive cross-domain summary", () => {
    const executive = result.stages[7];
    expect(executive.artifact).toMatchObject({
      scenarioId: DX1_SCENARIO_ID,
      stageCount: 8,
      sourceStageId: "billing-gate",
      operationalStatus: "pilot_completed",
      complianceRisk: "governed_synthetic_controls_passed",
      revenueStatus: "qa_cleared_ready_for_revenue",
      liveExecutiveDistribution: false,
    });
    expect(executive.sourceModules).toEqual([
      "M4.1A executive analytics",
      "M3.1 compliance and risk",
      "M3.2 revenue cycle",
      "M3.3 workforce",
    ]);
  });

  it("links every stage to immutable, unique audit and fingerprint evidence", () => {
    const auditIds = result.auditEvents.map((event) => event.eventId);
    expect(new Set(auditIds).size).toBe(auditIds.length);
    for (const stage of result.stages) {
      expect(stage.inputFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(stage.outputFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(stage.evidenceIds.length).toBeGreaterThan(0);
      expect(auditIds).toContain(stage.auditEventId);
      expect(Object.isFrozen(stage)).toBe(true);
    }
    expect(result.traceFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("is deterministic across a complete second run", () => {
    const replay = runDx1SecurityPilotStream();
    expect(replay.traceFingerprint).toBe(result.traceFingerprint);
    expect(replay.stages).toEqual(result.stages);
    expect(replay.criteria).toEqual(result.criteria);
  });

  it("retains the zero-live synthetic boundary", () => {
    expect(result.boundary).toEqual({
      synthetic: true,
      demoMode: true,
      productionRows: 0,
      liveExternalCalls: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      liveClinicalScoringActivations: 0,
      liveLevelOfCareDecisions: 0,
      realNotificationsSent: 0,
      deployments: 0,
      githubPushes: 0,
    });
  });
});
