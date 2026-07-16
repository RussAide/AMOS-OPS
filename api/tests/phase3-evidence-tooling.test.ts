import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PHASE3_CRITERIA,
  PHASE3_DEMO_CONTROL_ROLES,
  PHASE3_DX1_APPLICABLE_CONTROLS,
  type Phase3Criterion,
  type Phase3IntegratedResult,
  type Phase3Milestone,
  type Phase3ModuleResult,
} from "@contracts/phase3/shared";
import { exportPhase3Evidence } from "../../scripts/phase3-export-evidence";
import { verifyPhase3Evidence } from "../../scripts/phase3-verify-evidence";
import {
  PHASE3_MILESTONE_EVIDENCE,
  parsePhase3EvidenceOptions,
} from "../../scripts/phase3-evidence-common";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function createRoot(): { root: string; output: string } {
  const container = fs.mkdtempSync(
    path.join(os.tmpdir(), "amos-phase3-evidence-test-"),
  );
  temporaryRoots.push(container);
  const root = path.join(container, "Phase_3_Integrated_Sprint");
  fs.mkdirSync(path.join(root, "controls"), { recursive: true });
  fs.mkdirSync(path.join(root, "evidence", "shared"), { recursive: true });
  fs.mkdirSync(
    path.join(
      container,
      "M1.3_MGMA_Baseline_Established",
      "evidence",
      "01_Domain_Mapping_and_KPI_Dictionary",
    ),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(root, "controls", "PHASE_3_METRIC_DEFINITION_RECONCILIATION.md"),
    "# Synthetic metric reconciliation\n",
  );
  fs.writeFileSync(
    path.join(root, "controls", "PHASE_3_DEMO_PARITY_DEVIATION_REGISTER.md"),
    "# Synthetic parity and deviation register\n",
  );
  fs.writeFileSync(
    path.join(
      container,
      "M1.3_MGMA_Baseline_Established",
      "evidence",
      "01_Domain_Mapping_and_KPI_Dictionary",
      "M1_3_KPI_DATA_DICTIONARY.csv",
    ),
    "metric,formula\nclean_claim_rate,synthetic\n",
  );
  const matrix = [
    "criterion_id,milestone,requirement,status,evidence_path,owner",
    ...PHASE3_CRITERIA.map(
      (criterion) =>
        `${criterion},${criterion.slice(0, 4)},Synthetic test criterion,Complete,evidence/test,Test`,
    ),
    "DX.1-P3,DX.1,Synthetic boundary,Complete,evidence/shared/PHASE_3_DX1_RESULT.json,Integration",
  ].join("\n");
  fs.writeFileSync(
    path.join(root, "controls", "PHASE_3_ACCEPTANCE_MATRIX.csv"),
    `${matrix}\n`,
  );
  return { root, output: path.join(root, "evidence", "shared") };
}

function moduleResult(milestone: Phase3Milestone): Phase3ModuleResult {
  const domain = {
    "M3.1": "COMPLIANCE",
    "M3.2": "REVENUE",
    "M3.3": "WORKFORCE",
    "M3.4": "GAD",
  } as const;
  const criteria = PHASE3_CRITERIA.filter((criterion) =>
    criterion.startsWith(`${milestone}-`),
  ).map((criterionId) => ({
    criterionId,
    passed: true,
    summary: `${criterionId} controlled synthetic assertion passed.`,
    evidence: { evidenceClass: "synthetic_demo", assertion: criterionId },
  }));
  return {
    milestone,
    domain: domain[milestone],
    evidenceClass: "synthetic_demo",
    passed: true,
    criteria,
    snapshot: { evidenceClass: "synthetic_demo", milestone },
    auditEvents: [],
  };
}

function integratedResult(): Phase3IntegratedResult {
  const criteria = Object.fromEntries(
    PHASE3_CRITERIA.map((criterion) => [criterion, true]),
  ) as Record<Phase3Criterion, boolean>;
  return {
    milestone: "PHASE3_EXIT",
    evidenceClass: "synthetic_demo",
    supportCaseId: "SYNTH-P3-SUPPORT-EVIDENCE",
    sourceEpisodeId: "SYNTH-P2-EPISODE-EVIDENCE",
    criteria,
    failedCriteria: [],
    supportLinks: [],
    workItems: [],
    moduleResults: {
      "M3.1": moduleResult("M3.1"),
      "M3.2": moduleResult("M3.2"),
      "M3.3": moduleResult("M3.3"),
      "M3.4": moduleResult("M3.4"),
    },
    auditEvents: [],
    productionActionsBlocked: [
      "production_claim_blocked",
      "production_disclosure_blocked",
      "production_care_action_blocked",
      "live_notification_blocked",
      "live_tenant_change_blocked",
      "live_record_creation_blocked",
      "live_workforce_mutation_blocked",
      "live_vendor_dispatch_blocked",
      "live_external_system_transaction_blocked",
      "live_microsoft_tenant_mutation_blocked",
    ],
    dx1: {
      controlId: "DX.1-P3",
      evidenceClass: "synthetic_demo",
      passed: true,
      environmentId: "AMOS-OPS-PHASE3-EVALUATION",
      environmentLabel: "DEMO - NOT FOR CARE DELIVERY",
      applicableControls: PHASE3_DX1_APPLICABLE_CONTROLS.map((id) => ({
        id,
        passed: true,
        evidence: [`synthetic-evidence/${id}`],
      })),
      deferredControls: [
        {
          item: "Clinical algorithms",
          disposition: "deferred_by_sequence",
          rationale: "Future controlling sequence.",
        },
        {
          item: "SharePoint simulations",
          disposition: "deferred_by_sequence",
          rationale: "Future controlling sequence.",
        },
      ],
      featureScenarios: PHASE3_CRITERIA.map((criterionId) => ({
        scenarioId: `SYNTH-DX1-${criterionId}-SCENARIO`,
        milestone: criterionId.slice(0, 4) as Phase3Milestone,
        criterionId,
        summary: `${criterionId} synthetic feature scenario.`,
        expectedResult: "pass",
        actualResult: "pass",
        evidenceIds: [`SYNTH-EVIDENCE-${criterionId}`],
      })),
      authorizedControlRoles: [...PHASE3_DEMO_CONTROL_ROLES],
      deniedRepresentativeRole: "rcs-day",
      dataProvenance: [
        "Fictional records only.",
        "Accepted synthetic lineage only.",
        "No tenant data.",
      ],
      parityDeviationRegister: [
        {
          item: "Lineage",
          disposition: "parity",
          rationale: "Accepted identifiers.",
        },
        {
          item: "Persistence",
          disposition: "controlled_deviation",
          rationale: "Isolated SQLite.",
        },
        {
          item: "Clinical algorithms",
          disposition: "deferred_by_sequence",
          rationale: "Future controlling sequence.",
        },
        {
          item: "SharePoint simulations",
          disposition: "deferred_by_sequence",
          rationale: "Future controlling sequence.",
        },
      ],
      runtimeControls: {
        productionWritesBlocked: true,
        microsoftMutationsBlocked: true,
        separateAuditEvidence: true,
        deterministicResetTested: true,
        killSwitchTested: true,
        dataExpirationTested: true,
        accessReviewCurrent: true,
      },
    },
    exitGate: true,
    scenarioRun: {
      id: "SYNTH-PHASE3-INTEGRATED-EVIDENCE",
      milestone: "PHASE3_EXIT",
      scenarioType: "integrated_synthetic_acceptance",
      status: "passed",
      supportCaseId: "SYNTH-P3-SUPPORT-EVIDENCE",
      startedAt: "2026-07-14T18:00:00.000Z",
      completedAt: "2026-07-14T18:01:00.000Z",
      assertionsPassed: 60,
      assertionsFailed: 0,
      evidence: {
        evidenceClass: "synthetic_demo",
        deterministic: true,
        dx1Passed: true,
        dx1ControlId: "DX.1-P3",
      },
    },
  };
}

describe("Phase 3 evidence tooling", () => {
  it("exports four separately traceable milestones and verifies one 31-criterion scenario", async () => {
    const options = createRoot();
    const manifest = await exportPhase3Evidence(options, integratedResult());

    expect(manifest.criteriaPassed).toBe(31);
    expect(manifest.milestones.map((milestone) => milestone.id)).toEqual([
      "M3.1",
      "M3.2",
      "M3.3",
      "M3.4",
    ]);
    expect(manifest.nonredundancy).toMatchObject({
      canonicalSourceTrees: 1,
      integratedScenarioExecutions: 1,
      milestoneSourceCopies: 0,
    });
    expect(manifest.crossCuttingControl).toMatchObject({
      id: "DX.1-P3",
      status: "complete",
      applicableControlsPassed: 12,
      featureScenarios: 31,
      deferredBySequence: 2,
    });
    expect(manifest.controlReferences).toHaveLength(3);
    for (const definition of PHASE3_MILESTONE_EVIDENCE) {
      expect(
        fs
          .readdirSync(
            path.join(options.root, "evidence", definition.directory),
          )
          .sort(),
      ).toEqual([definition.resultFile, definition.summaryFile].sort());
    }
    expect(verifyPhase3Evidence(options)).toMatchObject({
      verified: true,
      criteriaPassed: 31,
      criteriaExpected: 31,
      exitGate: true,
      evidenceClass: "synthetic_demo",
    });
  });

  it("fails closed before export when the integrated exit gate is not passing", async () => {
    const options = createRoot();
    const result = integratedResult();
    const invalid = { ...result, exitGate: false };
    await expect(exportPhase3Evidence(options, invalid)).rejects.toThrow(
      "Phase 3 exit gate is not passing",
    );
    expect(fs.readdirSync(options.output)).toEqual([]);
  });

  it("rejects criterion tampering even when the manifest still reports 31 passed", async () => {
    const options = createRoot();
    await exportPhase3Evidence(options, integratedResult());
    const scenarioPath = path.join(
      options.output,
      "PHASE_3_INTEGRATED_SCENARIO_RESULT.json",
    );
    const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8")) as {
      criteria: Record<string, boolean>;
    };
    scenario.criteria["M3.2-05"] = false;
    fs.writeFileSync(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`);
    expect(() => verifyPhase3Evidence(options)).toThrow(
      "Every Phase 3 criterion must pass",
    );
  });

  it("rejects a failed or tampered DX.1-P3 result", async () => {
    const options = createRoot();
    await exportPhase3Evidence(options, integratedResult());
    const dx1Path = path.join(options.output, "PHASE_3_DX1_RESULT.json");
    const dx1 = JSON.parse(fs.readFileSync(dx1Path, "utf8")) as {
      applicableControls: Array<{ passed: boolean }>;
    };
    dx1.applicableControls[0].passed = false;
    fs.writeFileSync(dx1Path, `${JSON.stringify(dx1, null, 2)}\n`);
    expect(() => verifyPhase3Evidence(options)).toThrow(
      "DX.1-P3 result differs from the integrated scenario",
    );
  });

  it("rejects a changed controlling metric reference", async () => {
    const options = createRoot();
    await exportPhase3Evidence(options, integratedResult());
    fs.appendFileSync(
      path.join(
        options.root,
        "controls",
        "PHASE_3_METRIC_DEFINITION_RECONCILIATION.md",
      ),
      "tampered\n",
    );
    expect(() => verifyPhase3Evidence(options)).toThrow(
      "controlling metric, parity, or accepted M1.3 reference hash drifted",
    );
  });

  it("rejects redundant or unmanifested files in a milestone evidence folder", async () => {
    const options = createRoot();
    await exportPhase3Evidence(options, integratedResult());
    const redundant = path.join(
      options.root,
      "evidence",
      PHASE3_MILESTONE_EVIDENCE[0].directory,
      "duplicate-source.zip",
    );
    fs.writeFileSync(redundant, "not-a-source-snapshot");
    expect(() => verifyPhase3Evidence(options)).toThrow(
      "contains missing or unmanifested files",
    );
  });

  it("supports the Phase 2-style --root and --output CLI contract", () => {
    const options = parsePhase3EvidenceOptions([
      "--root",
      "./phase-root",
      "--output",
      "./phase-evidence/shared",
    ]);
    expect(options.root).toBe(path.resolve("./phase-root"));
    expect(options.output).toBe(path.resolve("./phase-evidence/shared"));
    expect(() => parsePhase3EvidenceOptions(["--unknown"])).toThrow(
      "Unknown option",
    );
  });
});
