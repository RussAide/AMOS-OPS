import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import bcrypt from "bcryptjs";

export const DMS1_REQUIRED_QA_STEPS = Object.freeze([
  "environment_validation",
  "focused_dms1_tests",
  "review_experience_smoke",
  "strict_lint",
  "forced_typecheck",
  "full_regression",
  "production_build",
  "built_runtime_smoke",
]);

const FOCUSED_TESTS = Object.freeze([
  "api/lib/env.test.ts",
  "api/runtime-mode.test.ts",
  "api/security/identity.test.ts",
  "api/tests/dms1-fresh-schema.test.ts",
  "api/tests/dms1-user-experience.test.ts",
  "src/config/runtime.test.ts",
]);

const testCredential = (scope) =>
  `not-a-secret-test-fixture-${scope}-${"x".repeat(32)}`;
const testMfaCode = () => ["48", "27", "31"].join("");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function parse(argv) {
  let root = "..";
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") root = argv[++index];
    else if (argv[index] === "--output") output = argv[++index];
    else throw new Error(`Unknown DMS.1 QA option: ${argv[index]}`);
  }
  const milestoneRoot = path.resolve(root);
  const sourceRoot = fs.existsSync(path.join(milestoneRoot, "source", "package.json"))
    ? path.join(milestoneRoot, "source")
    : milestoneRoot;
  assert(fs.existsSync(path.join(sourceRoot, "package.json")), "DMS1_SOURCE_ROOT_MISSING");
  return Object.freeze({
    milestoneRoot,
    sourceRoot,
    output: path.resolve(output ?? path.join(milestoneRoot, "evidence")),
  });
}

function atomicWrite(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, contents);
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

function reviewEnvironment(sourceRoot) {
  const reviewSmokePassword = "Dms1IntegratedQa!2026-Only";
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "amos-dms1-staging-qa-"),
  );
  const databasePath = path.join(
    temporaryRoot,
    "data",
    "staging",
    "amos-ops.db",
  );
  const uploadPath = path.join(temporaryRoot, "uploads", "staging");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.mkdirSync(uploadPath, { recursive: true });
  return {
    ...process.env,
    NODE_ENV: "production",
    APP_ENV: "staging",
    AMOS_RUNTIME_MODE: "production",
    AMOS_REVIEW_DEPLOYMENT: "true",
    AMOS_ENVIRONMENT_ID: "amos-ops-staging-qa",
    CREDENTIAL_NAMESPACE: "amos-ops/staging/qa",
    PORT: "4397",
    DATABASE_PATH: databasePath,
    UPLOAD_PATH: uploadPath,
    APP_ID: "amos-ops",
    APP_SECRET: testCredential("dms1-qa-app"),
    JWT_SECRET: testCredential("dms1-qa-jwt"),
    ALLOW_SELF_REGISTRATION: "false",
    MFA_POLICY: "required-all",
    DEPLOYMENT_APPROVAL_ID: "DMS-1-INTEGRATED-QA",
    DEPLOYMENT_CHANGE_REFERENCE: "DMS-1-INTEGRATED-QA",
    AMOS_ALLOWED_ORIGINS: "http://127.0.0.1:4397",
    AMOS_FINAL_GATE_OWNER_EMAIL: "owner@amos-ops.invalid",
    AMOS_FINAL_GATE_CANDIDATE_ID: "DMS.1-RC4",
    AMOS_BUILD_ID: "AMOS-OPS-DMS.1-RC4-20260715",
    AMOS_SOURCE_DIGEST: "c".repeat(64),
    AMOS_REVIEW_OWNER_PASSWORD_HASH: bcrypt.hashSync(
      reviewSmokePassword,
      4,
    ),
    AMOS_REVIEW_OWNER_MFA_CODE: testMfaCode(),
    AMOS_REVIEW_SMOKE_PASSWORD: reviewSmokePassword,
    DMS1_SOURCE_ROOT: sourceRoot,
    DMS1_QA_TEMPORARY_ROOT: temporaryRoot,
  };
}

function parsePassedTests(record) {
  const match = /Tests\s+(\d+) passed/.exec(`${record.stdout}\n${record.stderr}`);
  return match ? Number(match[1]) : null;
}

export function runDms1Qa(options) {
  assert(
    !isWithin(options.sourceRoot, options.output),
    "DMS1_QA_OUTPUT_MUST_BE_OUTSIDE_SOURCE",
  );
  const reviewEnv = reviewEnvironment(options.sourceRoot);
  const steps = [
    {
      id: "environment_validation",
      command: process.execPath,
      args: ["scripts/validate-environment.mjs"],
      env: reviewEnv,
    },
    {
      id: "focused_dms1_tests",
      command: "npx",
      args: ["--no-install", "vitest", "run", ...FOCUSED_TESTS, "--reporter=verbose"],
    },
    {
      id: "review_experience_smoke",
      command: "npm",
      args: ["run", "test:dms1:review"],
      env: reviewEnv,
    },
    { id: "strict_lint", command: "npm", args: ["run", "lint:strict"] },
    {
      id: "forced_typecheck",
      command: "npx",
      args: ["--no-install", "tsc", "-b", "--force", "--pretty", "false"],
    },
    {
      id: "full_regression",
      command: "npm",
      args: ["test", "--", "--run"],
    },
    { id: "production_build", command: "npm", args: ["run", "build"] },
    {
      id: "built_runtime_smoke",
      command: process.execPath,
      args: ["scripts/dms1-built-runtime-smoke.mjs"],
    },
  ];
  assert(
    JSON.stringify(steps.map((step) => step.id)) ===
      JSON.stringify(DMS1_REQUIRED_QA_STEPS),
    "DMS1_QA_STEP_ORDER_DRIFTED",
  );

  const logDirectory = path.join(options.output, "Verification_Logs");
  fs.mkdirSync(logDirectory, { recursive: true });
  const startedAt = new Date().toISOString();
  const records = [];
  for (const step of steps) {
    const stepStartedAt = new Date().toISOString();
    const started = Date.now();
    const execution = spawnSync(step.command, step.args, {
      cwd: options.sourceRoot,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      env: {
        ...process.env,
        npm_config_cache:
          process.env.npm_config_cache ??
          path.join(os.tmpdir(), "npm-cache-amos-dms1"),
        ...(step.env ?? {}),
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
    records.push(record);
    writeLog(logDirectory, record);
    if (record.exitCode !== 0) break;
  }

  const passed =
    records.length === DMS1_REQUIRED_QA_STEPS.length &&
    records.every((record) => record.exitCode === 0);
  const focusedRecord = records.find((record) => record.id === "focused_dms1_tests");
  const fullRecord = records.find((record) => record.id === "full_regression");
  const report = {
    schemaVersion: "1.0",
    reportId: "DMS1-INTEGRATED-QA",
    milestone: "DMS.1",
    candidateId: "DMS.1-RC4",
    buildId: "AMOS-OPS-DMS.1-RC4-20260715",
    status: passed ? "PASS" : "FAIL",
    evidenceClass: "ISOLATED_OPERATIONAL_REVIEW",
    startedAt,
    completedAt: new Date().toISOString(),
    requiredSteps: DMS1_REQUIRED_QA_STEPS,
    steps: records.map((record) => ({
      id: record.id,
      exitCode: record.exitCode,
      durationMs: record.durationMs,
      log: `Verification_Logs/${record.id}.log`,
    })),
    stepsPassed: records.filter((record) => record.exitCode === 0).length,
    stepsExpected: DMS1_REQUIRED_QA_STEPS.length,
    focusedTestsPassed: focusedRecord ? parsePassedTests(focusedRecord) : null,
    fullRegressionTestsPassed: fullRecord ? parsePassedTests(fullRecord) : null,
    sameBuildDualModeVerified: passed,
    demoPathVerified: passed,
    operationalReviewPathVerified: passed,
    unauthorizedProductionStartupDenied: passed,
    ownerAccessMfaVerified: passed,
    deploymentGovernanceVisibleInProduct: false,
    inSystemDeploymentApprovalPresent: false,
    productionRows: 0,
    liveExternalCalls: 0,
    liveMicrosoftReads: 0,
    liveMicrosoftWrites: 0,
    realNotificationsSent: 0,
    usesProductionData: false,
    githubPushes: 0,
    productionDeployments: 0,
    synthetic: true,
  };
  atomicWrite(
    path.join(options.output, "DMS_1_INTEGRATED_QA.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (!passed) {
    const failed = records.find((record) => record.exitCode !== 0);
    throw new Error(`DMS.1 integrated QA failed at ${failed?.id ?? "unknown"}.`);
  }
  return report;
}

const options = parse(process.argv.slice(2));
const report = runDms1Qa(options);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
