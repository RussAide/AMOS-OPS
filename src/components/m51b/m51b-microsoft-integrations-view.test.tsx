import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { presentM51BIntegratedResult } from "../../../api/routers/m51b";
import { runM51BIntegratedScenario } from "../../../api/services/m51b";
import {
  M51B_SHAREPOINT_GATE_PRESENTATION,
  type M51BSnapshot,
} from "./m51b-experience-model";
import {
  M51BGovernanceEvidencePanel,
  M51BMicrosoftIntegrationsView,
  M51BOutlookEvidencePanel,
  M51BSharePointEvidencePanel,
  M51BTeamsEvidencePanel,
  type M51BMicrosoftIntegrationsViewProps,
} from "./m51b-microsoft-integrations-view";

async function executiveSnapshot(): Promise<M51BSnapshot> {
  const result = await runM51BIntegratedScenario();
  return {
    ...presentM51BIntegratedResult(result),
    viewer: {
      role: "managing-director",
      tier: "T1",
      canRunIntegratedEvaluation: true,
      serverDerivedIdentity: true,
    },
  };
}

function props(
  snapshot: M51BSnapshot | null,
  overrides: Partial<M51BMicrosoftIntegrationsViewProps> = {},
): M51BMicrosoftIntegrationsViewProps {
  return {
    snapshot,
    acceptance: snapshot,
    scenarioResult: null,
    state: "ready",
    isRefreshing: false,
    isRunningScenario: false,
    onRefresh: () => undefined,
    onRunScenario: () => undefined,
    ...overrides,
  };
}

describe("M5.1B Operations Hub Microsoft 365 integration experience", () => {
  it("renders a synthetic loading state without ready-state channel claims", () => {
    const html = renderToStaticMarkup(
      <M51BMicrosoftIntegrationsView
        {...props(null, { state: "loading" })}
      />,
    );

    expect(html).toContain("Loading M5.1B Microsoft 365 integration evidence");
    expect(html).toContain("signed-in projection and synthetic channel outcomes");
    expect(html).not.toContain("Microsoft 365 Integration Control Center</h1>");
    expect(html).not.toContain("8/8 accepted");
  });

  it("renders the supplied error and an evidence-load retry action", () => {
    const html = renderToStaticMarkup(
      <M51BMicrosoftIntegrationsView
        {...props(null, {
          state: "error",
          errorMessage: "Synthetic M5.1B snapshot unavailable.",
        })}
      />,
    );

    expect(html).toContain("integration evidence could not load");
    expect(html).toContain("Synthetic M5.1B snapshot unavailable.");
    expect(html).toContain("Retry evidence load");
  });

  it("renders the complete accepted synthetic integration experience", async () => {
    const snapshot = await executiveSnapshot();
    const shellHtml = renderToStaticMarkup(
      <M51BMicrosoftIntegrationsView {...props(snapshot)} />,
    );
    const html = [
      shellHtml,
      renderToStaticMarkup(<M51BTeamsEvidencePanel snapshot={snapshot} />),
      renderToStaticMarkup(<M51BOutlookEvidencePanel snapshot={snapshot} />),
      renderToStaticMarkup(<M51BSharePointEvidencePanel snapshot={snapshot} />),
      renderToStaticMarkup(<M51BGovernanceEvidencePanel snapshot={snapshot} />),
    ].join("\n");

    expect(html).toContain("Synthetic integration evaluation");
    expect(html).toContain("Real data: No");
    expect(html).toContain("Live Graph calls: 0");
    expect(html).toContain("Microsoft reads: 0");
    expect(html).toContain("Microsoft writes: 0");
    expect(html).toContain("Real notifications: 0");
    expect(html).toContain("8/8 accepted");
    expect(html).toContain("8/8 controls passed");

    for (const tab of [
      "Control center",
      "Teams",
      "Outlook intake",
      "SharePoint",
      "Governance &amp; recovery",
    ])
      expect(html).toContain(tab);

    for (let index = 1; index <= 8; index += 1)
      expect(html).toContain(
        `M5.1B-AC-${String(index).padStart(2, "0")}`,
      );

    expect(html).toContain("2.25 seconds");
    expect(html).toContain("Governed destination resolved");
    expect(html).toContain("Mentions validated");
    expect(html).toContain("Content minimized");
    expect(html).toContain("Acknowledgement recorded");
    expect(html).toContain("Exactly one intake recorded");
    expect(html).toContain("Duplicate prevented");
    expect(html).toContain("Privacy exception routed");
    expect(html).toContain("Dead letter recovered");
    expect(html).toContain("145 seconds");
    expect(html).toContain("11/11 governance gates passed");
    expect(html).toContain("Stable identity");
    expect(html).toContain("AMOS-DMS source authority");
    expect(html).toContain("Stale-version conflict detected");
    expect(html).toContain("Reconciliation passed");
    expect(html).toContain("Least privilege verified");
    expect(html).toContain("Access reviews complete");
    expect(html).toContain("Privacy threats controlled");
    expect(html).toContain("Dead-letter queue");
    expect(html).toContain("Operational alert");
  });

  it("uses the latest scenario result instead of baseline acceptance", async () => {
    const snapshot = await executiveSnapshot();
    const reviewResult = {
      ...snapshot,
      accepted: false,
      acceptanceFlags: snapshot.acceptanceFlags.map((criterion, index) => ({
        ...criterion,
        passed: index < 7,
      })),
    };
    const html = renderToStaticMarkup(
      <M51BMicrosoftIntegrationsView
        {...props(snapshot, { scenarioResult: reviewResult })}
      />,
    );

    expect(html).toContain("7/8 controls passed");
    expect(html).toContain("Review required");
  });

  it("renders failed channel readiness with a fail icon and fail text", async () => {
    const snapshot = await executiveSnapshot();
    const drifted = {
      ...snapshot,
      channels: {
        ...snapshot.channels,
        teams: {
          ...snapshot.channels.teams,
          acknowledgementRecorded: false,
        },
      },
    } as unknown as M51BSnapshot;
    const html = renderToStaticMarkup(
      <M51BMicrosoftIntegrationsView {...props(drifted)} />,
    );

    expect(html).toContain('aria-label="Teams channel failed"');
    expect(html).toContain("Fail · 2.25s");
    expect(html).toContain('aria-label="Outlook channel passed"');
    expect(html).toContain("Pass · 1 intake");
  });

  it("renders each SharePoint gate from its own boolean evidence", async () => {
    const snapshot = await executiveSnapshot();
    const governanceGates = Object.fromEntries(
      M51B_SHAREPOINT_GATE_PRESENTATION.map(({ code }) => [code, true]),
    );
    const drifted = {
      ...snapshot,
      channels: {
        ...snapshot.channels,
        sharepoint: {
          ...snapshot.channels.sharepoint,
          governanceGates: { ...governanceGates, stable_identity: false },
          governanceGatesPassed: 10,
        },
      },
    } as unknown as M51BSnapshot;
    const html = renderToStaticMarkup(
      <M51BSharePointEvidencePanel snapshot={drifted} />,
    );

    expect(html).toContain("10/11 governance gates passed");
    expect(html).toContain('aria-label="Registry gate passed"');
    expect(html).toContain('aria-label="Stable identity gate failed"');
    expect(html).toContain("review_required");
  });

  it("disables evaluation for a viewer without run authority", async () => {
    const executive = await executiveSnapshot();
    const snapshot = {
      ...executive,
      viewer: {
        role: "facilities-manager",
        tier: "T3",
        canRunIntegratedEvaluation: false,
        serverDerivedIdentity: true,
      },
    } as M51BSnapshot;
    const html = renderToStaticMarkup(
      <M51BMicrosoftIntegrationsView {...props(snapshot)} />,
    );

    expect(html).toContain("T3 projection");
    expect(html).toContain("facilities manager");
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*title="This role can review evidence but cannot run the integrated evaluation"[^>]*>[\s\S]*?Run synthetic evaluation<\/button>/,
    );
  });

  it("offers evidence controls only and never implies a live Microsoft operation", async () => {
    const snapshot = await executiveSnapshot();
    const shellHtml = renderToStaticMarkup(
      <M51BMicrosoftIntegrationsView {...props(snapshot)} />,
    );
    const teamsHtml = renderToStaticMarkup(
      <M51BTeamsEvidencePanel snapshot={snapshot} />,
    );
    const buttonText = [
      ...shellHtml.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g),
    ]
      .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    expect(buttonText).toEqual(
      expect.arrayContaining(["Refresh evidence", "Run synthetic evaluation"]),
    );
    for (const prohibited of [
      "Send Teams message",
      "Create live intake",
      "Sync now",
      "Connect tenant",
      "Write to SharePoint",
    ])
      expect(`${shellHtml}\n${teamsHtml}`).not.toContain(prohibited);
    expect(teamsHtml).toContain("no Microsoft message was sent");
    expect(shellHtml).toContain("no real data or file reads");
    expect(shellHtml).toContain("tenant provisioning");
    expect(shellHtml).toContain("GitHub push");
  });
});
