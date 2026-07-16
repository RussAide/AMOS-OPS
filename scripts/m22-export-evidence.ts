import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { runM22RepresentativeScenario } from "../api/services/mhtcm/scenario";

const outputRoot = process.argv[2] ?? "../evidence/M2.2";
const manifestDirectory = join(outputRoot, "90_Manifest_and_QA");
const result = runM22RepresentativeScenario();

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

await mkdir(manifestDirectory, { recursive: true });

const files = new Map<string, string>([
  [
    "M2_2_SIX_FUNCTION_EXECUTION.json",
    json({
      criterion: "M2.2-01",
      passed: result.criteria["M2.2-01"],
      exactFunctionCount: 6,
      functions: result.snapshot.case.lifecycle.map((item, index) => ({
        sequence: index + 1,
        ...item,
      })),
    }),
  ],
  [
    "M2_2_PLAN_VERSION_LINEAGE.json",
    json({
      criterion: "M2.2-02",
      passed: result.criteria["M2.2-02"],
      sourceCansAssessmentId: result.snapshot.case.sourceCansAssessmentId,
      sourceCansVersion: result.snapshot.case.sourceCansVersion,
      sourceLineageId: result.snapshot.case.sourceLineageId,
      targetPlanId: result.snapshot.case.targetPlanId,
      targetPlanVersion: result.snapshot.case.targetPlanVersion,
      immutableVersions: result.snapshot.planVersions,
    }),
  ],
  [
    "M2_2_DISCHARGE_AFTERCARE_TIMING_RESULTS.json",
    json({
      criteria: {
        "M2.2-03": result.criteria["M2.2-03"],
        "M2.2-04": result.criteria["M2.2-04"],
      },
      dischargePlan: result.snapshot.dischargePlan,
      discharge: result.snapshot.discharge,
      aftercare: result.snapshot.aftercare,
      controls: { minimumDischargeLeadDays: 14, maximumAftercareDays: 30 },
    }),
  ],
  [
    "M2_2_T1017_BILLING_GATE_REPORT.json",
    json({
      criteria: {
        "M2.2-05": result.criteria["M2.2-05"],
        "M2.2-07": result.criteria["M2.2-07"],
      },
      billingDecision: result.billingDecision,
      claimHandoff: result.claimHandoff,
      currentEncounter: result.snapshot.encounters.find(
        (item) => item.id === result.claimHandoff.encounterId,
      ),
      failClosedNegativePaths: [
        "Unsigned current revision is NOT_READY and cannot create a claim handoff.",
        "Intake/screening remains in the taxonomy but is not separately billable as T1017.",
      ],
    }),
  ],
  [
    "M2_2_180_DAY_AUTHORIZATION_ALERT_RESULTS.json",
    json({
      criterion: "M2.2-06",
      passed: result.criteria["M2.2-06"],
      renewalIntervalDays: 180,
      alertWindowDays: 30,
      authorization: result.snapshot.authorization,
      alerts: result.snapshot.authorizationAlerts,
    }),
  ],
  ["SCN-M22-001_FULL_LIFECYCLE_RESULT.json", json(result)],
  [
    "M2_2_PERMISSION_AUDIT_EVIDENCE.json",
    json({
      permissionEvidence: result.permissionEvidence,
      auditEvents: result.snapshot.auditEvents,
    }),
  ],
  [
    "M2_2_ACCEPTANCE_REPORT.md",
    [
      "# M2.2 MHTCM Case Management — Acceptance Evidence",
      "",
      "**Evidence class:** Synthetic demonstration only  ",
      `**Scenario:** ${result.scenarioId}  `,
      `**Gate:** ${result.acceptanceGate ? "PASSED" : "FAILED"}`,
      "",
      "## Controlled result",
      "",
      `- Exact six-function lifecycle: ${result.snapshot.case.lifecycle.length}/6 complete`,
      `- Immutable service-plan versions: ${result.snapshot.planVersions.length}`,
      `- Discharge-planning lead: ${result.snapshot.dischargePlan?.leadDays ?? "missing"} days`,
      `- Aftercare due: ${result.snapshot.aftercare?.dueOn ?? "missing"}`,
      `- Authorization renewal due: ${result.snapshot.authorization?.renewalDueOn ?? "missing"}`,
      `- T1017 billing decision: ${result.billingDecision.result.decision}`,
      `- Claim handoff: ${result.claimHandoff.status}`,
      `- Audit events: ${result.snapshot.auditEvents.length}`,
      "",
      "## Acceptance criteria",
      "",
      ...Object.entries(result.criteria).map(
        ([criterion, passed]) => `- [${passed ? "x" : " "}] ${criterion}`,
      ),
      "",
    ].join("\n"),
  ],
]);

for (const [name, content] of files) {
  await writeFile(join(outputRoot, name), content, "utf8");
}

const manifest = {
  milestone: "M2.2",
  scenarioId: result.scenarioId,
  evidenceClass: result.dataMode,
  acceptanceGate: result.acceptanceGate,
  generatedFrom: "api/services/mhtcm/scenario.ts",
  files: [...files.entries()].map(([name, content]) => ({
    path: relative(outputRoot, join(outputRoot, name)),
    sha256: createHash("sha256").update(content).digest("hex"),
    bytes: Buffer.byteLength(content),
  })),
};
await writeFile(
  join(manifestDirectory, "m22-evidence-manifest.json"),
  json(manifest),
  "utf8",
);

console.log(`M2.2 evidence exported to ${outputRoot}`);
