import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const outputRoot = process.argv[2] ?? "../evidence/M2.2";
const manifestPath = join(
  outputRoot,
  "90_Manifest_and_QA",
  "m22-evidence-manifest.json",
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
  milestone: string;
  scenarioId: string;
  evidenceClass: string;
  acceptanceGate: boolean;
  files: Array<{ path: string; sha256: string; bytes: number }>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new Error(`M22_EVIDENCE_VERIFICATION_FAILED: ${message}`);
}

assert(manifest.milestone === "M2.2", "manifest milestone drift");
assert(manifest.scenarioId === "SCN-M22-001", "representative scenario drift");
assert(
  manifest.evidenceClass === "synthetic_demo",
  "synthetic boundary missing",
);
assert(manifest.acceptanceGate === true, "acceptance gate is not passed");
const requiredFiles = [
  "M2_2_SIX_FUNCTION_EXECUTION.json",
  "M2_2_PLAN_VERSION_LINEAGE.json",
  "M2_2_DISCHARGE_AFTERCARE_TIMING_RESULTS.json",
  "M2_2_T1017_BILLING_GATE_REPORT.json",
  "M2_2_180_DAY_AUTHORIZATION_ALERT_RESULTS.json",
  "SCN-M22-001_FULL_LIFECYCLE_RESULT.json",
];
const manifestPaths = new Set(manifest.files.map((file) => file.path));
assert(
  requiredFiles.every((path) => manifestPaths.has(path)),
  "acceptance-matrix evidence filename drift",
);

for (const file of manifest.files) {
  const content = await readFile(join(outputRoot, file.path));
  assert(content.byteLength === file.bytes, `${file.path} byte count mismatch`);
  assert(
    createHash("sha256").update(content).digest("hex") === file.sha256,
    `${file.path} hash mismatch`,
  );
}

const scenario = JSON.parse(
  await readFile(
    join(outputRoot, "SCN-M22-001_FULL_LIFECYCLE_RESULT.json"),
    "utf8",
  ),
) as {
  scenarioId: string;
  dataMode: string;
  acceptanceGate: boolean;
  criteria: Record<string, boolean>;
  snapshot: {
    case: { lifecycle: Array<{ function: string }>; evidenceClass: string };
    planVersions: Array<{ version: number; status: string }>;
    dischargePlan: { leadDays: number };
    aftercare: { dueOn: string };
    authorization: { renewalDueOn: string };
  };
};
assert(
  scenario.scenarioId === "SCN-M22-001" && scenario.acceptanceGate,
  "representative scenario result failed",
);
assert(
  Object.keys(scenario.criteria).length === 8 &&
    Object.values(scenario.criteria).every(Boolean),
  "one or more acceptance criteria failed",
);
assert(
  scenario.snapshot.case.evidenceClass === "synthetic_demo",
  "snapshot evidence class drift",
);
assert(
  scenario.snapshot.case.lifecycle.map((item) => item.function).join("|") ===
    [
      "intake_screening",
      "eligibility",
      "care_coordination",
      "referral_management",
      "discharge_planning",
      "aftercare_follow_up",
    ].join("|"),
  "lifecycle drift",
);
assert(
  scenario.snapshot.planVersions.length === 2 &&
    scenario.snapshot.planVersions[1].status === "approved",
  "plan history failed",
);
assert(scenario.snapshot.dischargePlan.leadDays >= 14, "discharge lead failed");
assert(
  scenario.snapshot.aftercare.dueOn === "2026-08-14",
  "aftercare clock drift",
);
assert(
  scenario.snapshot.authorization.renewalDueOn === "2026-07-14",
  "authorization clock drift",
);

const gate = JSON.parse(
  await readFile(
    join(outputRoot, "M2_2_T1017_BILLING_GATE_REPORT.json"),
    "utf8",
  ),
) as {
  billingDecision: { result: { billingReady: boolean; decision: string } };
  claimHandoff: { status: string };
};
assert(
  gate.billingDecision.result.billingReady &&
    gate.billingDecision.result.decision === "READY",
  "T1017 gate failed",
);
assert(
  gate.claimHandoff.status === "ready_for_revenue",
  "claim handoff failed",
);

console.log(
  `M2.2 evidence verified: ${manifest.files.length} files, all hashes and controls passed.`,
);
