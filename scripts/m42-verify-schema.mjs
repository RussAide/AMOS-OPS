import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

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

export function verifyM42Schema(options) {
  const sourceRoot = fs.existsSync(path.join(options.root, "source", "package.json"))
    ? path.join(options.root, "source")
    : options.root;
  const migrationsRoot = path.join(sourceRoot, "db", "migrations");
  const migrations = fs
    .readdirSync(migrationsRoot)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  const m42Migrations = migrations.filter((name) => /m4[_-]?2|m42/i.test(name));
  assert(migrations.length === 11, `Expected 11 inherited migrations; found ${migrations.length}.`);
  assert(migrations.at(-1) === "0010_m41c_clinical_intelligence_fabric.sql", "Inherited migration head drifted.");
  assert(m42Migrations.length === 0, "M4.2 must not introduce a database migration for in-memory fictional controls.");
  const schemaPath = path.join(sourceRoot, "db", "schema.ts");
  const schema = fs.readFileSync(schemaPath);
  const report = {
    schemaVersion: "1.0",
    reportId: "M42-SCHEMA-INTEGRITY",
    milestone: "M4.2",
    evidenceClass: "synthetic_document_knowledge_demo",
    passed: true,
    disposition: "NO_SCHEMA_CHANGE_REQUIRED",
    inheritedMigrationCount: migrations.length,
    inheritedMigrationHead: migrations.at(-1),
    m42MigrationFiles: m42Migrations,
    schemaSha256: createHash("sha256").update(schema).digest("hex"),
    databaseWrites: 0,
    productionRows: 0,
    usesProductionData: false,
  };
  atomicWrite(
    path.join(options.output, "M4_2_SCHEMA_INTEGRITY.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}

const invokedPath = process.argv[1];
if (invokedPath && pathToFileURL(path.resolve(invokedPath)).href === import.meta.url) {
  try {
    process.stdout.write(`${JSON.stringify(verifyM42Schema(parse(process.argv.slice(2))), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`M4.2 schema verification failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
