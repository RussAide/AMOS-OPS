import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const M42_REQUIRED_QA_STEPS = Object.freeze([
  "inherited_m41c_baseline",
  "schema_integrity",
  "focused_m42_tests",
  "typecheck",
  "strict_lint",
  "full_regression",
  "client_build",
  "server_build",
  "evidence_export",
  "evidence_verification",
]);

const REQUIRED_FOCUSED_TESTS = Object.freeze([
  "api/tests/m42-integrated-scenario.test.ts",
  "api/tests/m42-search-performance.test.ts",
  "api/tests/m42-nil-semantic-accuracy.test.ts",
  "api/tests/m42-report-builder.test.ts",
  "api/tests/m42-admin-configuration.test.ts",
  "src/components/m42/m42-document-knowledge-view.test.tsx",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseM42QaOptions(argv) {
  let root;
  let output;
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" || argument === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--"))
        throw new Error(`${argument} requires a path.`);
      if (argument === "--root") root = value;
      else output = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else positional.push(argument);
  }
  root ??= positional[0] ?? "..";
  const resolvedRoot = path.resolve(root);
  output ??= positional[1] ?? path.join(resolvedRoot, "evidence");
  return { root: resolvedRoot, output: path.resolve(output) };
}

function sourceRootFor(root) {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M4.2 source root is missing under ${root}.`);
}

function normalize(value) {
  return value.split(path.sep).join("/");
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  const visit = (directory) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile())
        result.push(normalize(path.relative(root, absolute)));
      else throw new Error(`Unsupported M4.2 QA entry: ${absolute}`);
    }
  };
  visit(root);
  return result;
}

export function discoverFocusedM42Tests(sourceRoot) {
  const candidates = [];
  for (const directoryName of ["api/tests", "src"]) {
    const directory = path.join(sourceRoot, directoryName);
    for (const relativePath of walkFiles(directory)) {
      const fileName = path.basename(relativePath);
      if (/^m42-.+\.test\.tsx?$/.test(fileName))
        candidates.push(normalize(path.join(directoryName, relativePath)));
    }
  }
  return [...new Set(candidates)].sort();
}

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

function writeStepLog(logDirectory, record) {
  atomicWrite(
    path.join(logDirectory, `${record.id}.log`),
    [
      `Step: ${record.id}`,
      `Command: ${record.command.join(" ")}`,
      `Started: ${record.startedAt}`,
      `Completed: ${record.completedAt}`,
      `Duration ms: ${record.durationMs}`,
      `Exit code: ${record.exitCode}`,
      "",
      "STDOUT",
      record.stdout,
      "",
      "STDERR",
      record.stderr,
      "",
    ].join("\n"),
  );
}

function verifySchemaReport(output) {
  const reportPath = path.join(output, "M4_2_SCHEMA_INTEGRITY.json");
  assert(
    fs.existsSync(reportPath),
    "M4.2 schema-integrity step did not produce its evidence report.",
  );
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert(
    report.reportId === "M42-SCHEMA-INTEGRITY" &&
      report.milestone === "M4.2" &&
      report.evidenceClass === "synthetic_document_knowledge_demo" &&
      report.passed === true &&
      report.disposition === "NO_SCHEMA_CHANGE_REQUIRED" &&
      report.inheritedMigrationCount === 11 &&
      report.inheritedMigrationHead ===
        "0010_m41c_clinical_intelligence_fabric.sql" &&
      Array.isArray(report.m42MigrationFiles) &&
      report.m42MigrationFiles.length === 0 &&
      /^[a-f0-9]{64}$/.test(report.schemaSha256) &&
      report.databaseWrites === 0 &&
      report.productionRows === 0 &&
      report.usesProductionData === false,
    "M4.2 schema-integrity report is incomplete or outside the synthetic boundary.",
  );
  return report;
}

export function runM42Qa(options) {
  const sourceRoot = sourceRootFor(options.root);
  assert(
    !isWithin(sourceRoot, options.output),
    "M4.2 QA output cannot be written inside the canonical source tree.",
  );
  const focusedTests = discoverFocusedM42Tests(sourceRoot);
  assert(focusedTests.length > 0, "No focused M4.2 tests were discovered.");
  assert(
    new Set(focusedTests).size === focusedTests.length,
    "M4.2 focused test discovery contains duplicates.",
  );
  for (const required of REQUIRED_FOCUSED_TESTS)
    assert(
      focusedTests.includes(required),
      `M4.2 focused QA omitted ${required}.`,
    );

  const logDirectory = path.join(options.output, "Verification_Logs");
  fs.mkdirSync(logDirectory, { recursive: true });
  const steps = [
    {
      id: "inherited_m41c_baseline",
      command: "npm",
      args: ["run", "test:m4.1c"],
    },
    {
      id: "schema_integrity",
      command: process.execPath,
      args: [
        "scripts/m42-verify-schema.mjs",
        "--root",
        options.root,
        "--output",
        options.output,
      ],
    },
    {
      id: "focused_m42_tests",
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
        "scripts/m42-export-evidence.ts",
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
        "scripts/m42-verify-evidence.ts",
        "--root",
        options.root,
        "--output",
        options.output,
      ],
    },
  ];
  assert(
    JSON.stringify(steps.map((step) => step.id)) ===
      JSON.stringify(M42_REQUIRED_QA_STEPS),
    "M4.2 QA step order drifted.",
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
          path.join(os.tmpdir(), "npm-cache-amos-m42"),
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
    writeStepLog(logDirectory, record);
    if (record.id === "schema_integrity" && record.exitCode === 0)
      verifySchemaReport(options.output);
    if (record.exitCode !== 0) break;
  }

  const report = {
    schemaVersion: "1.0",
    reportId: "M42-INTEGRATED-QA",
    milestone: "M4.2",
    evidenceClass: "synthetic_document_knowledge_demo",
    productionRows: 0,
    liveWrites: 0,
    usesProductionData: false,
    startedAt,
    completedAt: new Date().toISOString(),
    focusedTests,
    requiredSteps: M42_REQUIRED_QA_STEPS,
    schemaReport: "M4_2_SCHEMA_INTEGRITY.json",
    passed:
      results.length === steps.length &&
      results.every((result) => result.exitCode === 0),
    steps: results.map(({ stdout: _stdout, stderr: _stderr, ...result }) => ({
      ...result,
      log: normalize(path.join("Verification_Logs", `${result.id}.log`)),
    })),
  };
  atomicWrite(
    path.join(options.output, "M4_2_INTEGRATED_QA.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const report = runM42Qa(parseM42QaOptions(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
