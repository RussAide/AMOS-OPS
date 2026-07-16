import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ACCEPTED_M51A_SCHEMA_SHA256 =
  "138c2e364b89c085e3c68850bbbb299cb1cf9520c80c9b221fac13df156494ac";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parse(argv) {
  let root = "..";
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") root = argv[++index];
    else if (argv[index] === "--output") output = argv[++index];
    else throw new Error(`Unknown option: ${argv[index]}`);
  }
  const resolvedRoot = path.resolve(root);
  return {
    root: resolvedRoot,
    output: path.resolve(output ?? path.join(resolvedRoot, "evidence")),
  };
}

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

export function verifyM51BSchema(options) {
  const sourceRoot = fs.existsSync(
    path.join(options.root, "source", "package.json"),
  )
    ? path.join(options.root, "source")
    : options.root;
  const migrationsRoot = path.join(sourceRoot, "db", "migrations");
  const migrations = fs
    .readdirSync(migrationsRoot)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  const m51bMigrations = migrations.filter((name) =>
    /m5[_-]?1b|m51b|microsoft[_-]?365[_-]?integration/i.test(name),
  );
  assert(
    migrations.length === 11,
    `Expected 11 inherited migrations; found ${migrations.length}.`,
  );
  assert(
    migrations[migrations.length - 1] ===
      "0010_m41c_clinical_intelligence_fabric.sql",
    "Inherited migration head drifted.",
  );
  assert(
    m51bMigrations.length === 0,
    "M5.1B must not add a database migration for deterministic in-memory integration controls.",
  );
  const schema = fs.readFileSync(path.join(sourceRoot, "db", "schema.ts"));
  const schemaSha256 = createHash("sha256").update(schema).digest("hex");
  assert(
    schemaSha256 === ACCEPTED_M51A_SCHEMA_SHA256,
    `M5.1B schema drifted from the accepted M5.1A baseline: ${schemaSha256}.`,
  );
  const milestoneRoot =
    sourceRoot === options.root ? path.dirname(sourceRoot) : options.root;
  const acceptedSchemaPath = path.join(
    path.dirname(milestoneRoot),
    "M5.1A_Operations_Hub_and_Microsoft_DMS_Connector_Architecture",
    "source",
    "db",
    "schema.ts",
  );
  let acceptedBaselineCompared = false;
  if (fs.existsSync(acceptedSchemaPath)) {
    const acceptedSchemaSha256 = createHash("sha256")
      .update(fs.readFileSync(acceptedSchemaPath))
      .digest("hex");
    assert(
      acceptedSchemaSha256 === ACCEPTED_M51A_SCHEMA_SHA256,
      "The local accepted M5.1A schema artifact does not match its controlled SHA-256.",
    );
    assert(
      acceptedSchemaSha256 === schemaSha256,
      "M5.1B schema is not byte-identical to the local accepted M5.1A schema artifact.",
    );
    acceptedBaselineCompared = true;
  }
  const report = {
    schemaVersion: "1.0",
    reportId: "M51B-SCHEMA-INTEGRITY",
    milestone: "M5.1B",
    evidenceClass: "synthetic_microsoft_365_workflow_integration_demo",
    passed: true,
    disposition: "NO_SCHEMA_CHANGE_REQUIRED",
    inheritedMigrationCount: migrations.length,
    inheritedMigrationHead: migrations[migrations.length - 1],
    m51bMigrationFiles: m51bMigrations,
    schemaSha256,
    acceptedM51aSchemaSha256: ACCEPTED_M51A_SCHEMA_SHA256,
    acceptedBaselineCompared,
    databaseWrites: 0,
    productionRows: 0,
    usesProductionData: false,
    liveGraphCalls: 0,
    liveMicrosoftWrites: 0,
  };
  atomicWrite(
    path.join(options.output, "M5_1B_SCHEMA_INTEGRITY.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}

const invoked = process.argv[1];
if (invoked && pathToFileURL(path.resolve(invoked)).href === import.meta.url) {
  try {
    process.stdout.write(
      `${JSON.stringify(verifyM51BSchema(parse(process.argv.slice(2))), null, 2)}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `M5.1B schema verification failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
