import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

interface Manifest {
  milestone: string;
  evidenceClass: string;
  acceptanceGate: boolean;
  files: readonly { path: string; sha256: string }[];
  assertions: {
    controlledWorkflows: number;
    billingReadyScenarios: number;
    revenueReadyHandoffs: number;
    rejectedNegativeControls: number;
    reviewState: string;
  };
  criteria: readonly {
    criterion: string;
    status: string;
    evidencePaths: readonly string[];
    assertion: string;
  }[];
}

const outputDirectory = resolve(process.argv[2] ?? "../evidence/M2.3");
const manifest = JSON.parse(await readFile(resolve(outputDirectory, "m23-manifest.json"), "utf8")) as Manifest;

if (manifest.milestone !== "M2.3" || manifest.evidenceClass !== "synthetic_demo" || !manifest.acceptanceGate) {
  throw new Error("M23_EVIDENCE_BOUNDARY_INVALID");
}

const expectedCriteria = [
  "M2.3-01",
  "M2.3-02",
  "M2.3-03",
  "M2.3-04",
  "M2.3-05",
  "M2.3-06",
  "M2.3-07",
  "M2.3-08",
];
if (
  JSON.stringify(manifest.criteria.map((criterion) => criterion.criterion)) !== JSON.stringify(expectedCriteria) ||
  manifest.criteria.some((criterion) => criterion.status !== "passed" || criterion.evidencePaths.length === 0 || !criterion.assertion.trim())
) {
  throw new Error("M23_CRITERION_REGISTER_INVALID");
}
const declaredPaths = new Set(manifest.files.map((file) => file.path));
for (const criterion of manifest.criteria) {
  if (criterion.evidencePaths.some((evidencePath) => !declaredPaths.has(evidencePath))) {
    throw new Error(`M23_CRITERION_EVIDENCE_UNDECLARED:${criterion.criterion}`);
  }
}
if (
  manifest.assertions.controlledWorkflows !== 4 ||
  manifest.assertions.billingReadyScenarios !== 4 ||
  manifest.assertions.revenueReadyHandoffs !== 4 ||
  manifest.assertions.rejectedNegativeControls !== 6 ||
  manifest.assertions.reviewState !== "completed"
) {
  throw new Error("M23_ACCEPTANCE_ASSERTIONS_FAILED");
}

for (const file of manifest.files) {
  const contents = await readFile(resolve(outputDirectory, file.path));
  const actual = createHash("sha256").update(contents).digest("hex");
  if (actual !== file.sha256) throw new Error(`M23_EVIDENCE_HASH_MISMATCH:${file.path}`);
}

const suite = JSON.parse(await readFile(resolve(outputDirectory, "m23-synthetic-suite.json"), "utf8")) as {
  evidenceClass: string;
  scenarios: readonly { id: string; caseId: string }[];
  snapshot: {
    cases: readonly {
      id: string;
      subjectId: string;
      careBridge: {
        ccmg: { referralId: string; accessMode: string };
        cans: { assessmentId: string; lineageId: string; targetRecordId: string; accessMode: string };
        mhtcm: { planId: string; version: number; accessMode: string };
      };
    }[];
  };
};
const continuumScenario = suite.scenarios.find((scenario) => scenario.id === "M23-SCENARIO-INDIVIDUAL");
const continuumCase = suite.snapshot.cases.find((programCase) => programCase.id === continuumScenario?.caseId);
if (
  suite.evidenceClass !== "synthetic_demo" ||
  !continuumCase ||
  !continuumCase.id.startsWith("M23-CASE-") ||
  continuumCase.subjectId !== "SYNTH-YOUTH-EXISTING-001" ||
  continuumCase.careBridge.ccmg.referralId !== "M21-REF-EXISTING-001" ||
  continuumCase.careBridge.cans.assessmentId !== "M21-CANS-EXISTING-V2" ||
  continuumCase.careBridge.cans.lineageId !== "M21-LINEAGE-EXISTING-V2-MHTCM" ||
  continuumCase.careBridge.cans.targetRecordId !== "SYNTH-MHTCM-PLAN-001" ||
  continuumCase.careBridge.mhtcm.planId !== "SYNTH-MHTCM-PLAN-001" ||
  continuumCase.careBridge.mhtcm.version !== 2 ||
  [continuumCase.careBridge.ccmg.accessMode, continuumCase.careBridge.cans.accessMode, continuumCase.careBridge.mhtcm.accessMode].some((mode) => mode !== "read_only")
) {
  throw new Error("M23_M22_CONTINUUM_LINEAGE_INVALID");
}

console.log("M2.3 evidence verified: 8/8 criteria, M2.2 continuum lineage, 4 ready workflows, 6 fail-closed controls, and 90-day review complete.");
