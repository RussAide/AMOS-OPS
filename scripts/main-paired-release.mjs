#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./production-release-manifest.mjs";

const IDENTITY_FIELDS = Object.freeze([
  "schemaVersion",
  "releaseId",
  "commitSha",
  "treeSha",
  "sourceDigest",
  "frontendArtifactDigest",
  "backendArtifactDigest",
]);

function positiveInteger(name, value, fallback, maximum) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer from 1 through ${maximum}.`);
  }
  return parsed;
}

function exactHttpsOrigin(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.origin !== value) {
    throw new Error("origin must be an exact HTTPS origin.");
  }
  return parsed.origin;
}

export function releaseIdentityMatches(actual, expected) {
  return Boolean(
    actual &&
    expected &&
    IDENTITY_FIELDS.every((field) => actual[field] === expected[field]),
  );
}

async function request(url, fetcher) {
  return fetcher(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
}

export async function waitForRelease({
  origin,
  expectedManifest,
  healthPaths = [],
  attempts = 60,
  delayMs = 10_000,
  fetcher = fetch,
  sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
}) {
  const target = exactHttpsOrigin(origin);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const healthResponses = await Promise.all(
        healthPaths.map((healthPath) =>
          request(`${target}${healthPath}`, fetcher),
        ),
      );
      const manifestResponse = await request(
        `${target}/release-manifest.json`,
        fetcher,
      );
      const manifest = manifestResponse.ok
        ? await manifestResponse.json()
        : null;
      if (
        healthResponses.every((response) => response.ok) &&
        manifestResponse.ok &&
        releaseIdentityMatches(manifest, expectedManifest)
      ) {
        return { origin: target, attempts: attempt, manifest };
      }
    } catch {
      // A connected host can transiently return no response while its atomic
      // deployment changes over. Retry without exposing response bodies.
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  throw new Error(
    `The release at ${target} did not become healthy with the expected immutable identity.`,
  );
}

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  const args = parseArgs(argv);
  const manifestPath = path.resolve(args.manifest ?? "");
  if (!args.manifest || !fs.existsSync(manifestPath)) {
    throw new Error("--manifest must identify the sealed release manifest.");
  }
  const expectedManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const attempts = positiveInteger("attempts", args.attempts, 60, 120);
  const delayMs = positiveInteger("delay-ms", args["delay-ms"], 10_000, 60_000);
  if (command === "wait-railway") {
    const result = await waitForRelease({
      origin: args.origin,
      expectedManifest,
      healthPaths: ["/api/health/live", "/api/health/ready"],
      attempts,
      delayMs,
    });
    process.stdout.write(
      `${JSON.stringify({ status: "matched", origin: result.origin, attempts: result.attempts })}\n`,
    );
    return;
  }
  if (command === "verify-static") {
    const result = await waitForRelease({
      origin: args.origin,
      expectedManifest,
      attempts,
      delayMs,
    });
    process.stdout.write(
      `${JSON.stringify({ status: "matched", origin: result.origin, attempts: result.attempts })}\n`,
    );
    return;
  }
  throw new Error("Expected wait-railway or verify-static command.");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
