import { describe, expect, it } from "vitest";
import {
  blockedProductionSyntheticProcedures,
  trpcProceduresFromPath,
} from "../lib/production-data-boundary";

describe("RM.1 Production synthetic-only API boundary", () => {
  it("blocks every mounted synthetic-only namespace in Production", () => {
    for (const namespace of [
      "phase2",
      "m41c",
      "m42",
      "m51a",
      "m51b",
      "m52",
      "dx1",
      "regulatoryFramework",
    ]) {
      expect(
        blockedProductionSyntheticProcedures(
          `/api/trpc/${namespace}.representativeScenario`,
          true,
        ),
      ).toEqual([`${namespace}.representativeScenario`]);
    }
  });

  it("blocks a batch if it contains a synthetic-only Production procedure", () => {
    const path = "/api/trpc/auth.me%2Cphase2.overview%2Chr.listPeople?batch=1";
    expect(trpcProceduresFromPath(path)).toEqual([
      "auth.me",
      "phase2.overview",
      "hr.listPeople",
    ]);
    expect(blockedProductionSyntheticProcedures(path, true)).toEqual([
      "phase2.overview",
    ]);
  });

  it("does not block authoritative or internally guarded namespaces", () => {
    expect(
      blockedProductionSyntheticProcedures(
        "/api/trpc/auth.me,hr.listPeople,phase3.overview,m41a.featureCatalog",
        true,
      ),
    ).toEqual([]);
  });

  it("permits only the governed M4.1C read surface in Production", () => {
    const governedReadBatch =
      "/api/trpc/m41c.getExperienceSnapshot,m41c.getMyClinicalWorkplan?batch=1";
    expect(
      blockedProductionSyntheticProcedures(governedReadBatch, true),
    ).toEqual([]);

    expect(
      blockedProductionSyntheticProcedures(
        "/api/trpc/m41c.askClinicalGuidance,m41c.runSyntheticScenario?batch=1",
        true,
      ),
    ).toEqual([
      "m41c.askClinicalGuidance",
      "m41c.runSyntheticScenario",
    ]);
  });

  it("blocks a mixed M4.1C batch when it includes a prohibited action", () => {
    expect(
      blockedProductionSyntheticProcedures(
        "/api/trpc/m41c.getExperienceSnapshot,m41c.runSyntheticScenario?batch=1",
        true,
      ),
    ).toEqual(["m41c.runSyntheticScenario"]);
  });

  it("preserves all isolated Demo and Training evaluation routes", () => {
    expect(
      blockedProductionSyntheticProcedures(
        "/api/trpc/phase2.overview,m42.experience",
        false,
      ),
    ).toEqual([]);
  });
});
