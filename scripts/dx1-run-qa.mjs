import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

export const DX1_REQUIRED_QA_STEPS = Object.freeze([
  "inherited_m52_seal",
  "inherited_m52_regression",
  "focused_dx1_tests",
  "typecheck",
  "strict_lint",
  "full_regression",
  "client_build",
  "server_build",
  "evidence_export",
  "evidence_verification",
]);

const REQUIRED_FOCUSED_TESTS = Object.freeze([
  "api/tests/dx1-app-route.test.ts",
  "api/tests/dx1-closure-hardening.test.ts",
  "api/tests/dx1-experience-adversarial.test.ts",
  "api/tests/dx1-experience-governance.test.ts",
  "api/tests/dx1-experience-view.test.tsx",
  "api/tests/dx1-integrated-contract.test.ts",
  "api/tests/dx1-intelligence-agent-nil.test.ts",
  "api/tests/dx1-intelligence-dashboard-microsoft.test.ts",
  "api/tests/dx1-intelligence-dms.test.ts",
  "api/tests/dx1-intelligence-integrated.test.ts",
  "api/tests/dx1-pilot-adversarial.test.ts",
  "api/tests/dx1-pilot-authorization.test.ts",
  "api/tests/dx1-pilot-workflow.test.ts",
  "api/tests/dx1-router-contract.test.ts",
  "api/tests/dx1-shared-contract.test.ts",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parse(argv) {
  let root = "..";
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") root = argv[++index];
    else if (argv[index] === "--output") output = argv[++index];
    else throw new Error(`Unknown DX.1 QA option: ${argv[index]}`);
  }
  const resolvedRoot = path.resolve(root);
  return {
    root: resolvedRoot,
    output: path.resolve(output ?? path.join(resolvedRoot, "evidence")),
  };
}

function sourceRootFor(root) {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`DX.1 source root is missing under ${root}.`);
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function normalize(value) {
  return value.split(path.sep).join("/");
}

function discoverFocusedTests(sourceRoot) {
  const roots = [
    path.join(sourceRoot, "api", "tests"),
    path.join(sourceRoot, "src", "components", "dx1"),
  ];
  const files = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && /^dx1-.*\.test\.(?:ts|tsx)$/.test(entry.name))
        files.push(normalize(path.relative(sourceRoot, absolute)));
    }
  };
  for (const root of roots) visit(root);
  return [...new Set(files)].sort();
}

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

function writeLog(directory, record) {
  atomicWrite(
    path.join(directory, `${record.id}.log`),
    [
      `command: ${record.command.join(" ")}`,
      `startedAt: ${record.startedAt}`,
      `completedAt: ${record.completedAt}`,
      `durationMs: ${record.durationMs}`,
      `exitCode: ${record.exitCode}`,
      "",
      "stdout:",
      record.stdout,
      "",
      "stderr:",
      record.stderr,
      "",
    ].join("\n"),
  );
}

export function runDx1Qa(options) {
  const sourceRoot = sourceRootFor(options.root);
  assert(
    !isWithin(sourceRoot, options.output),
    "DX.1 QA output cannot be inside the canonical source tree.",
  );
  const focusedTests = discoverFocusedTests(sourceRoot);
  assert(
    JSON.stringify(focusedTests) ===
      JSON.stringify([...REQUIRED_FOCUSED_TESTS].sort()),
    "DX.1 focused-test inventory is incomplete or contains an unreviewed addition.",
  );
  const logDirectory = path.join(options.output, "Verification_Logs");
  fs.mkdirSync(logDirectory, { recursive: true });
  const steps = [
    {
      id: "inherited_m52_seal",
      command: process.execPath,
      args: [
        "scripts/dx1-verify-inherited.mjs",
        "--root",
        options.root,
        "--output",
        options.output,
      ],
    },
    {
      id: "inherited_m52_regression",
      command: "npm",
      args: ["run", "test:m5.2"],
    },
    {
      id: "focused_dx1_tests",
      command: "npx",
      args: ["--no-install", "vitest", "run", ...focusedTests, "--reporter=verbose"],
    },
    { id: "typecheck", command: "npm", args: ["run", "typecheck"] },
    { id: "strict_lint", command: "npm", args: ["run", "lint:strict"] },
    {
      id: "full_regression",
      command: "npm",
      args: ["test", "--", "--reporter=default"],
    },
    { id: "client_build", command: "npm", args: ["run", "build:client"] },
    { id: "server_build", command: "npm", args: ["run", "build:server"] },
    {
      id: "evidence_export",
      command: process.execPath,
      args: [
        "--import",
        "tsx",
        "scripts/dx1-export-evidence.ts",
        "--root",
        options.root,
        "--output",
        options.output,
      ],
    },
    {
      id: "evidence_verification",
      command: process.execPath,
      args: [
        "--import",
        "tsx",
        "scripts/dx1-verify-evidence.ts",
        "--root",
        options.root,
        "--output",
        options.output,
      ],
    },
  ];
  assert(
    JSON.stringify(steps.map((step) => step.id)) ===
      JSON.stringify(DX1_REQUIRED_QA_STEPS),
    "DX.1 QA step order drifted.",
  );

  const startedAt = new Date().toISOString();
  const results = [];
  for (const step of steps) {
    const stepStartedAt = new Date().toISOString();
    const started = Date.now();
    const execution = spawnSync(step.command, step.args, {
      cwd: sourceRoot,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      env: {
        ...process.env,
        npm_config_cache:
          process.env.npm_config_cache ?? path.join(os.tmpdir(), "npm-cache-amos-dx1"),
      },
    });
    const record = {
      id: step.id,
      command: [step.command, ...step.args],
      startedAt: stepStartedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      exitCode: execution.status ?? 1,
      stdout: execution.stdout ?? "",
      stderr: execution.stderr ?? "",
    };
    results.push(record);
    writeLog(logDirectory, record);
    if (record.exitCode !== 0) break;
  }

  const passed =
    results.length === DX1_REQUIRED_QA_STEPS.length &&
    results.every((record) => record.exitCode === 0);
  const report = {
    schemaVersion: "1.0",
    reportId: "DX1-INTEGRATED-QA",
    milestone: "DX.1",
    evidenceClass: "SYNTHETIC_PROTOTYPE",
    status: passed ? "PASS" : "FAIL",
    startedAt,
    completedAt: new Date().toISOString(),
    focusedTests,
    focusedTestFiles: focusedTests.length,
    requiredSteps: DX1_REQUIRED_QA_STEPS,
    steps: results.map((record) => ({
      id: record.id,
      exitCode: record.exitCode,
      durationMs: record.durationMs,
      log: `Verification_Logs/${record.id}.log`,
    })),
    stepsPassed: results.filter((record) => record.exitCode === 0).length,
    stepsExpected: DX1_REQUIRED_QA_STEPS.length,
    productionRows: 0,
    liveExternalCalls: 0,
    liveMicrosoftReads: 0,
    liveMicrosoftWrites: 0,
    liveClinicalScoringActivations: 0,
    liveLevelOfCareDecisions: 0,
    realNotificationsSent: 0,
    deployments: 0,
    githubPushes: 0,
    usesProductionData: false,
    synthetic: true,
  };
  atomicWrite(
    path.join(options.output, "DX_1_INTEGRATED_QA.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (!passed) {
    const failed = results.find((record) => record.exitCode !== 0);
    throw new Error(`DX.1 integrated QA failed at ${failed?.id ?? "unknown"}.`);
  }
  return report;
}

const options = parse(process.argv.slice(2));
const report = runDx1Qa(options);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
