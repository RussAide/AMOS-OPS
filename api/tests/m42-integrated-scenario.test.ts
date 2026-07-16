import { describe, expect, it } from "vitest";
import {
  M42_INTEGRATED_SCENARIO_ID,
  createM42ExperienceSnapshot,
  runM42IntegratedScenario,
} from "../services/m42/experience-service";

describe("M4.2 integrated document and knowledge experience", () => {
  it("publishes the complete synthetic experience inventory", () => {
    const snapshot = createM42ExperienceSnapshot();
    expect(snapshot).toMatchObject({
      milestone: "M4.2",
      status: "operational_synthetic_prototype",
      acceptanceTargets: {
        governedCriteria: 8,
        searchLatencyMsExclusive: 3000,
        nilTop1AccuracyMinimum: 0.9,
        reportBuilderMinimumTier: "T2",
        noCodeAdministration: true,
      },
      inventory: {
        taxonomyNodes: 7,
        retentionSchedules: 4,
        governedDocuments: 6,
        searchCorpusDocuments: 2400,
        searchEvaluationQueries: 24,
        nilArticles: 16,
        nilLabeledQueries: 30,
        reportSources: 1,
        configurationSchemas: 5,
      },
    });
    expect(snapshot.modules).toHaveLength(8);
    expect(snapshot.boundary).toMatchObject({
      syntheticOnly: true,
      realDataUsed: false,
      liveConnectorMutation: false,
      productionDisposition: false,
      githubPush: false,
    });
  });

  it("passes every controlling criterion in one integrated scenario", () => {
    const result = runM42IntegratedScenario(M42_INTEGRATED_SCENARIO_ID, 1);
    expect(result.accepted).toBe(true);
    expect(result.acceptanceFlags).toHaveLength(8);
    expect(result.acceptanceFlags.map(({ criterionId }) => criterionId)).toEqual([
      "M4.2-01",
      "M4.2-02",
      "M4.2-03",
      "M4.2-04",
      "M4.2-05",
      "M4.2-06",
      "M4.2-07",
      "M4.2-08",
    ]);
    expect(result.acceptanceFlags.every(({ passed }) => passed)).toBe(true);
    expect(result.totals).toMatchObject({
      criteriaPassed: 8,
      criteriaTotal: 8,
      realDataRecords: 0,
      liveExternalWrites: 0,
      productionDispositions: 0,
      deployments: 0,
      githubPushes: 0,
    });
  });

  it("integrates permission, lineage, rollback, and hard boundary evidence", () => {
    const result = runM42IntegratedScenario(M42_INTEGRATED_SCENARIO_ID, 1);
    expect(result.records.allowedAccess.allowed).toBe(true);
    expect(result.records.deniedPart2Access.allowed).toBe(false);
    expect(result.records.blockedDisclosure.allowed).toBe(false);
    expect(result.records.dispositionPreview).toMatchObject({
      legalHoldActive: true,
      dispositionExecuted: false,
      productionDispositionAvailable: false,
    });
    expect(result.records.versionLedgerValidationErrors).toEqual([]);
    expect(result.search.accepted).toBe(true);
    expect(result.nil).toMatchObject({ accepted: true, correctTop1Count: 28 });
    expect(result.reporting.execution).toMatchObject({
      permissionTrimmedBeforeSelection: true,
      concealedFieldIds: ["restricted_control_note"],
      realDataUsed: false,
      externalWritePerformed: false,
    });
    expect(result.reporting.exportManifest.liveRepositoryWrite).toBe(false);
    expect(result.administration.rollback).toMatchObject({
      rollbackCreatedNewVersion: true,
      liveConnectorMutation: false,
      version: { version: 3, changeType: "rollback" },
    });
  });

  it("rejects unregistered scenario identifiers", () => {
    expect(() => runM42IntegratedScenario("SYNTH-M42-UNKNOWN", 1)).toThrow(
      "M42_INTEGRATED_SCENARIO_NOT_REGISTERED",
    );
  });
});
