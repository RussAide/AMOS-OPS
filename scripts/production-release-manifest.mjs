#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHA1 = /^[a-f0-9]{40}$/;
const RELEASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const FILESYSTEM_SOURCE_EXCLUSIONS = new Set([
  ".git",
  ".vite",
  "coverage",
  "dist",
  "dist-server",
  "node_modules",
]);

export function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near ${name ?? "end of command"}.`);
    }
    values[name.slice(2)] = value;
  }
  return values;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function gitObjectHash(type, body) {
  return createHash("sha1")
    .update(`${type} ${body.length}\0`)
    .update(body)
    .digest();
}

function filesystemTreeHash(root, relative = "") {
  const directory = path.join(root, relative);
  const entries = readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        relative !== "" || !FILESYSTEM_SOURCE_EXCLUSIONS.has(entry.name),
    )
    .map((entry) => ({
      entry,
      sortKey: Buffer.from(`${entry.name}${entry.isDirectory() ? "/" : ""}`),
    }))
    .sort(({ sortKey: left }, { sortKey: right }) =>
      Buffer.compare(left, right),
    );
  const tree = [];
  for (const { entry } of entries) {
    const childRelative = path.join(relative, entry.name);
    const child = path.join(root, childRelative);
    let mode;
    let objectHash;
    if (entry.isDirectory()) {
      mode = "40000";
      objectHash = filesystemTreeHash(root, childRelative);
    } else if (entry.isFile()) {
      mode = lstatSync(child).mode & 0o111 ? "100755" : "100644";
      objectHash = gitObjectHash("blob", readFileSync(child));
    } else if (entry.isSymbolicLink()) {
      mode = "120000";
      objectHash = gitObjectHash("blob", Buffer.from(readlinkSync(child)));
    } else {
      throw new Error(`Source contains unsupported entry: ${childRelative}`);
    }
    tree.push(Buffer.from(`${mode} ${entry.name}\0`), objectHash);
  }
  return gitObjectHash("tree", Buffer.concat(tree));
}

export function filesystemSourceIdentity(root) {
  const treeSha = filesystemTreeHash(root).toString("hex");
  if (!SHA1.test(treeSha)) throw new Error("Git tree identity is invalid.");
  return Object.freeze({
    treeSha,
    sourceDigest: sha256(`git-tree:${treeSha}`),
  });
}

export function digestFile(filePath) {
  return sha256(readFileSync(filePath));
}

function listFiles(root, relative = "") {
  const directory = path.join(root, relative);
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) return listFiles(root, child);
      if (entry.isFile()) return [child];
      throw new Error(`Artifact contains unsupported entry: ${child}`);
    })
    .sort();
}

export function digestDirectory(root, excluded = new Set()) {
  if (!existsSync(root))
    throw new Error(`Artifact directory is missing: ${root}`);
  const hash = createHash("sha256");
  for (const relativePath of listFiles(root)) {
    const normalized = relativePath.split(path.sep).join("/");
    if (excluded.has(normalized)) continue;
    const filePath = path.join(root, relativePath);
    const bytes = readFileSync(filePath);
    hash.update(normalized);
    hash.update("\0");
    hash.update(String(bytes.length));
    hash.update("\0");
    hash.update(sha256(bytes));
    hash.update("\n");
  }
  return hash.digest("hex");
}

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: args[0] === "archive" ? undefined : "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

export function createReleaseManifest({
  root,
  releaseId,
  releaseSha,
  sourceMode = "git",
}) {
  if (!RELEASE_ID.test(releaseId ?? "")) {
    throw new Error(
      "release-id must contain 2-128 safe identifier characters.",
    );
  }
  if (!SHA1.test(releaseSha ?? "")) {
    throw new Error(
      "release-sha must be an exact lowercase 40-character Git SHA.",
    );
  }
  let sourceIdentity;
  if (sourceMode === "git") {
    const head = String(git(root, "rev-parse", "HEAD")).trim();
    if (head !== releaseSha) {
      throw new Error(
        `Checked-out HEAD ${head} does not equal release SHA ${releaseSha}.`,
      );
    }
    const worktreeStatus = String(
      git(root, "status", "--porcelain=v1", "--untracked-files=all"),
    ).trim();
    if (worktreeStatus) {
      throw new Error(
        "The release worktree changed after checkout; refusing to seal an artifact that is not the exact release SHA.",
      );
    }
    const treeSha = String(git(root, "rev-parse", "HEAD^{tree}")).trim();
    if (!SHA1.test(treeSha)) throw new Error("Git tree identity is invalid.");
    sourceIdentity = Object.freeze({
      treeSha,
      sourceDigest: sha256(`git-tree:${treeSha}`),
    });
  } else if (sourceMode === "filesystem") {
    sourceIdentity = filesystemSourceIdentity(root);
  } else {
    throw new Error("source-mode must be either git or filesystem.");
  }

  const dist = path.join(root, "dist");
  const frontend = path.join(dist, "public");
  const backend = path.join(dist, "boot.js");
  if (
    !existsSync(frontend) ||
    !existsSync(backend) ||
    !lstatSync(backend).isFile()
  ) {
    throw new Error(
      "The single frontend/backend build must exist before sealing.",
    );
  }

  const manifest = Object.freeze({
    schemaVersion: 1,
    releaseId,
    commitSha: releaseSha,
    treeSha: sourceIdentity.treeSha,
    sourceDigest: sourceIdentity.sourceDigest,
    frontendArtifactDigest: digestDirectory(
      frontend,
      new Set(["release-manifest.json"]),
    ),
    backendArtifactDigest: digestFile(backend),
  });
  const serialized = JSON.stringify(manifest);
  mkdirSync(frontend, { recursive: true });
  const backendManifest = path.join(dist, "release-manifest.json");
  const frontendManifest = path.join(frontend, "release-manifest.json");
  writeFileSync(backendManifest, serialized, { mode: 0o644 });
  copyFileSync(backendManifest, frontendManifest);
  if (!readFileSync(backendManifest).equals(readFileSync(frontendManifest))) {
    throw new Error(
      "Frontend and backend release manifests are not byte-identical.",
    );
  }
  return manifest;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root ?? process.cwd());
  const manifest = createReleaseManifest({
    root,
    releaseId: args["release-id"] ?? process.env.RELEASE_ID,
    releaseSha: args["release-sha"] ?? process.env.RELEASE_SHA,
    sourceMode: args["source-mode"] ?? "git",
  });
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main();
}
