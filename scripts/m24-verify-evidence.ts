import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { M24_CRITERIA } from "../contracts/gro/m24-model";

interface M24Manifest {
  milestone: string;
  evidenceClass: string;
  acceptanceGate: boolean;
  criteria: readonly {
    criterionId: string;
    status: string;
    passed: boolean;
    evidencePaths: readonly string[];
  }[];
  files: readonly { path: string; sha256: string }[];
  assertions: {
    criteriaPassed: number;
    scenariosPassed: number;
    stageCount: number;
    bedCount: number;
    peakCensusPercent: number;
    representativeCaseId: string | null;
    representativeYouthId: string | null;
    representativeDisposition: string | null;
    practiceDecisionCount: number;
    closedIncidentCount: number;
    noncompliantStaffingCount: number;
  };
}

const outputDirectory = resolve(process.argv[2] ?? "../evidence/M2.4");
const manifest = JSON.parse(
  await readFile(resolve(outputDirectory, "m24-manifest.json"), "utf8"),
) as M24Manifest;

if (
  manifest.milestone !== "M2.4" ||
  manifest.evidenceClass !== "synthetic_demo" ||
  manifest.acceptanceGate !== true
) {
  throw new Error("M24_EVIDENCE_BOUNDARY_INVALID");
}
const declaredPaths = new Set(manifest.files.map((file) => file.path));
if (
  manifest.criteria.length !== M24_CRITERIA.length ||
  manifest.criteria.map((criterion) => criterion.criterionId).join("|") !==
    M24_CRITERIA.join("|") ||
  manifest.criteria.some(
    (criterion) =>
      criterion.status !== "PASS" ||
      criterion.passed !== true ||
      criterion.evidencePaths.length === 0 ||
      criterion.evidencePaths.some((path) => !declaredPaths.has(path)),
  )
) {
  throw new Error("M24_CRITERION_EVIDENCE_INVALID");
}
if (
  manifest.assertions.criteriaPassed !== 8 ||
  manifest.assertions.scenariosPassed !== 6 ||
  manifest.assertions.stageCount !== 3 ||
  manifest.assertions.bedCount !== 48 ||
  manifest.assertions.peakCensusPercent < 90 ||
  manifest.assertions.representativeCaseId !== "M21-CASE-EXISTING-001" ||
  manifest.assertions.representativeYouthId !== "SYNTH-YOUTH-EXISTING-001" ||
  manifest.assertions.representativeDisposition !== "discharged" ||
  manifest.assertions.practiceDecisionCount !== 3 ||
  manifest.assertions.closedIncidentCount < 1 ||
  manifest.assertions.noncompliantStaffingCount < 1
) {
  throw new Error("M24_ACCEPTANCE_ASSERTIONS_FAILED");
}

for (const file of manifest.files) {
  const contents = await readFile(resolve(outputDirectory, file.path));
  const actual = createHash("sha256").update(contents).digest("hex");
  if (actual !== file.sha256)
    throw new Error(`M24_EVIDENCE_HASH_MISMATCH:${file.path}`);
}

const suite = JSON.parse(
  await readFile(resolve(outputDirectory, "m24-synthetic-suite.json"), "utf8"),
) as {
  passed: boolean;
  results: readonly { id: string; passed: boolean }[];
  scenarioRuns: readonly {
    id: string;
    status: string;
    evidence: { evidenceClass?: string };
  }[];
};
if (
  !suite.passed ||
  suite.results.length !== 6 ||
  suite.results.some((item) => !item.passed)
) {
  throw new Error("M24_SCENARIO_EVIDENCE_FAILED");
}
if (
  suite.scenarioRuns.some(
    (item) =>
      !item.id.startsWith("SYNTH-") ||
      item.status !== "passed" ||
      item.evidence.evidenceClass !== "synthetic_demo",
  )
) {
  throw new Error("M24_SCENARIO_SYNTHETIC_BOUNDARY_INVALID");
}

console.log(
  "M2.4 evidence verified: 8 criteria, 6 scenarios, 3 stages, peak census alert, shared-youth discharge, incident and staffing controls passed.",
);
