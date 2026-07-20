// @vitest-environment jsdom

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import superjson from "superjson";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppRouter } from "../../api/router";
import App from "@/App";
import { runtimeConfig } from "@/config/runtime";
import {
  flattenSidebarLinks,
  getSidebarNavigation,
} from "@/data/sidebar-navigation";
import { TRPCProvider } from "@/providers/trpc";

interface RuntimeHarness {
  child: ChildProcess;
  origin: string;
  temporaryRoot: string;
  output: { stdout: string; stderr: string };
}

interface ApiFailure {
  route: string;
  request: string;
  detail: string;
}

const testCredential = (scope: string) =>
  `not-a-secret-sidebar-fixture-${scope}-${"x".repeat(40)}`;
const reviewEmail = "navigation-reviewer@amos-ops.invalid";
const reviewPassword = testCredential("review-password");
const reviewMfaCode = ["58", "39", "27"].join("");
const sourceDigest = "c".repeat(64);
const sidebarLinks = flattenSidebarLinks(
  getSidebarNavigation("super-admin", "production"),
);

let harness: RuntimeHarness;
let originalFetch: typeof fetch;
let originalConsoleError: typeof console.error;
let inFlightRequests = 0;
let activeRoute = "harness-startup";
const apiFailures: ApiFailure[] = [];
const renderFailures: ApiFailure[] = [];

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("SIDEBAR_TEST_PORT_RESERVATION_FAILED"));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function startRuntimeHarness(): Promise<RuntimeHarness> {
  const port = await reservePort();
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "amos-sidebar-integrity-"),
  );
  const origin = `http://127.0.0.1:${port}`;
  const passwordHash = await bcrypt.hash(reviewPassword, 4);
  const databasePath = path.join(
    temporaryRoot,
    "data",
    "staging",
    "amos-ops.db",
  );
  const trainingDatabasePath = path.join(
    temporaryRoot,
    "data",
    "staging",
    "training",
    "amos-ops-training.db",
  );
  const uploadPath = path.join(temporaryRoot, "uploads", "staging");
  const trainingUploadPath = path.join(
    temporaryRoot,
    "uploads",
    "staging",
    "training",
  );
  const backupPath = path.join(temporaryRoot, "backups", "staging");
  for (const directory of [
    path.dirname(databasePath),
    path.dirname(trainingDatabasePath),
    uploadPath,
    trainingUploadPath,
    backupPath,
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const child = spawn(
    process.execPath,
    ["--import", "tsx", "api/boot.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        APP_ENV: "staging",
        AMOS_RUNTIME_MODE: "production",
        AMOS_REVIEW_DEPLOYMENT: "true",
        PORT: String(port),
        APP_ID: "amos-ops",
        APP_SECRET: testCredential("app-secret"),
        JWT_SECRET: testCredential("jwt-secret"),
        ALLOW_SELF_REGISTRATION: "false",
        MFA_POLICY: "required-all",
        DEPLOYMENT_APPROVAL_ID: "SIDEBAR-INTEGRITY-REVIEW",
        DEPLOYMENT_CHANGE_REFERENCE: "SIDEBAR-INTEGRITY-REVIEW",
        AMOS_ALLOWED_ORIGINS: origin,
        AMOS_ENVIRONMENT_ID: "amos-ops-staging-sidebar-integrity",
        CREDENTIAL_NAMESPACE: "amos-ops/staging/sidebar-integrity",
        DATABASE_PATH: databasePath,
        TRAINING_DATABASE_PATH: trainingDatabasePath,
        UPLOAD_PATH: uploadPath,
        TRAINING_UPLOAD_PATH: trainingUploadPath,
        BACKUP_PATH: backupPath,
        AMOS_BUILD_ID: "AMOS-OPS-SIDEBAR-INTEGRITY-TEST",
        AMOS_FINAL_GATE_OWNER_EMAIL: reviewEmail,
        AMOS_FINAL_GATE_CANDIDATE_ID: "SIDEBAR-INTEGRITY-TEST",
        AMOS_SOURCE_DIGEST: sourceDigest,
        AMOS_REVIEW_OWNER_PASSWORD_HASH: passwordHash,
        AMOS_REVIEW_OWNER_MFA_CODE: reviewMfaCode,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const output = { stdout: "", stderr: "" };
  child.stdout?.on("data", (chunk) => {
    output.stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    output.stderr += chunk.toString();
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `SIDEBAR_TEST_SERVER_EXITED:${child.exitCode}\n${output.stdout}\n${output.stderr}`,
      );
    }
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return { child, origin, temporaryRoot, output };
    } catch {
      // Server startup is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill("SIGTERM");
  throw new Error(
    `SIDEBAR_TEST_SERVER_NOT_READY\n${output.stdout}\n${output.stderr}`,
  );
}

async function stopRuntimeHarness(runtime: RuntimeHarness): Promise<void> {
  if (runtime.child.exitCode === null) {
    runtime.child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => runtime.child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
  if (runtime.child.exitCode === null) runtime.child.kill("SIGKILL");
  fs.rmSync(runtime.temporaryRoot, { recursive: true, force: true });
}

function requestLabel(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

function errorDetail(value: unknown): string {
  if (!value || typeof value !== "object") return String(value);
  const record = value as Record<string, unknown>;
  const nested = record.json;
  if (nested && typeof nested === "object") {
    const message = (nested as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  if (typeof record.message === "string") return record.message;
  return JSON.stringify(value);
}

async function inspectApiResponse(
  request: string,
  response: Response,
): Promise<void> {
  if (!request.includes("/api/")) return;
  if (!response.ok) {
    apiFailures.push({
      route: activeRoute,
      request,
      detail: `HTTP ${response.status}`,
    });
  }
  if (!request.includes("/api/trpc")) return;
  try {
    const payload = (await response.clone().json()) as unknown;
    const entries = Array.isArray(payload) ? payload : [payload];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || !("error" in entry)) continue;
      apiFailures.push({
        route: activeRoute,
        request,
        detail: errorDetail((entry as { error: unknown }).error),
      });
    }
  } catch {
    apiFailures.push({
      route: activeRoute,
      request,
      detail: "API response was not valid JSON.",
    });
  }
}

async function waitForNetworkIdle(timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let idleSince = inFlightRequests === 0 ? Date.now() : 0;
  while (Date.now() < deadline) {
    if (inFlightRequests === 0) {
      if (idleSince === 0) idleSince = Date.now();
      if (Date.now() - idleSince >= 100) return;
    } else {
      idleSince = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(
    `SIDEBAR_TEST_NETWORK_IDLE_TIMEOUT:${activeRoute}:${inFlightRequests}`,
  );
}

beforeAll(async () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined,
  });
  class TestResizeObserver implements ResizeObserver {
    observe(): void {
      return undefined;
    }
    unobserve(): void {
      return undefined;
    }
    disconnect(): void {
      return undefined;
    }
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: TestResizeObserver,
  });

  harness = await startRuntimeHarness();
  const anonymous = createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${harness.origin}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });
  const login = await anonymous.auth.login.mutate({
    email: reviewEmail,
    password: reviewPassword,
  });
  if (login.status !== "mfa_required") {
    throw new Error("SIDEBAR_TEST_MFA_CHALLENGE_MISSING");
  }
  const verified = await anonymous.auth.verifyMfa.mutate({
    challengeId: login.challengeId,
    code: reviewMfaCode,
  });
  localStorage.setItem("amos_token", verified.token);
  localStorage.setItem("amos-role", "super-admin");
  localStorage.setItem("amos-workspace", "operational");

  Object.assign(runtimeConfig, {
    initialized: true,
    schemaVersion: 2,
    mode: "production",
    appEnvironment: "staging",
    environmentId: "amos-ops-staging-sidebar-integrity",
    apiUrl: `${harness.origin}/api/trpc`,
    evaluationMode: false,
    productionReleaseAuthorized: false,
    productionReleaseId: null,
    deploymentPosture: "release-review",
    reviewDeployment: true,
    candidateId: "SIDEBAR-INTEGRITY-TEST",
    buildId: "AMOS-OPS-SIDEBAR-INTEGRITY-TEST",
    banner: "AMOS-OPS Operational Workspace",
    safeguards: {
      syntheticDataOnly: true,
      evaluationFallbacksAllowed: false,
      productionDataAllowed: false,
      externalWritesAllowed: false,
    },
  });

  originalFetch = globalThis.fetch.bind(globalThis);
  originalConsoleError = console.error;
  console.error = (...values: unknown[]) => {
    renderFailures.push({
      route: activeRoute,
      request: "console.error",
      detail: values
        .map((value) =>
          value instanceof Error ? value.stack ?? value.message : String(value),
        )
        .join(" "),
    });
  };
  globalThis.fetch = async (input, init) => {
    const request = requestLabel(input);
    inFlightRequests += 1;
    try {
      const response = await originalFetch(input, init);
      await inspectApiResponse(request, response);
      return response;
    } finally {
      inFlightRequests -= 1;
    }
  };
}, 40_000);

afterAll(async () => {
  cleanup();
  localStorage.clear();
  if (originalFetch) globalThis.fetch = originalFetch;
  if (originalConsoleError) console.error = originalConsoleError;
  if (harness) await stopRuntimeHarness(harness);
});

describe("production sidebar authenticated data-load integrity", () => {
  it(
    "loads every sidebar destination without an API or render failure",
    async () => {
      const routeFailures: string[] = [];

      for (const link of sidebarLinks) {
        activeRoute = link.href;
        const firstApiFailure = apiFailures.length;
        const firstRenderFailure = renderFailures.length;
        const view = render(
          <TRPCProvider>
            <MemoryRouter initialEntries={[link.href]}>
              <App />
            </MemoryRouter>
          </TRPCProvider>,
        );
        try {
          const activeLink = await screen.findByRole(
            "button",
            { name: link.label, current: "page" },
            { timeout: 10_000 },
          );
          expect(activeLink.getAttribute("aria-current")).toBe("page");
          await waitForNetworkIdle();
          await waitFor(
            () => {
              const main = view.container.querySelector("main");
              expect(main).not.toBeNull();
              expect(main?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
              expect(view.container.textContent).not.toContain(
                "Something went wrong",
              );
              expect(view.container.textContent).not.toContain("Page not found");
              expect(view.container.textContent).not.toContain("Access denied");
            },
            { timeout: 2_000 },
          );
          const failures = [
            ...apiFailures.slice(firstApiFailure),
            ...renderFailures.slice(firstRenderFailure),
          ];
          if (failures.length > 0) {
            routeFailures.push(
              ...failures.map(
                (failure) =>
                  `${failure.route} -> ${failure.detail} (${failure.request})`,
              ),
            );
          }
        } catch (error) {
          routeFailures.push(
            `${link.href} -> ${error instanceof Error ? error.message : String(error)}`,
          );
        } finally {
          view.unmount();
          cleanup();
        }
      }

      expect(routeFailures).toEqual([]);
    },
    120_000,
  );
});
