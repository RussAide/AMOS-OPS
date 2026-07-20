import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL(
    "../.github/workflows/operational-alert-operations.yml",
    import.meta.url,
  ),
  "utf8",
);

test("alert operations are manual, protected, and split by explicit intent", () => {
  assert.match(workflow, /on:\n  workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s{2}(push|pull_request|schedule):/m);
  assert.match(workflow, /options: \[diagnose, reconcile\]/);
  assert.equal(workflow.match(/environment: amos-production/g)?.length, 2);
  assert.match(workflow, /inputs\.operation == 'diagnose'/);
  assert.match(workflow, /inputs\.operation == 'reconcile'/);
});

test("diagnosis is signed GET and reconciliation requires exact fresh evidence", () => {
  assert.match(workflow, /operational-alerts\/diagnosis/);
  assert.match(workflow, /printf 'v1\\n%s\\n%s\\nGET/);
  assert.match(workflow, /operational-alerts\/reconciliation/);
  assert.match(workflow, /\^\[a-f0-9\]\{64\}\$/);
  assert.match(workflow, /diagnosisFingerprint/);
  assert.match(workflow, /printf 'v1\\n%s\\n%s\\nPOST/);
  assert.doesNotMatch(workflow, /AMOS_ADMIN_RECOVERY_TOKEN|RECOVERY_TOKEN/);
});
