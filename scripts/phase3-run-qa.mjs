import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REQUIRED_STEP_IDS = [
  "migration_integrity",
  "focused_phase3_tests",
  "typecheck",
  "strict_lint",
  "full_regression",
  "client_build",
  "server_build",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function parsePhase3QaOptions(argv) {
  let root;
  let output;
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" || argument === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a path.`);
      if (argument === "--root") root = value;
      else output = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
  }
  root ??= positional[0] ?? "..";
  const resolvedRoot = path.resolve(root);
  output ??= positional[1] ?? path.join(resolvedRoot, "evidence", "shared");
  return { root: resolvedRoot, output: path.resolve(output) };
}

function sourceRootFor(root) {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`Phase 3 source root is missing under ${root}.`);
}

function normalize(value) {
  return value.split(path.sep).join("/");
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) result.push(normalize(path.relative(root, absolute)));
    }
  };
  visit(root);
  return result;
}

export function discoverFocusedPhase3Tests(sourceRoot) {
  const candidates = [];
  for (const directoryName of ["api/tests", "src"]) {
    const directory = path.join(sourceRoot, directoryName);
    for (const relativePath of walkFiles(directory)) {
      const fileName = path.basename(relativePath);
      if (/^(phase3-|m3[1-4]-).+\.test\.tsx?$/.test(fileName)) {
        candidates.push(normalize(path.join(directoryName, relativePath)));
      }
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

export function runPhase3Qa(options) {
  const sourceRoot = sourceRootFor(options.root);
  assert(!isWithin(sourceRoot, options.output), "Phase 3 QA output cannot be written inside the canonical source tree.");
  const focusedTests = discoverFocusedPhase3Tests(sourceRoot);
  assert(focusedTests.length > 0, "No focused Phase 3 tests were discovered.");
  const logDirectory = path.join(options.output, "Verification_Logs");
  fs.mkdirSync(logDirectory, { recursive: true });
  const migrationDatabase = path.join(os.tmpdir(), `amos-phase3-qa-${process.pid}-${Date.now()}.db`);
  const steps = [
    {
      id: "migration_integrity",
      command: process.execPath,
      args: ["scripts/phase3-verify-migrations.mjs", "--root", options.root, "--output", migrationDatabase],
    },
    {
      id: "focused_phase3_tests",
      command: "npx",
      args: ["vitest", "run", ...focusedTests, "--reporter=verbose"],
    },
    { id: "typecheck", command: "npm", args: ["run", "typecheck"] },
    { id: "strict_lint", command: "npm", args: ["run", "lint:strict"] },
    { id: "full_regression", command: "npm", args: ["test", "--", "--reporter=default"] },
    { id: "client_build", command: "npm", args: ["run", "build:client"] },
    { id: "server_build", command: "npm", args: ["run", "build:server"] },
  ];
  assert(JSON.stringify(steps.map((step) => step.id)) === JSON.stringify(REQUIRED_STEP_IDS), "Phase 3 QA step order drifted.");

  const startedAt = new Date().toISOString();
  const results = [];
  try {
    for (const step of steps) {
      const stepStartedAt = new Date().toISOString();
      const started = Date.now();
      const execution = spawnSync(step.command, step.args, {
        cwd: sourceRoot,
        encoding: "utf8",
        maxBuffer: 200 * 1024 * 1024,
        env: {
          ...process.env,
          npm_config_cache: process.env.npm_config_cache ?? path.join(os.tmpdir(), "npm-cache-amos-phase3"),
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
      atomicWrite(
        path.join(logDirectory, `${step.id}.log`),
        [
          `Step: ${step.id}`,
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
      if (record.exitCode !== 0) break;
    }
  } finally {
    for (const suffix of ["", "-shm", "-wal"]) fs.rmSync(`${migrationDatabase}${suffix}`, { force: true });
  }

  const report = {
    schemaVersion: "1.0",
    reportId: "PHASE3-INTEGRATED-QA",
    evidenceClass: "synthetic_demo",
    startedAt,
    completedAt: new Date().toISOString(),
    focusedTests,
    requiredSteps: REQUIRED_STEP_IDS,
    passed: results.length === steps.length && results.every((result) => result.exitCode === 0),
    steps: results.map(({ stdout: _stdout, stderr: _stderr, ...result }) => ({
      ...result,
      log: normalize(path.join("Verification_Logs", `${result.id}.log`)),
    })),
  };
  atomicWrite(path.join(options.output, "PHASE_3_INTEGRATED_QA.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parsePhase3QaOptions(process.argv.slice(2));
    const report = runPhase3Qa(options);
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
