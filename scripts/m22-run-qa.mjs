import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const reportPath = resolve(
  process.argv[2] ?? "../evidence/M2.2/90_Manifest_and_QA/m22-qa-summary.json",
);
const commands = [
  {
    name: "focused_tests",
    command: "npx",
    args: [
      "vitest",
      "run",
      "api/tests/m22-contract.test.ts",
      "api/tests/m22-lifecycle.test.ts",
      "api/tests/m22-billing.test.ts",
      "api/tests/m22-permissions-audit.test.ts",
      "src/components/mhtcm/m22-workspace.test.tsx",
      "--reporter=verbose",
    ],
  },
  {
    name: "server_typecheck",
    command: "npx",
    args: [
      "tsc",
      "-p",
      "tsconfig.server.json",
      "--noEmit",
      "--pretty",
      "false",
    ],
  },
  {
    name: "client_typecheck",
    command: "npx",
    args: ["tsc", "-p", "tsconfig.app.json", "--noEmit", "--pretty", "false"],
  },
];

const results = commands.map((step) => {
  const run = spawnSync(step.command, step.args, {
    encoding: "utf8",
    env: process.env,
  });
  return {
    name: step.name,
    command: [step.command, ...step.args].join(" "),
    exitCode: run.status ?? 1,
    passed: run.status === 0,
    stdout: run.stdout,
    stderr: run.stderr,
  };
});
const summary = {
  milestone: "M2.2",
  evidenceClass: "synthetic_demo",
  passed: results.every((result) => result.passed),
  results,
};
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(
  `M2.2 QA ${summary.passed ? "passed" : "failed"}; report: ${reportPath}`,
);
if (!summary.passed) process.exitCode = 1;
