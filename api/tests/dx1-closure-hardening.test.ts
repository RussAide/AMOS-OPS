import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../router";
import { buildDx1Presentation } from "../routers/dx1";
import { DX1_SCENARIO_ID } from "../services/dx1";

vi.mock("../security/identity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../security/identity")>();
  return {
    ...actual,
    resolveIdentityUser(request: Request) {
      const role = request.headers.get("x-amos-evaluation-role");
      if (!role) return null;
      return {
        id: `SYNTH-CALLER-${role.toUpperCase()}`,
        email: `${role}@dx1.invalid`,
        firstName: "Synthetic",
        lastName: "Caller",
        name: "Synthetic Caller",
        role,
        department: null,
        mfaEnabled: false,
        accessStatus: "cleared",
        identityType: "workforce",
        trainingAccess: false,
        sponsorName: null,
        accessExpiresAt: null,
        dataScope: "operational",
      };
    },
  };
});

interface Dx1SourceInventoryModule {
  compareDx1InheritedFiles(
    parentSource: string,
    derivedSource: string,
    files: readonly string[],
    approvedChanges?: ReadonlySet<string>,
  ): Readonly<{
    approvedIntegrationChanges: readonly string[];
    changed: readonly string[];
    missing: readonly string[];
  }>;
  collectDx1SourceFiles(root: string): readonly string[];
  excludedFromDx1Source(relativePath: string): boolean;
  verifyDx1DatabaseSourceCoverage(files: readonly string[]): Readonly<{
    databaseFiles: readonly string[];
    databaseSourceFileCount: number;
    databaseMigrationFileCount: number;
  }>;
}

describe("DX.1 independent-review hardening", () => {
  function caller(role: string) {
    return appRouter.createCaller({
      req: new Request("http://localhost/trpc", {
        headers: {
          authorization: "Bearer amos-evaluation-session",
          "x-amos-evaluation-role": role,
        },
      }),
      resHeaders: new Headers(),
    });
  }

  it("returns only a minimum-necessary role projection to a non-reviewer", () => {
    const presentation = buildDx1Presentation({
      actorId: "SYNTH-DX1-VIEWER-THERAPIST",
      role: "therapist",
    });
    expect(presentation.dataProjection).toBe("minimum-necessary");
    if (presentation.dataProjection !== "minimum-necessary")
      throw new Error("Expected minimum-necessary DX.1 projection");

    expect("auditEvents" in presentation).toBe(false);
    expect(Object.keys(presentation.streams)).toEqual(["experience"]);
    expect(presentation.streams.experience.auditEvents).toEqual([]);
    expect(presentation.streams.experience.criteria).toSatisfy(
      (criteria: typeof presentation.streams.experience.criteria) =>
        criteria.every((criterion) => criterion.evidenceIds.length === 0),
    );
    expect(presentation.criteria).toSatisfy(
      (criteria: typeof presentation.criteria) =>
        criteria.every((criterion) => criterion.evidenceIds.length === 0),
    );
    expect(presentation.streams.experience.personaAssignments).toSatisfy(
      (
        assignments: typeof presentation.streams.experience.personaAssignments,
      ) =>
        assignments.every(
          (assignment) =>
            assignment.canonicalRole === "therapist" &&
            assignment.actorId === "DX1-CURRENT-VIEWER",
        ),
    );
    expect(presentation.streams.experience.frontlineWalkthroughs).toSatisfy(
      (
        walkthroughs: typeof presentation.streams.experience.frontlineWalkthroughs,
      ) =>
        walkthroughs.every(
          (walkthrough) => walkthrough.canonicalRole === "therapist",
        ),
    );
    expect(presentation.streams.experience.workflows).toSatisfy(
      (workflows: typeof presentation.streams.experience.workflows) =>
        workflows.every(
          (workflow) =>
            workflow.ownerRole === "therapist" ||
            workflow.escalation.targetRole === "therapist",
        ),
    );
    expect("releaseGovernance" in presentation.streams.experience).toBe(false);
    expect(JSON.stringify(presentation)).not.toMatch(
      /SYNTH-DX1-ACTOR-(?:INTAKE|QA|REVENUE|EXEC)/,
    );
    expect(JSON.stringify(presentation)).not.toMatch(
      /(?:finance-revenue|executive-command|quality-compliance)/,
    );
    expect(presentation.viewer).toEqual({
      role: "therapist",
      serverDerivedIdentity: true,
      canRunIntegratedEvaluation: false,
    });
  });

  it("retains the complete integrated record only for an authorized reviewer", () => {
    const presentation = buildDx1Presentation({
      actorId: "SYNTH-DX1-VIEWER-MANAGING-DIRECTOR",
      role: "managing-director",
    });
    expect(presentation.dataProjection).toBe("integrated-review");
    if (presentation.dataProjection !== "integrated-review")
      throw new Error("Expected integrated-review DX.1 projection");
    expect(Object.keys(presentation.streams).sort()).toEqual([
      "experience",
      "intelligence",
      "pilot",
    ]);
    expect(presentation.auditEvents).toHaveLength(60);
    expect(presentation.streams.pilot.auditEvents.length).toBeGreaterThan(0);
    expect(
      presentation.criteria.every(
        (criterion) => criterion.evidenceIds.length > 0,
      ),
    ).toBe(true);
    expect(presentation.viewer.canRunIntegratedEvaluation).toBe(true);
  });

  it("enforces minimum necessary and reviewer-only execution through the actual tRPC caller", async () => {
    const frontline = caller("therapist");
    const frontlineSnapshot = await frontline.dx1.getExperienceSnapshot();
    expect(frontlineSnapshot.dataProjection).toBe("minimum-necessary");
    if (frontlineSnapshot.dataProjection !== "minimum-necessary")
      throw new Error("Expected caller-level minimum-necessary projection");
    expect(Object.keys(frontlineSnapshot.streams)).toEqual(["experience"]);
    expect("auditEvents" in frontlineSnapshot).toBe(false);
    await expect(
      frontline.dx1.runIntegratedScenario({ scenarioId: DX1_SCENARIO_ID }),
    ).rejects.toThrow(/Requires one of/);

    const reviewer = caller("managing-director");
    const reviewerStatus = await reviewer.dx1.getAcceptanceStatus();
    expect(reviewerStatus.dataProjection).toBe("integrated-review");
    if (reviewerStatus.dataProjection !== "integrated-review")
      throw new Error("Expected caller-level integrated-review projection");
    expect(reviewerStatus.auditEvents).toHaveLength(60);
    const rerun = await reviewer.dx1.runIntegratedScenario({
      scenarioId: DX1_SCENARIO_ID,
    });
    expect(rerun.dataProjection).toBe("integrated-review");
  });

  it("includes the complete canonical database source tree while excluding runtime databases", async () => {
    const modulePath = "../../scripts/dx1-source-inventory.mjs";
    const inventory = (await import(modulePath)) as Dx1SourceInventoryModule;
    const files = inventory.collectDx1SourceFiles(process.cwd());
    const coverage = inventory.verifyDx1DatabaseSourceCoverage(files);

    expect(coverage.databaseSourceFileCount).toBe(23);
    expect(coverage.databaseMigrationFileCount).toBe(13);
    expect(coverage.databaseFiles).toContain("db/schema.ts");
    expect(coverage.databaseFiles).toContain("db/current-schema.sql");
    expect(coverage.databaseFiles).toContain("db/relations.ts");
    expect(coverage.databaseFiles).toContain(
      "db/migrations/0010_m41c_clinical_intelligence_fabric.sql",
    );
    expect(coverage.databaseFiles).toContain(
      "db/migrations/meta/_journal.json",
    );
    expect(inventory.excludedFromDx1Source("db/runtime.sqlite")).toBe(true);
    expect(inventory.excludedFromDx1Source("db/runtime.db-wal")).toBe(true);
    expect(inventory.excludedFromDx1Source("db/schema.ts")).toBe(false);
    expect(
      files.some((relative) => relative.startsWith("dist-server/db/")),
    ).toBe(false);
  });

  it("fails database inheritance closed when an unapproved migration drifts", async () => {
    const modulePath = "../../scripts/dx1-source-inventory.mjs";
    const inventory = (await import(modulePath)) as Dx1SourceInventoryModule;
    const temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "dx1-db-drift-"),
    );
    try {
      const parent = path.join(temporaryRoot, "parent");
      const derived = path.join(temporaryRoot, "derived");
      const relative = "db/migrations/0010_example.sql";
      fs.mkdirSync(path.dirname(path.join(parent, relative)), {
        recursive: true,
      });
      fs.mkdirSync(path.dirname(path.join(derived, relative)), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(parent, relative),
        "CREATE TABLE accepted (id text);\n",
      );
      fs.writeFileSync(path.join(derived, relative), "DROP TABLE accepted;\n");

      expect(
        inventory.compareDx1InheritedFiles(parent, derived, [relative]),
      ).toEqual({
        approvedIntegrationChanges: [],
        changed: [relative],
        missing: [],
      });
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
