import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ACCEPTED_M51B_SCHEMA_SHA256 =
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

export function verifyM52Schema(options) {
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
  const m52Migrations = migrations.filter((name) =>
    /m5[_-]?2|m52|mobile[_-]?offline/i.test(name),
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
    m52Migrations.length === 0,
    "M5.2 must not add a database migration for the deterministic offline prototype.",
  );
  const schema = fs.readFileSync(path.join(sourceRoot, "db", "schema.ts"));
  const schemaSha256 = createHash("sha256").update(schema).digest("hex");
  assert(
    schemaSha256 === ACCEPTED_M51B_SCHEMA_SHA256,
    `M5.2 schema drifted from the accepted M5.1B baseline: ${schemaSha256}.`,
  );
  const milestoneRoot =
    sourceRoot === options.root ? path.dirname(sourceRoot) : options.root;
  const acceptedSchemaPath = path.join(
    path.dirname(milestoneRoot),
    "M5.1B_Microsoft_365_Integration",
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
      acceptedSchemaSha256 === ACCEPTED_M51B_SCHEMA_SHA256,
      "The local accepted M5.1B schema does not match its controlled SHA-256.",
    );
    assert(
      acceptedSchemaSha256 === schemaSha256,
      "M5.2 schema is not byte-identical to the local accepted M5.1B schema.",
    );
    acceptedBaselineCompared = true;
  }
  const report = {
    schemaVersion: "1.0",
    reportId: "M52-SCHEMA-INTEGRITY",
    milestone: "M5.2",
    evidenceClass: "synthetic_mobile_offline_prototype",
    passed: true,
    disposition: "NO_SCHEMA_CHANGE_REQUIRED",
    inheritedMigrationCount: migrations.length,
    inheritedMigrationHead: migrations[migrations.length - 1],
    m52MigrationFiles: m52Migrations,
    schemaSha256,
    acceptedM51bSchemaSha256: ACCEPTED_M51B_SCHEMA_SHA256,
    acceptedBaselineCompared,
    databaseWrites: 0,
    productionRows: 0,
    usesProductionData: false,
    liveDeviceEnrollments: 0,
    physicalDeviceWipes: 0,
    deployments: 0,
  };
  atomicWrite(
    path.join(options.output, "M5_2_SCHEMA_INTEGRITY.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}

const invoked = process.argv[1];
if (invoked && pathToFileURL(path.resolve(invoked)).href === import.meta.url) {
  try {
    process.stdout.write(
      `${JSON.stringify(verifyM52Schema(parse(process.argv.slice(2))), null, 2)}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `M5.2 schema verification failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
