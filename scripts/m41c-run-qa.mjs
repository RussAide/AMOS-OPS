import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const M41C_REQUIRED_QA_STEPS = Object.freeze([
  "inherited_m41b_baseline",
  "migration_integrity",
  "focused_m41c_tests",
  "typecheck",
  "strict_lint",
  "full_regression",
  "client_build",
  "server_build",
  "evidence_export",
  "evidence_verification",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseM41cQaOptions(argv) {
  let root;
  let output;
  let migrationOnly = false;
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--migration-only") {
      migrationOnly = true;
    } else if (argument === "--root" || argument === "--output") {
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
  return {
    root: resolvedRoot,
    output: path.resolve(output),
    migrationOnly,
  };
}

function sourceRootFor(root) {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M4.1C source root is missing under ${root}.`);
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
    }
  };
  visit(root);
  return result;
}

export function discoverFocusedM41cTests(sourceRoot) {
  const candidates = [];
  for (const directoryName of ["api/tests", "src"]) {
    const directory = path.join(sourceRoot, directoryName);
    for (const relativePath of walkFiles(directory)) {
      const fileName = path.basename(relativePath);
      if (/^m41c-.+\.test\.tsx?$/.test(fileName))
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

function hashFile(filePath) {
  const contents = fs.readFileSync(filePath);
  return {
    bytes: contents.length,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
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

function writeMigrationReport(output, migrationDatabase, record) {
  assert(
    record.exitCode === 0 && fs.existsSync(migrationDatabase),
    "M4.1C migration verification did not produce a passing transient database.",
  );
  let result;
  try {
    result = JSON.parse(record.stdout);
  } catch (error) {
    throw new Error(
      `M4.1C migration verification did not emit valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  assert(
    result?.milestone === "M4.1C" &&
      result.evidenceClass === "synthetic_clinical_demo" &&
      result.passed === true &&
      result.productionRows === 0 &&
      result.liveWrites === 0 &&
      result.foreignKeyViolations === 0 &&
      Array.isArray(result.tables) &&
      result.tables.length === 12 &&
      Object.values(result.controls ?? {}).every(Boolean),
    "M4.1C migration verification result is not complete passing synthetic evidence.",
  );
  const databaseHash = hashFile(migrationDatabase);
  const report = {
    schemaVersion: "1.0",
    reportId: "M41C-MIGRATION-VERIFICATION",
    milestone: "M4.1C",
    evidenceClass: "synthetic_clinical_demo",
    productionRows: 0,
    liveWrites: 0,
    usesProductionData: false,
    generatedAt: record.completedAt,
    command: record.command,
    passed: true,
    databaseArtifact: {
      lifecycle: "transient_verification_only",
      retained: false,
      bytes: databaseHash.bytes,
      sha256: databaseHash.sha256,
    },
    result,
    log: "Verification_Logs/migration_integrity.log",
  };
  atomicWrite(
    path.join(output, "M4_1C_MIGRATION_VERIFICATION.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}

function executeMigrationVerification(sourceRoot, root, output) {
  assert(
    !isWithin(sourceRoot, output),
    "M4.1C migration evidence cannot be written inside the canonical source tree.",
  );
  const logDirectory = path.join(output, "Verification_Logs");
  fs.mkdirSync(logDirectory, { recursive: true });
  const migrationDatabase = path.join(
    os.tmpdir(),
    `amos-m41c-migration-${process.pid}-${Date.now()}.db`,
  );
  const command = [
    process.execPath,
    "scripts/m41c-verify-migrations.mjs",
    "--root",
    root,
    "--output",
    migrationDatabase,
  ];
  const startedAt = new Date().toISOString();
  const started = Date.now();
  try {
    const execution = spawnSync(command[0], command.slice(1), {
      cwd: sourceRoot,
      encoding: "utf8",
      maxBuffer: 200 * 1024 * 1024,
      env: {
        ...process.env,
        npm_config_cache:
          process.env.npm_config_cache ??
          path.join(os.tmpdir(), "npm-cache-amos-m41c"),
      },
    });
    const record = {
      id: "migration_integrity",
      command,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      exitCode: execution.status ?? 1,
      stdout: execution.stdout ?? "",
      stderr: execution.stderr ?? "",
    };
    writeStepLog(logDirectory, record);
    if (record.exitCode !== 0)
      throw new Error(
        `M4.1C migration verification failed (${record.exitCode}).`,
      );
    return writeMigrationReport(output, migrationDatabase, record);
  } finally {
    for (const suffix of ["", "-shm", "-wal"])
      fs.rmSync(`${migrationDatabase}${suffix}`, { force: true });
  }
}

export function runM41cMigrationVerification(options) {
  return executeMigrationVerification(
    sourceRootFor(options.root),
    options.root,
    options.output,
  );
}

export function runM41cQa(options) {
  const sourceRoot = sourceRootFor(options.root);
  assert(
    !isWithin(sourceRoot, options.output),
    "M4.1C QA output cannot be written inside the canonical source tree.",
  );
  const focusedTests = discoverFocusedM41cTests(sourceRoot);
  assert(focusedTests.length > 0, "No focused M4.1C tests were discovered.");
  const logDirectory = path.join(options.output, "Verification_Logs");
  fs.mkdirSync(logDirectory, { recursive: true });
  const migrationDatabase = path.join(
    os.tmpdir(),
    `amos-m41c-qa-${process.pid}-${Date.now()}.db`,
  );
  const steps = [
    {
      id: "inherited_m41b_baseline",
      command: "npm",
      args: ["run", "test:m4.1b"],
    },
    {
      id: "migration_integrity",
      command: process.execPath,
      args: [
        "scripts/m41c-verify-migrations.mjs",
        "--root",
        options.root,
        "--output",
        migrationDatabase,
      ],
    },
    {
      id: "focused_m41c_tests",
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
        "scripts/m41c-export-evidence.ts",
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
        "scripts/m41c-verify-evidence.ts",
        "--root",
        options.root,
        "--output",
        options.output,
      ],
    },
  ];
  assert(
    JSON.stringify(steps.map((step) => step.id)) ===
      JSON.stringify(M41C_REQUIRED_QA_STEPS),
    "M4.1C QA step order drifted.",
  );

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
          npm_config_cache:
            process.env.npm_config_cache ??
            path.join(os.tmpdir(), "npm-cache-amos-m41c"),
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
      if (record.id === "migration_integrity" && record.exitCode === 0)
        writeMigrationReport(options.output, migrationDatabase, record);
      if (record.exitCode !== 0) break;
    }
  } finally {
    for (const suffix of ["", "-shm", "-wal"])
      fs.rmSync(`${migrationDatabase}${suffix}`, { force: true });
  }

  const report = {
    schemaVersion: "1.0",
    reportId: "M41C-INTEGRATED-QA",
    milestone: "M4.1C",
    evidenceClass: "synthetic_clinical_demo",
    productionRows: 0,
    liveWrites: 0,
    usesProductionData: false,
    startedAt,
    completedAt: new Date().toISOString(),
    focusedTests,
    requiredSteps: M41C_REQUIRED_QA_STEPS,
    migrationLog: "Verification_Logs/migration_integrity.log",
    migrationReport: "M4_1C_MIGRATION_VERIFICATION.json",
    passed:
      results.length === steps.length &&
      results.every((result) => result.exitCode === 0),
    steps: results.map(({ stdout: _stdout, stderr: _stderr, ...result }) => ({
      ...result,
      log: normalize(path.join("Verification_Logs", `${result.id}.log`)),
    })),
  };
  atomicWrite(
    path.join(options.output, "M4_1C_INTEGRATED_QA.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseM41cQaOptions(process.argv.slice(2));
    const report = options.migrationOnly
      ? runM41cMigrationVerification(options)
      : runM41cQa(options);
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
