import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const evidenceRoot = path.resolve(
  process.argv[2] ?? "../evidence/90_Manifest_and_QA",
);
const logDirectory = path.join(evidenceRoot, "Verification_Logs");
fs.mkdirSync(logDirectory, { recursive: true });

const qaEnvironment = {
  ...process.env,
  HOME: "/tmp/codex-home-m21",
  NPM_CONFIG_CACHE: "/tmp/codex-npm-cache-m21-final",
};

const migrationDatabase = `/tmp/amos-m21-migration-final-${Date.now()}.db`;
const checks = [
  {
    id: "QA-01",
    label: "Clean dependency installation",
    command: "npm",
    args: [
      "ci",
      "--no-audit",
      "--no-fund",
      "--logs-dir=/tmp/codex-npm-logs-m21-final",
    ],
  },
  {
    id: "QA-02",
    label: "TypeScript project check",
    command: "npm",
    args: ["run", "typecheck"],
  },
  {
    id: "QA-03",
    label: "Strict ESLint check",
    command: "npm",
    args: ["run", "lint:strict"],
  },
  {
    id: "QA-04",
    label: "M2.1 focused CCMG suite",
    command: "npm",
    args: ["run", "test:m2.1:ccmg"],
  },
  {
    id: "QA-05",
    label: "Full disposable migration sequence",
    command: "node",
    args: ["scripts/m21-verify-migrations.mjs", migrationDatabase],
  },
  {
    id: "QA-06",
    label: "M2.1 evidence reconciliation",
    command: "node",
    args: ["--import", "tsx", "scripts/m21-verify-evidence.ts", "../evidence"],
  },
  {
    id: "QA-07",
    label: "Full automated test suite",
    command: "npm",
    args: ["test"],
  },
  {
    id: "QA-08",
    label: "Client and server production build",
    command: "npm",
    args: ["run", "build"],
  },
  {
    id: "QA-09",
    label: "Combined repository verification",
    command: "npm",
    args: ["run", "verify"],
  },
];

const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
const results = [];

for (const [index, check] of checks.entries()) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const run = spawnSync(check.command, check.args, {
    cwd: process.cwd(),
    env: qaEnvironment,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - started;
  const exitCode = run.status ?? 1;
  const logName = `${String(index + 1).padStart(2, "0")}_${check.id}_${check.label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")}.log`;
  const logPath = path.join(logDirectory, logName);
  fs.writeFileSync(
    logPath,
    [
      `Check: ${check.id} - ${check.label}`,
      `Command: ${check.command} ${check.args.join(" ")}`,
      `Started: ${startedAt}`,
      `Completed: ${completedAt}`,
      `Duration ms: ${durationMs}`,
      `Exit code: ${exitCode}`,
      "",
      "STDOUT",
      run.stdout ?? "",
      "",
      "STDERR",
      run.stderr ?? "",
    ].join("\n"),
  );
  results.push({
    id: check.id,
    label: check.label,
    command: `${check.command} ${check.args.join(" ")}`,
    status: exitCode === 0 ? "PASS" : "FAIL",
    exitCode,
    startedAt,
    completedAt,
    durationMs,
    log: `Verification_Logs/${logName}`,
  });
  if (exitCode !== 0) break;
}

const csv = [
  [
    "check_id",
    "label",
    "command",
    "status",
    "exit_code",
    "started_at",
    "completed_at",
    "duration_ms",
    "log",
  ],
  ...results.map((result) => [
    result.id,
    result.label,
    result.command,
    result.status,
    result.exitCode,
    result.startedAt,
    result.completedAt,
    result.durationMs,
    result.log,
  ]),
]
  .map((row) => row.map(csvCell).join(","))
  .join("\n") + "\n";

fs.writeFileSync(path.join(evidenceRoot, "QA_COMMAND_RESULTS.csv"), csv);
fs.writeFileSync(
  path.join(evidenceRoot, "QA_COMMAND_RESULTS.json"),
  `${JSON.stringify(results, null, 2)}\n`,
);

const failed = results.find((result) => result.status === "FAIL");
if (failed) {
  console.error(`${failed.id} failed; see ${failed.log}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    { status: "PASS", checks: results.length, evidenceRoot },
    null,
    2,
  ),
);
