import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const evidenceDirectory = path.resolve(process.argv[2] ?? "../evidence/shared");
fs.mkdirSync(evidenceDirectory, { recursive: true });

const focusedTests = fs.readdirSync(path.resolve("api/tests"))
  .filter((name) => /^(phase2-|m22-|m23-|m24-).+\.test\.ts$/.test(name))
  .sort()
  .map((name) => `api/tests/${name}`);

const steps = [
  { id: "migration_integrity", command: "node", args: ["scripts/phase2-verify-migrations.mjs", path.join(os.tmpdir(), `amos-phase2-qa-${process.pid}.db`)] },
  { id: "focused_phase2_tests", command: "npx", args: ["vitest", "run", ...focusedTests, "--reporter=verbose"] },
  { id: "typecheck", command: "npm", args: ["run", "typecheck"] },
  { id: "strict_lint", command: "npm", args: ["run", "lint:strict"] },
  { id: "full_regression", command: "npm", args: ["test", "--", "--reporter=default"] },
  { id: "client_server_build", command: "npm", args: ["run", "build"] },
];

const startedAt = new Date().toISOString();
const results = [];
for (const step of steps) {
  const stepStartedAt = new Date().toISOString();
  const result = spawnSync(step.command, step.args, { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, npm_config_cache: process.env.npm_config_cache ?? path.join(os.tmpdir(), "npm-cache-amos-phase2") } });
  const record = {
    id: step.id,
    command: [step.command, ...step.args],
    startedAt: stepStartedAt,
    completedAt: new Date().toISOString(),
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
  results.push(record);
  fs.writeFileSync(path.join(evidenceDirectory, `${step.id}.log`), `${record.stdout}\n${record.stderr}`);
  if (record.exitCode !== 0) break;
}

const report = {
  reportId: "PHASE2-INTEGRATED-QA",
  evidenceClass: "synthetic_demo",
  startedAt,
  completedAt: new Date().toISOString(),
  focusedTests,
  passed: results.length === steps.length && results.every((result) => result.exitCode === 0),
  steps: results.map(({ stdout: _stdout, stderr: _stderr, ...result }) => result),
};
fs.writeFileSync(path.join(evidenceDirectory, "PHASE_2_INTEGRATED_QA.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
