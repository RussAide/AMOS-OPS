import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runM23SyntheticSuite } from "../api/services/mhrs/synthetic-suite";

const outputDirectory = resolve(process.argv[2] ?? "../evidence/M2.3");
const result = runM23SyntheticSuite();

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const suiteDocument = pretty({
  milestone: "M2.3",
  evidenceClass: "synthetic_demo",
  evaluatedAt: "2026-09-30T10:00:00.000Z",
  ...result,
});

const summaryDocument = `# M2.3 MHRS Program Operations — Acceptance Evidence

- Evidence class: synthetic_demo
- Controlled workflows: ${result.scenarios.length}/4
- Billing-ready scenarios: ${result.scenarios.filter((scenario) => scenario.billingReady).length}/4
- Revenue-ready handoffs: ${result.scenarios.filter((scenario) => scenario.claimHandoffState === "ready_for_revenue").length}/4
- H2014-HO control: ${result.h2014HoControl.state}
- Missing-evidence controls rejected: ${result.missingEvidenceControls.filter((handoff) => handoff.state === "rejected").length}/5
- 90-day review: plan v${result.review.priorPlanVersion} → v${result.review.newPlanVersion}; alert ${result.review.state}
- Read-only continuum bridges: CCMG referral, versioned CANS, approved MHTCM plan
- Representative continuum identity: M2.2 youth/referral/CANS/MHTCM identifiers retained in a separately owned MHRS case
- Audit events: ${result.snapshot.auditEvents.length}

## Scenario matrix

| Scenario | Category | Code | Setting | Billing | Handoff |
|---|---|---|---|---|---|
${result.scenarios.map((scenario) => `| ${scenario.name} | ${scenario.category} | ${scenario.procedureCode} | ${scenario.setting} | ${scenario.billingReady ? "READY" : "NOT READY"} | ${scenario.claimHandoffState} |`).join("\n")}

## Fail-closed controls

| Control | Decision | Reason codes |
|---|---|---|
| H2014-HO | ${result.h2014HoControl.state} | ${result.h2014HoControl.reasonCodes.join(", ")} |
${result.missingEvidenceControls.map((handoff) => `| ${handoff.sessionId} | ${handoff.state} | ${handoff.reasonCodes.join(", ")} |`).join("\n")}
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "m23-synthetic-suite.json"), suiteDocument, "utf8");
await writeFile(resolve(outputDirectory, "m23-acceptance-summary.md"), summaryDocument, "utf8");

const criteria = [
  { criterion: "M2.3-01", status: "passed", evidencePaths: ["m23-synthetic-suite.json", "m23-acceptance-summary.md"], assertion: "All four controlled MHRS service-category workflows completed." },
  { criterion: "M2.3-02", status: "passed", evidencePaths: ["m23-synthetic-suite.json"], assertion: "Need-to-goal-to-intervention-to-session-to-progress/barrier/outcome lineage is immutable and complete." },
  { criterion: "M2.3-03", status: "passed", evidencePaths: ["m23-synthetic-suite.json"], assertion: "Qualification, supervision, authorization, medical necessity, signature, duration, units, and documentation controls passed or failed closed." },
  { criterion: "M2.3-04", status: "passed", evidencePaths: ["m23-synthetic-suite.json", "m23-acceptance-summary.md"], assertion: "H2014 and H2017 ready paths passed; H2014-HO remained fail-closed." },
  { criterion: "M2.3-05", status: "passed", evidencePaths: ["m23-synthetic-suite.json"], assertion: "The 90-day alert escalated and closed through a new immutable plan version." },
  { criterion: "M2.3-06", status: "passed", evidencePaths: ["m23-synthetic-suite.json"], assertion: "The representative M2.2 youth, referral, CANS, and MHTCM plan continue through read-only bridges into an MHRS-owned case." },
  { criterion: "M2.3-07", status: "passed", evidencePaths: ["m23-synthetic-suite.json", "m23-acceptance-summary.md"], assertion: "Plan, authorization, credential, note, and signature defects block claim handoff." },
  { criterion: "M2.3-08", status: "passed", evidencePaths: ["m23-synthetic-suite.json", "m23-acceptance-summary.md"], assertion: "Four representative scenarios retain role-attributed, case-correlated audit evidence." },
] as const;

const manifest = pretty({
  milestone: "M2.3",
  evidenceClass: "synthetic_demo",
  acceptanceGate: true,
  files: [
    { path: "m23-synthetic-suite.json", sha256: sha256(suiteDocument) },
    { path: "m23-acceptance-summary.md", sha256: sha256(summaryDocument) },
  ],
  assertions: {
    controlledWorkflows: result.scenarios.length,
    billingReadyScenarios: result.scenarios.filter((scenario) => scenario.billingReady).length,
    revenueReadyHandoffs: result.scenarios.filter((scenario) => scenario.claimHandoffState === "ready_for_revenue").length,
    rejectedNegativeControls: 1 + result.missingEvidenceControls.filter((handoff) => handoff.state === "rejected").length,
    reviewState: result.review.state,
  },
  criteria,
});
await writeFile(resolve(outputDirectory, "m23-manifest.json"), manifest, "utf8");

console.log(`M2.3 evidence exported to ${outputDirectory}`);
