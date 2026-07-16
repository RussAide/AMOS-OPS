import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const M51B_REQUIRED_QA_STEPS = Object.freeze([
  "inherited_m51a_baseline",
  "schema_integrity",
  "focused_m51b_tests",
  "typecheck",
  "strict_lint",
  "full_regression",
  "client_build",
  "server_build",
  "evidence_export",
  "evidence_verification",
]);

const REQUIRED_FOCUSED_TESTS = Object.freeze([
  "api/tests/m51b-integration-governance.test.ts",
  "api/tests/m51b-teams-delivery.test.ts",
  "api/tests/m51b-teams-security.test.ts",
  "api/tests/m51b-teams-reliability.test.ts",
  "api/tests/m51b-outlook-referral-intake.test.ts",
  "api/tests/m51b-outlook-policy-adversarial.test.ts",
  "api/tests/m51b-outlook-idempotency-recovery.test.ts",
  "api/tests/m51b-sharepoint-approved-sync.test.ts",
  "api/tests/m51b-sharepoint-gates.test.ts",
  "api/tests/m51b-sharepoint-conflict-recovery.test.ts",
  "api/tests/m51b-sharepoint-boundary.test.ts",
  "api/tests/m51b-resilience.test.ts",
  "api/tests/m51b-integrated-scenario.test.ts",
  "api/tests/m51b-router-contract.test.ts",
  "api/tests/m51b-app-route.test.ts",
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
    else throw new Error(`Unknown M5.1B QA option: ${argv[index]}`);
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
  throw new Error(`M5.1B source root is missing under ${root}.`);
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
  const roots = [path.join(sourceRoot, "api", "tests")];
  const componentRoot = path.join(sourceRoot, "src", "components", "m51b");
  if (fs.existsSync(componentRoot)) roots.push(componentRoot);
  const files = [];
  const visit = (directory) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (
        entry.isFile() &&
        /m51b-.*\.test\.(?:ts|tsx)$/.test(entry.name)
      )
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

export function runM51BQa(options) {
  const sourceRoot = sourceRootFor(options.root);
  assert(
    !isWithin(sourceRoot, options.output),
    "M5.1B QA output cannot be inside the canonical source tree.",
  );
  const focusedTests = discoverFocusedTests(sourceRoot);
  assert(focusedTests.length > 0, "No focused M5.1B tests were discovered.");
  for (const required of REQUIRED_FOCUSED_TESTS)
    assert(
      focusedTests.includes(required),
      `M5.1B focused QA omitted ${required}.`,
    );

  const logDirectory = path.join(options.output, "Verification_Logs");
  fs.mkdirSync(logDirectory, { recursive: true });
  const steps = [
    {
      id: "inherited_m51a_baseline",
      command: "npm",
      args: ["run", "test:m5.1a"],
    },
    {
      id: "schema_integrity",
      command: process.execPath,
      args: [
        "scripts/m51b-verify-schema.mjs",
        "--root",
        options.root,
        "--output",
        options.output,
      ],
    },
    {
      id: "focused_m51b_tests",
      command: "npx",
      args: [
        "--no-install",
        "vitest",
        "run",
        ...focusedTests,
        "--reporter=verbose",
      ],
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
        "scripts/m51b-export-evidence.ts",
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
        "scripts/m51b-verify-evidence.ts",
        "--root",
        options.root,
        "--output",
        options.output,
      ],
    },
  ];
  assert(
    JSON.stringify(steps.map((step) => step.id)) ===
      JSON.stringify(M51B_REQUIRED_QA_STEPS),
    "M5.1B QA step order drifted.",
  );

  const startedAt = new Date().toISOString();
  const results = [];
  for (const step of steps) {
    const stepStartedAt = new Date().toISOString();
    const started = Date.now();
    const execution = spawnSync(step.command, step.args, {
      cwd: sourceRoot,
      encoding: "utf8",
      maxBuffer: 200 * 1024 * 1024,
      env: {
        ...process.env,
        npm_config_cache:
          process.env.npm_config_cache ??
          path.join(os.tmpdir(), "npm-cache-amos-m51b"),
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

  const report = {
    schemaVersion: "1.0",
    reportId: "M51B-INTEGRATED-QA",
    milestone: "M5.1B",
    evidenceClass: "synthetic_microsoft_365_workflow_integration_demo",
    productionRows: 0,
    liveGraphCalls: 0,
    liveMicrosoftReads: 0,
    liveMicrosoftWrites: 0,
    realNotificationsSent: 0,
    liveWrites: 0,
    usesProductionData: false,
    startedAt,
    completedAt: new Date().toISOString(),
    focusedTests,
    requiredSteps: M51B_REQUIRED_QA_STEPS,
    schemaReport: "M5_1B_SCHEMA_INTEGRITY.json",
    passed:
      results.length === steps.length &&
      results.every((result) => result.exitCode === 0),
    steps: results.map(({ stdout: _stdout, stderr: _stderr, ...result }) => ({
      ...result,
      log: normalize(path.join("Verification_Logs", `${result.id}.log`)),
    })),
  };
  atomicWrite(
    path.join(options.output, "M5_1B_INTEGRATED_QA.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}

const invoked = process.argv[1];
if (invoked && pathToFileURL(path.resolve(invoked)).href === import.meta.url) {
  try {
    const report = runM51BQa(parse(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `M5.1B QA failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
