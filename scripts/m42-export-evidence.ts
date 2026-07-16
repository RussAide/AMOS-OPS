import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runM42IntegratedScenario } from "../api/services/m42/experience-service";
import {
  M42_CRITERION_EVIDENCE_FILES,
  M42_EVIDENCE_FILES,
  assertM42,
  atomicWriteM42,
  buildM42CriterionEvidence,
  buildM42Summary,
  isM42PathWithin,
  m42ControlReferences,
  m42FileRecord,
  m42SourceRoot,
  parseM42EvidenceOptions,
  stableM42Json,
  type M42EvidenceOptions,
} from "./m42-evidence-common";

export function exportM42Evidence(options: M42EvidenceOptions) {
  const sourceRoot = m42SourceRoot(options.root);
  assertM42(
    !isM42PathWithin(sourceRoot, options.output),
    "M4.2 evidence output cannot be inside the canonical source tree.",
  );
  fs.mkdirSync(options.output, { recursive: true });
  const result = runM42IntegratedScenario(undefined, 5);
  assertM42(result.accepted, "M4.2 integrated scenario is not accepted.");
  const criterionEvidence = buildM42CriterionEvidence(result);
  for (const [fileName, record] of Object.entries(criterionEvidence))
    atomicWriteM42(path.join(options.output, fileName), stableM42Json(record));

  atomicWriteM42(
    path.join(options.output, M42_EVIDENCE_FILES.summary),
    buildM42Summary(result),
  );
  const criterionFiles = Object.values(M42_CRITERION_EVIDENCE_FILES);
  const inventory = [...criterionFiles, M42_EVIDENCE_FILES.summary]
    .map((fileName) =>
      m42FileRecord(path.join(options.output, fileName), fileName),
    )
    .sort((left, right) => left.path.localeCompare(right.path));
  const manifest = Object.freeze({
    schemaVersion: "1.0",
    recordId: "AMOS-OPS-M4.2-ACCEPTANCE-EVIDENCE",
    milestone: "M4.2",
    title: "Document and Knowledge Management Operational",
    status: "complete",
    disposition: "ACCEPTED",
    evidenceClass: result.boundary.evidenceClass,
    generatedAt: result.executedAt,
    criteriaExpected: 8,
    criteriaPassed: result.totals.criteriaPassed,
    assertionCount: result.totals.assertions,
    accepted: result.accepted,
    exactAcceptance: Object.freeze({
      documentSearchUnderThreeSeconds:
        result.search.accepted &&
        result.search.maxMs < result.search.targetMsExclusive,
      nilSemanticAccuracyAtLeastNinetyPercent:
        result.nil.accepted && result.nil.accuracy >= result.nil.threshold,
      governedReportBuilderT2Plus:
        result.acceptanceFlags.find((flag) => flag.criterionId === "M4.2-06")
          ?.passed === true,
      noCodeAdministrationOperational:
        result.acceptanceFlags.find((flag) => flag.criterionId === "M4.2-07")
          ?.passed === true,
      integratedScenarioPassed:
        result.acceptanceFlags.find((flag) => flag.criterionId === "M4.2-08")
          ?.passed === true,
    }),
    syntheticBoundary: Object.freeze({
      ...result.boundary,
      productionRows: 0,
      liveWrites: 0,
      usesProductionData: false,
    }),
    criterionEvidence: result.acceptanceFlags.map((flag) => ({
      criterionId: flag.criterionId,
      passed: flag.passed,
      assertionCount: flag.assertionCount,
      evidenceFile: M42_CRITERION_EVIDENCE_FILES[flag.criterionId],
    })),
    controlReferences: m42ControlReferences(options.root),
    inventory,
  });
  atomicWriteM42(
    path.join(options.output, M42_EVIDENCE_FILES.manifest),
    stableM42Json(manifest),
  );
  const checksumRecords = [
    ...inventory,
    m42FileRecord(
      path.join(options.output, M42_EVIDENCE_FILES.manifest),
      M42_EVIDENCE_FILES.manifest,
    ),
  ].sort((left, right) => left.path.localeCompare(right.path));
  atomicWriteM42(
    path.join(options.output, M42_EVIDENCE_FILES.checksums),
    `${checksumRecords.map((record) => `${record.sha256}  ${record.path}`).join("\n")}\n`,
  );
  return Object.freeze({
    milestone: "M4.2",
    status: "PASS",
    criteriaPassed: result.totals.criteriaPassed,
    criterionArtifacts: criterionFiles.length,
    assertions: result.totals.assertions,
    searchMaxMs: result.search.maxMs,
    nilAccuracy: result.nil.accuracy,
    productionRows: 0,
    liveWrites: 0,
    output: options.output,
  });
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  pathToFileURL(path.resolve(invokedPath)).href === import.meta.url
) {
  try {
    process.stdout.write(
      `${stableM42Json(exportM42Evidence(parseM42EvidenceOptions(process.argv.slice(2))))}`,
    );
  } catch (error) {
    process.stderr.write(
      `M4.2 evidence export failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

void fileURLToPath;
