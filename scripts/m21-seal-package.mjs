import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const sourceRoot = process.cwd();
const milestoneRoot = path.resolve(sourceRoot, "..");
const milestoneWorkspace = path.resolve(milestoneRoot, "..");
const evidenceRoot = path.join(milestoneRoot, "evidence");
const baselineSourceRoot = path.join(
  milestoneWorkspace,
  "M1.3_MGMA_Baseline_Established",
  "source",
);
const sourceControlRoot = path.join(evidenceRoot, "07_Source_Control");
const qaRoot = path.join(evidenceRoot, "90_Manifest_and_QA");
const snapshotName = "AMOS-OPS_M2_1_Evaluation_Source_Snapshot_v1_0.zip";
const snapshotPath = path.join(sourceControlRoot, snapshotName);
const packageName =
  "12-AMOS-OPS_M2_1_CCMG_Oversight_Operational_Package_v1_0";
const packageContainer = path.join(milestoneRoot, "package");
const packageRoot = path.join(packageContainer, packageName);
const packageZip = path.join(packageContainer, `${packageName}.zip`);
const packageSidecar = `${packageZip}.sha256`;
const sealResultPath = path.join(milestoneRoot, "M2_1_SEAL_RESULT.json");

const excludedDirectories = new Set([
  ".git",
  ".cache",
  "coverage",
  "data",
  "dist",
  "dist-server",
  "node_modules",
  "uploads",
]);

function normalize(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function excluded(relativePath) {
  if (!relativePath) return false;
  const normalized = normalize(relativePath);
  const segments = normalized.split("/");
  if (segments.some((segment) => excludedDirectories.has(segment))) return true;
  const fileName = segments.at(-1) ?? "";
  return (
    fileName.endsWith(".tsbuildinfo") ||
    fileName.endsWith(".log") ||
    fileName.endsWith(".db") ||
    fileName.endsWith(".db-shm") ||
    fileName.endsWith(".db-wal") ||
    fileName === ".DS_Store"
  );
}

function assertPathExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} does not exist: ${targetPath}`);
  }
}

function assertPathAbsent(targetPath, label) {
  if (fs.existsSync(targetPath)) {
    throw new Error(`${label} already exists; sealing is fail-closed: ${targetPath}`);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status ?? "unknown"}).\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout ?? "";
}

function hashFile(filePath) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function walkFiles(root) {
  const files = [];
  const visit = (directory) => {
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = normalize(path.relative(root, absolutePath));
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) files.push(relativePath);
    }
  };
  visit(root);
  return files;
}

function fileMap(root) {
  return new Map(
    walkFiles(root).map((relativePath) => {
      const filePath = path.join(root, relativePath);
      return [
        relativePath,
        {
          bytes: fs.statSync(filePath).size,
          sha256: hashFile(filePath),
        },
      ];
    }),
  );
}

function copyFiltered(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    preserveTimestamps: true,
    filter: (sourcePath) => {
      const relativePath = path.relative(source, sourcePath);
      return !excluded(relativePath);
    },
  });
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function writeCsv(filePath, headers, rows) {
  const value = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  fs.writeFileSync(filePath, `${value}\n`);
}

function compareMaps(expected, actual, label) {
  const expectedPaths = [...expected.keys()].sort();
  const actualPaths = [...actual.keys()].sort();
  if (JSON.stringify(expectedPaths) !== JSON.stringify(actualPaths)) {
    throw new Error(`${label} file inventory differs after restoration.`);
  }
  for (const relativePath of expectedPaths) {
    const expectedValue = expected.get(relativePath);
    const actualValue = actual.get(relativePath);
    if (
      !expectedValue ||
      !actualValue ||
      expectedValue.bytes !== actualValue.bytes ||
      expectedValue.sha256 !== actualValue.sha256
    ) {
      throw new Error(`${label} byte/hash mismatch: ${relativePath}`);
    }
  }
}

assertPathExists(evidenceRoot, "Evidence root");
assertPathExists(baselineSourceRoot, "Accepted M1.3 source root");
assertPathExists(
  path.join(qaRoot, "QA_COMMAND_RESULTS.json"),
  "Final QA command results",
);
assertPathAbsent(snapshotPath, "M2.1 source snapshot");
assertPathAbsent(packageRoot, "M2.1 editable package");
assertPathAbsent(packageZip, "M2.1 sealed package ZIP");
assertPathAbsent(packageSidecar, "M2.1 package checksum sidecar");
assertPathAbsent(sealResultPath, "M2.1 seal result");

fs.mkdirSync(sourceControlRoot, { recursive: true });
fs.mkdirSync(packageContainer, { recursive: true });
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "amos-m21-seal-"));
const currentStage = path.join(temporaryRoot, "current-source");
const baselineStage = path.join(temporaryRoot, "baseline-source");
const snapshotRestore = path.join(temporaryRoot, "snapshot-restore");
const packageRestore = path.join(temporaryRoot, "package-restore");

copyFiltered(sourceRoot, currentStage);
copyFiltered(baselineSourceRoot, baselineStage);

const currentSourceMap = fileMap(currentStage);
const baselineSourceMap = fileMap(baselineStage);
const allSourcePaths = [
  ...new Set([...currentSourceMap.keys(), ...baselineSourceMap.keys()]),
].sort();
const changeRows = [];
for (const relativePath of allSourcePaths) {
  const baseline = baselineSourceMap.get(relativePath);
  const current = currentSourceMap.get(relativePath);
  if (baseline?.sha256 === current?.sha256) continue;
  changeRows.push([
    relativePath,
    baseline ? (current ? "MODIFIED" : "DELETED") : "ADDED",
    baseline?.bytes ?? "",
    current?.bytes ?? "",
    baseline?.sha256 ?? "",
    current?.sha256 ?? "",
  ]);
}
writeCsv(
  path.join(sourceControlRoot, "M1_3_TO_M2_1_CHANGE_INVENTORY.csv"),
  [
    "relative_path",
    "change_type",
    "baseline_bytes",
    "m2_1_bytes",
    "baseline_sha256",
    "m2_1_sha256",
  ],
  changeRows,
);

run("zip", ["-q", "-X", "-r", snapshotPath, "."], { cwd: currentStage });
run("unzip", ["-tq", snapshotPath]);
fs.mkdirSync(snapshotRestore, { recursive: true });
run("unzip", ["-q", snapshotPath, "-d", snapshotRestore]);
const restoredSourceMap = fileMap(snapshotRestore);
compareMaps(currentSourceMap, restoredSourceMap, "Source snapshot");

const snapshotListing = run("unzip", ["-Z1", snapshotPath])
  .split(/\r?\n/)
  .filter(Boolean);
const snapshotDirectories = snapshotListing.filter((entry) =>
  entry.endsWith("/"),
).length;
const snapshotFiles = snapshotListing.length - snapshotDirectories;
const snapshotBytes = fs.statSync(snapshotPath).size;
const snapshotSha256 = hashFile(snapshotPath);
const added = changeRows.filter((row) => row[1] === "ADDED").length;
const modified = changeRows.filter((row) => row[1] === "MODIFIED").length;
const deleted = changeRows.filter((row) => row[1] === "DELETED").length;

fs.writeFileSync(
  path.join(sourceControlRoot, "SOURCE_SNAPSHOT_RECORD.md"),
  `# M2.1 Source Snapshot Record

| Field | Value |
|---|---|
| Snapshot | \`${snapshotName}\` |
| SHA-256 | \`${snapshotSha256}\` |
| Bytes | ${snapshotBytes.toLocaleString("en-US")} |
| ZIP entries | ${snapshotListing.length} |
| Files | ${snapshotFiles} |
| Directories | ${snapshotDirectories} |
| Accepted baseline | M1.3 v1.0 |
| Accepted baseline source SHA-256 | \`983a8a05f7c9241aefe6da0f07d2ccd8f2570b2ba4669315eed4ab77d57091df\` |
| Change inventory | ${added} added; ${modified} modified; ${deleted} deleted |
| Data posture | Fictional and synthetic demonstration data only |

The snapshot excludes dependency folders, compiled build output, runtime databases and uploads, Git metadata, TypeScript build-info files, logs, caches, and coverage output. It includes the package lock, example environment templates, implementation source, migrations, automated tests, and reproducible M2.1 evidence and sealing scripts.

Validation: ZIP integrity passed and every restored file matched the filtered working source by relative path, byte count, and SHA-256. No GitHub action, deployment, live migration, or real-data operation occurred.
`,
);

fs.cpSync(evidenceRoot, packageRoot, {
  recursive: true,
  preserveTimestamps: true,
});

const manifestPath = path.join(qaRoot, "PACKAGE_MANIFEST.csv");
const packageManifestPath = path.join(
  packageRoot,
  "90_Manifest_and_QA",
  "PACKAGE_MANIFEST.csv",
);
const packageChecksumsPath = path.join(
  packageRoot,
  "90_Manifest_and_QA",
  "SHA256SUMS.txt",
);
const manifestFiles = walkFiles(packageRoot).filter(
  (relativePath) =>
    relativePath !== "90_Manifest_and_QA/PACKAGE_MANIFEST.csv" &&
    relativePath !== "90_Manifest_and_QA/SHA256SUMS.txt",
);
writeCsv(
  packageManifestPath,
  ["relative_path", "bytes", "sha256"],
  manifestFiles.map((relativePath) => {
    const filePath = path.join(packageRoot, relativePath);
    return [relativePath, fs.statSync(filePath).size, hashFile(filePath)];
  }),
);
fs.copyFileSync(packageManifestPath, manifestPath);

const checksumFiles = walkFiles(packageRoot).filter(
  (relativePath) => relativePath !== "90_Manifest_and_QA/SHA256SUMS.txt",
);
fs.writeFileSync(
  packageChecksumsPath,
  `${checksumFiles
    .map(
      (relativePath) =>
        `${hashFile(path.join(packageRoot, relativePath))}  ${relativePath}`,
    )
    .join("\n")}\n`,
);

run("zip", ["-q", "-X", "-r", packageZip, packageName], {
  cwd: packageContainer,
});
run("unzip", ["-tq", packageZip]);
const packageSha256 = hashFile(packageZip);
const packageBytes = fs.statSync(packageZip).size;
fs.writeFileSync(
  packageSidecar,
  `${packageSha256}  ${path.basename(packageZip)}\n`,
);

fs.mkdirSync(packageRestore, { recursive: true });
run("unzip", ["-q", packageZip, "-d", packageRestore]);
const restoredPackageRoot = path.join(packageRestore, packageName);
const expectedPackageMap = fileMap(packageRoot);
const restoredPackageMap = fileMap(restoredPackageRoot);
compareMaps(expectedPackageMap, restoredPackageMap, "Sealed package");

const checksumLines = fs
  .readFileSync(
    path.join(restoredPackageRoot, "90_Manifest_and_QA", "SHA256SUMS.txt"),
    "utf8",
  )
  .trim()
  .split(/\r?\n/);
for (const line of checksumLines) {
  const match = line.match(/^([a-f0-9]{64})  (.+)$/);
  if (!match) throw new Error(`Invalid internal checksum line: ${line}`);
  const [, expectedSha256, relativePath] = match;
  const actualSha256 = hashFile(path.join(restoredPackageRoot, relativePath));
  if (actualSha256 !== expectedSha256) {
    throw new Error(`Internal checksum mismatch: ${relativePath}`);
  }
}

const sealResult = {
  status: "PASS",
  sealedAt: new Date().toISOString(),
  dataPosture: "fictional-synthetic-prototype-only",
  sourceSnapshot: {
    fileName: snapshotName,
    bytes: snapshotBytes,
    sha256: snapshotSha256,
    entries: snapshotListing.length,
    files: snapshotFiles,
    directories: snapshotDirectories,
    restoredByteHashMatch: true,
  },
  changeInventory: {
    added,
    modified,
    deleted,
    rows: changeRows.length,
  },
  editablePackage: {
    folderName: packageName,
    files: expectedPackageMap.size,
  },
  sealedPackage: {
    fileName: path.basename(packageZip),
    bytes: packageBytes,
    sha256: packageSha256,
    zipIntegrity: "PASS",
    restoredByteHashMatch: true,
    internalChecksums: checksumLines.length,
  },
  ownerAcceptance: "pending",
};
fs.writeFileSync(sealResultPath, `${JSON.stringify(sealResult, null, 2)}\n`);

console.log(JSON.stringify(sealResult, null, 2));
