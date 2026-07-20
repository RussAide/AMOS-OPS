import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyReleaseIdentityBoundary } from "./verify-release-identity-boundary.mjs";

const validIdentity = `name: Protected Identity Operations
on:
  workflow_dispatch:
    inputs:
      operation:
        required: true
jobs:
  diagnose:
    if: \${{ inputs.operation == 'diagnose' }}
    steps:
      - env:
          APP_SECRET: \${{ secrets.APP_SECRET }}
        run: |
          path=/api/operator/identity/diagnosis
          body=''
          canonical="$(printf 'v1\\n%s\\n%s\\nGET\\n%s\\n%s')"
          curl -X GET "$path"
  activate_recovery:
    if: \${{ inputs.operation == 'activate-recovery' }}
    steps:
      - env:
          APP_SECRET: \${{ secrets.APP_SECRET }}
          RECOVERY_TOKEN: \${{ secrets.AMOS_ADMIN_RECOVERY_TOKEN }}
          RECOVERY_MINUTES: \${{ inputs.recovery_minutes }}
        run: |
          [[ "$RECOVERY_MINUTES" =~ ^[0-9]+$ ]]
          (( RECOVERY_MINUTES < 1 || RECOVERY_MINUTES > 60 ))
          path=/api/operator/identity/recovery
          canonical="$(printf 'v1\\n%s\\n%s\\nPOST\\n%s\\n%s')"
          curl -X POST "$path"
`;

const validBoot = `
app.get("/api/operator/identity/diagnosis", async (c) => c.json({ ok: true }));
app.post("/api/operator/identity/recovery", async (c) => c.json({ ok: true }));
`;

function fixture(identity = validIdentity, boot = validBoot, release = "on: [push]\n") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "amos-boundary-"));
  const workflows = path.join(root, ".github", "workflows");
  fs.mkdirSync(workflows, { recursive: true });
  fs.mkdirSync(path.join(root, "api"), { recursive: true });
  fs.writeFileSync(path.join(workflows, "identity-operations.yml"), identity);
  fs.writeFileSync(path.join(workflows, "release.yml"), release);
  fs.writeFileSync(path.join(root, "api", "boot.ts"), boot);
  return {
    root,
    failures: () =>
      verifyReleaseIdentityBoundary({
        workflowRoot: workflows,
        bootPath: path.join(root, "api", "boot.ts"),
      }),
  };
}

test("accepts a manual, job-separated identity boundary", (t) => {
  const current = fixture();
  t.after(() => fs.rmSync(current.root, { recursive: true, force: true }));
  assert.deepEqual(current.failures(), []);
});

test("rejects protected identity controls in release or startup workflows", (t) => {
  const current = fixture(
    validIdentity,
    validBoot,
    `on: [push]\nenv:\n  TOKEN: \${{ secrets.AMOS_ADMIN_RECOVERY_TOKEN }}\nsteps:\n  - run: curl /api/operator/identity/recovery\n`,
  );
  t.after(() => fs.rmSync(current.root, { recursive: true, force: true }));
  assert(current.failures().some((failure) => failure.includes("protected-identity-key")));
  assert(
    current.failures().some((failure) =>
      failure.includes("release-or-startup-must-not-call-identity-operator"),
    ),
  );
});

test("rejects automatic identity triggers, defaults, and diagnosis token access", (t) => {
  const unsafeIdentity = validIdentity
    .replace("  workflow_dispatch:\n", "  push:\n  workflow_dispatch:\n")
    .replace("        required: true\n", "        required: true\n        default: diagnose\n")
    .replace(
      "          APP_SECRET: \${{ secrets.APP_SECRET }}\n",
      "          APP_SECRET: \${{ secrets.APP_SECRET }}\n          RECOVERY_TOKEN: \${{ secrets.AMOS_ADMIN_RECOVERY_TOKEN }}\n",
    );
  const current = fixture(unsafeIdentity);
  t.after(() => fs.rmSync(current.root, { recursive: true, force: true }));
  assert(
    current.failures().includes(
      "identity-operations.yml:identity-workflow-must-be-manual-only",
    ),
  );
  assert(
    current.failures().includes(
      "identity-operations.yml:identity-activation-must-not-have-defaults",
    ),
  );
  assert(
    current.failures().includes(
      "identity-operations.yml:diagnose-job-can-access-recovery-controls",
    ),
  );
});

test("requires GET-only diagnosis runtime route", (t) => {
  const current = fixture(
    validIdentity,
    `app.post("/api/operator/identity/diagnosis", async (c) => c.json({ ok: true }));`,
  );
  t.after(() => fs.rmSync(current.root, { recursive: true, force: true }));
  assert(current.failures().includes("api/boot.ts:diagnosis-route-must-be-get"));
  assert(current.failures().includes("api/boot.ts:diagnosis-route-must-not-be-post"));
});
