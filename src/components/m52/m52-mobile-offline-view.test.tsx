import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  advanceM52MedicationPass,
  applyM52ReconciliationEvidence,
  completeM52Reconnect,
  createM52MedicationPassScenario,
  currentM52MedicationPassStep,
  runM52MedicationPassScenario,
  setM52ConnectionMode,
  updateM52MedicationOutcome,
  verifyM52MedicationPassControl,
  type M52MedicationPassScenario,
} from "./m52-mobile-offline-model";
import {
  M52MobileOfflineView,
  type M52MobileOfflineViewProps,
} from "./m52-mobile-offline-view";

function props(
  overrides: Partial<M52MobileOfflineViewProps> = {},
): M52MobileOfflineViewProps {
  return {
    scenario: createM52MedicationPassScenario(),
    batteryPercent: 76,
    installAvailable: false,
    onVerifyControl: () => undefined,
    onAdvance: () => undefined,
    onReset: () => undefined,
    onConnectionChange: () => undefined,
    onCompleteReconnect: () => undefined,
    onRequestConflictReview: () => undefined,
    onUpdateOutcome: () => undefined,
    onCaptureAttestation: () => undefined,
    onInstall: () => undefined,
    ...overrides,
  };
}

function verifyCurrentGate(
  initial: M52MedicationPassScenario,
): M52MedicationPassScenario {
  let scenario = initial;
  for (const control of currentM52MedicationPassStep(scenario)?.controls ?? [])
    scenario = verifyM52MedicationPassControl(scenario, control.id);
  return scenario;
}

describe("M5.2 tablet and offline-first experience", () => {
  it("keeps the synthetic boundary and device state visible", () => {
    const html = renderToStaticMarkup(<M52MobileOfflineView {...props()} />);

    expect(html).toContain("Synthetic prototype");
    expect(html).toContain("Fictional records only");
    expect(html).toContain("Real data: No");
    expect(html).toContain("Live writes: 0");
    expect(html).toContain("Real notifications: 0");
    expect(html).toContain("Network Offline");
    expect(html).toContain("Battery 76 percent");
    expect(html).toContain("Encrypted demo cache");
    expect(html).toContain("No real records · no live writes · no external alerts");
  });

  it("renders only the four approved core workflow presentations", () => {
    const html = renderToStaticMarkup(<M52MobileOfflineView {...props()} />);

    expect(html).toContain("Four approved offline-first core workflows");
    expect(html).toContain("Exact set · 4/4");
    expect(html).toContain("GRO tablet medication pass");
    expect(html).toContain("GRO shift safety and handoff");
    expect(html).toContain("BHC field case-management contact");
    expect(html).toContain("Assigned enterprise task and structured form");
    expect(html).toContain(
      "Safety rounds remain part of GRO shift safety and handoff, not a separate workflow.",
    );
  });

  it("exposes verification gates and disables advance before verification", () => {
    const html = renderToStaticMarkup(<M52MobileOfflineView {...props()} />);

    expect(html).toContain("Medication pass without skipped controls");
    expect(html).toContain("Authorized nurse scope");
    expect(html).toContain("Two identifiers matched");
    expect(html).toContain('aria-label="Verify Authorized nurse scope"');
    expect(html).toContain('aria-label="Verify Two identifiers matched"');
    const advanceButton = html.match(
      /<button[^>]*aria-describedby="advance-help"[^>]*>.*?Complete step.*?<\/button>/s,
    )?.[0];
    expect(advanceButton).toContain('disabled=""');
    expect(html).toContain(
      "Verify each current-step control independently",
    );
  });

  it("renders a completed scripted scenario without fabricating measured timing", () => {
    const scenario = runM52MedicationPassScenario();
    const html = renderToStaticMarkup(
      <M52MobileOfflineView {...props({ scenario })} />,
    );

    expect(html).toContain("Medication pass queued safely");
    expect(html).toContain("scripted flow reached its queue point in 4:13");
    expect(html).toContain("every verification control preserved");
    expect(html).toContain("Scripted under 5:00 · timing evidence pending");
    expect(html).not.toContain("Verified · 4:13");
    expect(html).toContain("Queued locally");
    expect(html).toContain("SYNTH-M52-MEDPASS-001");
  });

  it("keeps local reconnect pending and shows zero loss only from supplied evidence", () => {
    const queued = runM52MedicationPassScenario();
    const reconnecting = setM52ConnectionMode(queued, "reconnecting");
    const reconnectHtml = renderToStaticMarkup(
      <M52MobileOfflineView {...props({ scenario: reconnecting })} />,
    );
    expect(reconnectHtml).toContain("Reconnect validation in progress");
    expect(reconnectHtml).toContain("Complete local reconnect checks");
    expect(reconnectHtml).toContain("Stable identity, source version, idempotency key");

    const locallyValidated = completeM52Reconnect(reconnecting);
    const pendingHtml = renderToStaticMarkup(
      <M52MobileOfflineView {...props({ scenario: locallyValidated })} />,
    );
    expect(pendingHtml).toContain("Queued locally");
    expect(pendingHtml).not.toContain("Reconciled with zero data loss");

    const synced = applyM52ReconciliationEvidence(locallyValidated, {
      evidenceId: "SYNTH-M52-RECON-EVIDENCE-001",
      source: "api-receipt",
      verified: true,
      zeroDataLoss: true,
      dataLossCount: 0,
      duplicateCount: 0,
      queueRemaining: 0,
      auditChainValid: true,
    });
    const syncedHtml = renderToStaticMarkup(
      <M52MobileOfflineView {...props({ scenario: synced })} />,
    );
    expect(syncedHtml).toContain("Reconciled with zero data loss");
    expect(syncedHtml).toContain("no duplicate event or discarded field");
    expect(syncedHtml).toContain("Reconciled");
  });

  it("renders required structured outcome and attestation controls", () => {
    let outcomeStage = createM52MedicationPassScenario();
    for (let index = 0; index < 3; index += 1) {
      outcomeStage = verifyCurrentGate(outcomeStage);
      outcomeStage = advanceM52MedicationPass(outcomeStage);
    }
    const outcomeHtml = renderToStaticMarkup(
      <M52MobileOfflineView {...props({ scenario: outcomeStage })} />,
    );
    expect(outcomeHtml).toContain("Structured administration outcome · required");
    expect(outcomeHtml).toContain(">administered</button>");
    expect(outcomeHtml).toContain(">refused</button>");
    expect(outcomeHtml).toContain(">held</button>");
    expect(outcomeHtml).toContain("Administration note · required");

    outcomeStage = updateM52MedicationOutcome(outcomeStage, {
      outcome: "held",
      exceptionReason: "Synthetic hold reason.",
      administrationNote: "Synthetic administration note.",
    });
    const attestationStage = advanceM52MedicationPass(
      verifyCurrentGate(outcomeStage),
    );
    const attestationHtml = renderToStaticMarkup(
      <M52MobileOfflineView {...props({ scenario: attestationStage })} />,
    );
    expect(attestationHtml).toContain("Local synthetic attestation · required");
    expect(attestationHtml).toContain("Capture fictional device attestation");
    expect(attestationHtml).toContain("not a legal signature or live system write");
  });

  it("renders explicit conflict and restricted states without mutation controls", () => {
    const conflict = setM52ConnectionMode(
      runM52MedicationPassScenario(),
      "conflict",
    );
    const conflictHtml = renderToStaticMarkup(
      <M52MobileOfflineView {...props({ scenario: conflict })} />,
    );
    expect(conflictHtml).toContain("Version conflict held for review");
    expect(conflictHtml).toContain("silent overwrite and automatic clinical resolution are blocked");
    expect(conflictHtml).toContain("Stage governed conflict review request");

    const restricted = setM52ConnectionMode(
      createM52MedicationPassScenario(),
      "restricted",
    );
    const restrictedHtml = renderToStaticMarkup(
      <M52MobileOfflineView {...props({ scenario: restricted })} />,
    );
    expect(restrictedHtml).toContain("Workflow restricted by role scope");
    expect(restrictedHtml).toContain("Offline capability never expands online authorization");
    const restrictedVerifyButton = restrictedHtml.match(
      /<button[^>]*aria-label="Verify Authorized nurse scope"[^>]*>.*?Verify.*?<\/button>/s,
    )?.[0];
    expect(restrictedVerifyButton).toContain('disabled=""');
  });

  it("provides keyboard, screen-reader, tablet, touch, battery, and network semantics", () => {
    const html = renderToStaticMarkup(<M52MobileOfflineView {...props()} />);
    const buttons = [...html.matchAll(/<button[^>]*>/g)].map((match) => match[0]);

    expect(html).toContain('href="#m52-main-content"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Keyboard-operable controls with visible focus treatment");
    expect(html).toContain("Semantic landmarks, ordered headings, labels, and live status");
    expect(html).toContain("768px portrait and 1024px landscape tablet layouts");
    expect(html).toContain("warning at 20% or below");
    expect(html).toContain("Evidence pending");
    expect(html).toContain(
      "not a claim of completed field validation",
    );
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => button.includes('data-touch-target="48"'))).toBe(
      true,
    );
    expect(buttons.every((button) => button.includes("h-12"))).toBe(true);
  });

  it("shows low-battery behavior in text and not by color alone", () => {
    const html = renderToStaticMarkup(
      <M52MobileOfflineView {...props({ batteryPercent: 18 })} />,
    );
    expect(html).toContain("Battery 18 percent, low battery");
    expect(html).toContain("18% · charge soon");
  });

  it("ships an installable manifest and an offline-first shell that bypasses APIs and writes", () => {
    const manifestPath = new URL(
      "../../../public/m52-manifest.webmanifest",
      import.meta.url,
    );
    const workerPath = new URL(
      "../../../public/m52-offline-service-worker.js",
      import.meta.url,
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name: string;
      display: string;
      start_url: string;
      scope: string;
      icons: unknown[];
      shortcuts: unknown[];
    };
    const worker = readFileSync(workerPath, "utf8");

    expect(manifest).toMatchObject({
      name: "AMOS-OPS Mobile Workspace",
      display: "standalone",
      start_url: "/operations-hub/mobile-offline?source=pwa",
      scope: "/operations-hub/",
    });
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    expect(manifest.shortcuts).toHaveLength(4);
    expect(worker).toContain('request.method !== "GET"');
    expect(worker).toContain(
      'const M52_MANAGED_ROUTE = "/operations-hub/mobile-offline"',
    );
    expect(worker).toContain("url.pathname !== M52_MANAGED_ROUTE");
    expect(worker).toContain("referrer.pathname !== M52_MANAGED_ROUTE");
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('url.pathname.startsWith("/trpc/")');
    expect(worker).toContain("M52_CONTROLLED_SHELL_PATHS");
    expect(worker).toContain("m52IsControlledShellAsset(request, url)");
    expect(worker).toContain('url.pathname.startsWith("/assets/")');
    expect(worker).toContain('["script", "style", "font"]');
    expect(worker).toContain('"/uploads/"');
    expect(worker).toContain('"/documents/"');
    expect(worker).toContain('"/downloads/"');
    expect(worker).toContain('"/exports/"');
    expect(worker).not.toContain(
      '["style", "script", "image", "font", "manifest"]',
    );
    expect(worker).toContain('caches.match("/index.html")');
    expect(worker).toContain('fetch("/index.html"');
    expect(worker).not.toContain("m52RefreshShell(request)");
    expect(worker).toContain("M52_PURGE_OFFLINE_CACHE");
    expect(worker).toContain("M52_SESSION_REVOKED");
    expect(worker).toContain("M52_REINSTALL_OFFLINE_SHELL");
    expect(worker).toContain("M52_REPORT_CACHE_VERSION");
    expect(worker).toContain("m52OfflineFirstNavigation");
    expect(worker).toContain("m52CacheFirstAsset");
  });
});
