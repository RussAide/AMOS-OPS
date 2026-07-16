import { describe, expect, it } from "vitest";
import { M51A_HUB_CRITERION_IDS } from "@contracts/m51a/operations-hub";
import {
  createSyntheticM51aOperationsHubArchitecture,
  runM51aHubArchitectureScenario,
  validateM51aOperationsHubArchitecture,
} from "../services/m51a/operations-hub/architecture-scenario";

describe("M5.1A Hub A06 integrated architecture scenario", () => {
  it("builds one internally consistent synthetic Operations Hub architecture", () => {
    const architecture = createSyntheticM51aOperationsHubArchitecture();
    expect(validateM51aOperationsHubArchitecture(architecture)).toEqual([]);
    expect(architecture).toMatchObject({
      architectureId: "SYNTH-M51A-OPERATIONS-HUB-ARCHITECTURE-V1",
      governingSystem: "AMOS-DMS",
      sharePointIsGoverningSystem: false,
      liveSiteProvisioning: false,
      liveExternalWrites: 0,
      realDataUsed: false,
      synthetic: true,
    });
  });

  it("passes all six architecture criteria with forty-five explicit assertions", () => {
    const result = runM51aHubArchitectureScenario();
    expect(result.accepted).toBe(true);
    expect(result.criteria.map((criterion) => criterion.criterionId)).toEqual(
      M51A_HUB_CRITERION_IDS,
    );
    expect(result.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(
      result.criteria.reduce(
        (total, criterion) => total + criterion.assertionCount,
        0,
      ),
    ).toBe(45);
  });

  it("reports exact checklist totals with no production rows or live writes", () => {
    expect(runM51aHubArchitectureScenario().totals).toEqual({
      sites: 14,
      associatedOperationalSites: 6,
      restrictedOrSystemZones: 7,
      libraries: 10,
      contentTypes: 11,
      metadataFields: 18,
      handlingClasses: 6,
      intranetDestinations: 11,
      canonicalRolesEvaluated: 36,
      authoritativeGuidanceItems: 2,
      productionRows: 0,
      liveExternalWrites: 0,
    });
  });

  it("keeps all role projections permission-trimmed and free of physical URLs", () => {
    const result = runM51aHubArchitectureScenario();
    expect(result.roleProjections).toHaveLength(36);
    for (const projection of result.roleProjections) {
      expect(projection.permissionTrimmed).toBe(true);
      expect(projection.unknownRouteDisclosure).toBe(false);
      expect(
        projection.routes.every(
          (route) => !/^https?:\/\//i.test(route.targetKey),
        ),
      ).toBe(true);
    }
  });

  it("replays deterministically and detects a broken synthetic boundary", () => {
    expect(runM51aHubArchitectureScenario()).toEqual(
      runM51aHubArchitectureScenario(),
    );
    const architecture = createSyntheticM51aOperationsHubArchitecture();
    const corrupted = {
      ...architecture,
      liveExternalWrites: 1 as 0,
    };
    expect(validateM51aOperationsHubArchitecture(corrupted)).toContain(
      "OPERATIONS_HUB_SYNTHETIC_BOUNDARY_INVALID",
    );
  });
});
