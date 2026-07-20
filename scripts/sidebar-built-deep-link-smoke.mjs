import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import {
  flattenSidebarLinks,
  getSidebarNavigation,
} from "../src/data/sidebar-navigation.ts";

const host = "127.0.0.1";
const rootMarker = '<div id="root"></div>';
const links = flattenSidebarLinks(
  getSidebarNavigation("super-admin", "production"),
);

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("SIDEBAR_DEEP_LINK_PORT_RESERVATION_FAILED"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function verifyNetlifyFallback() {
  const config = fs.readFileSync(path.resolve("netlify.toml"), "utf8");
  if (
    !/from\s*=\s*"\/\*"[\s\S]*?to\s*=\s*"\/index\.html"[\s\S]*?status\s*=\s*200/.test(
      config,
    )
  ) {
    throw new Error("SIDEBAR_DEEP_LINK_NETLIFY_FALLBACK_MISSING");
  }
}

async function waitUntilReady(origin, child, output) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `SIDEBAR_DEEP_LINK_PREVIEW_EXITED:${child.exitCode}\n${output.stdout}\n${output.stderr}`,
      );
    }
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The preview listener is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(
    `SIDEBAR_DEEP_LINK_PREVIEW_NOT_READY\n${output.stdout}\n${output.stderr}`,
  );
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

verifyNetlifyFallback();
const port = await reservePort();
const origin = `http://${host}:${port}`;
const output = { stdout: "", stderr: "" };
const child = spawn(
  process.execPath,
  [
    path.resolve("node_modules/vite/bin/vite.js"),
    "preview",
    "--host",
    host,
    "--port",
    String(port),
  ],
  { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
);
child.stdout.on("data", (chunk) => {
  output.stdout += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output.stderr += chunk.toString();
});

const failures = [];
try {
  await waitUntilReady(origin, child, output);
  for (const link of links) {
    const response = await fetch(`${origin}${link.href}`);
    const body = await response.text();
    if (!response.ok || !body.includes(rootMarker)) {
      failures.push({
        href: link.href,
        status: response.status,
        applicationRoot: body.includes(rootMarker),
      });
    }
  }
} finally {
  await stop(child);
}

const report = {
  schemaVersion: "1.0",
  status: failures.length === 0 ? "PASS" : "FAIL",
  runtime: "built Vite Production client",
  netlifySpaFallback: "PASS",
  checkedDestinations: links.length,
  failures,
};
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
