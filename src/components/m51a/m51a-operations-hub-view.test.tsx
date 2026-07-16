import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildM51AActorContext,
  createM51AExperienceSnapshot,
} from "../../../api/services/m51a";
import type { M51AAcceptancePresentation } from "./m51a-experience-model";
import {
  M51AOperationsHubView,
  type M51AOperationsHubViewProps,
} from "./m51a-operations-hub-view";

const callbacks = {
  onRefresh: () => undefined,
  onRunScenario: () => undefined,
  onResolveRoute: () => undefined,
};

function acceptance(): M51AAcceptancePresentation {
  return {
    accepted: true,
    acceptanceFlags: Array.from({ length: 8 }, (_, index) => ({
      criterionId: `M5.1A-AC-${String(index + 1).padStart(2, "0")}`,
      passed: true,
      assertionCount: index + 10,
      summary: `Synthetic integrated control ${index + 1}`,
      evidenceIds: [`SYNTH-M51A-EVIDENCE-${index + 1}`],
    })),
  };
}

function props(
  overrides: Partial<M51AOperationsHubViewProps> = {},
): M51AOperationsHubViewProps {
  return {
    snapshot: createM51AExperienceSnapshot(
      buildM51AActorContext("managing-director"),
    ),
    acceptance: null,
    scenarioResult: null,
    routeDecision: null,
    state: "ready",
    isRefreshing: false,
    isRunningScenario: false,
    isResolvingRoute: false,
    ...callbacks,
    ...overrides,
  };
}

describe("M5.1A Operations Hub experience", () => {
  it("renders a governed loading state without displaying ready-state metrics", () => {
    const html = renderToStaticMarkup(
      <M51AOperationsHubView
        {...props({ snapshot: null, state: "loading" })}
      />,
    );

    expect(html).toContain("Loading M5.1A Operations Hub architecture");
    expect(html).toContain("signed-in role projection");
    expect(html).not.toContain("Adolbi Care Operations Hub</h1>");
  });

  it("renders the supplied error and retry experience", () => {
    const html = renderToStaticMarkup(
      <M51AOperationsHubView
        {...props({
          state: "error",
          errorMessage: "Synthetic M5.1A snapshot unavailable.",
        })}
      />,
    );

    expect(html).toContain("The Operations Hub evaluation could not load");
    expect(html).toContain("Synthetic M5.1A snapshot unavailable.");
    expect(html).toContain("Retry");
  });

  it("renders the ready synthetic boundary, all six modules, and exactly eight accepted controls", () => {
    const html = renderToStaticMarkup(
      <M51AOperationsHubView
        {...props({ acceptance: acceptance() })}
      />,
    );

    expect(html).toContain("Synthetic architecture evaluation");
    expect(html).toContain("Real data: No");
    expect(html).toContain("Live Microsoft reads: 0");
    expect(html).toContain("Live Microsoft writes: 0");
    expect(html).toContain("Production rows: 0");
    expect(html).toContain("Adolbi Care Operations Hub");

    for (const tab of [
      "Control center",
      "Hub &amp; libraries",
      "Connectors",
      "Intranet",
      "Pilot",
      "Security",
    ]) {
      expect(html).toContain(tab);
    }
    expect(html).toContain("8/8 controls passed");
    for (let index = 1; index <= 8; index += 1) {
      expect(html).toContain(
        `M5.1A-AC-${String(index).padStart(2, "0")}`,
      );
    }
  });

  it("uses the latest scenario result instead of stale baseline acceptance", () => {
    const baseline = acceptance();
    const scenarioResult: M51AAcceptancePresentation = {
      ...baseline,
      accepted: false,
      acceptanceFlags: baseline.acceptanceFlags.map((criterion, index) => ({
        ...criterion,
        passed: index < 7,
      })),
    };
    const html = renderToStaticMarkup(
      <M51AOperationsHubView
        {...props({ acceptance: baseline, scenarioResult })}
      />,
    );

    expect(html).toContain("7/8 controls passed");
    expect(html).toContain("Review required");
    expect(html).not.toContain("8/8 controls passed");
  });

  it("renders a role-trimmed T3 projection with architecture execution disabled", () => {
    const snapshot = createM51AExperienceSnapshot(
      buildM51AActorContext("facilities-manager"),
    );
    const html = renderToStaticMarkup(
      <M51AOperationsHubView {...props({ snapshot })} />,
    );

    expect(html).toContain("T3 projection");
    expect(html).toContain("facilities manager");
    expect(html).toContain("routes suppressed before display");
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>[^<]*(?:<svg[\s\S]*?<\/svg>)?[^<]*Run integrated evaluation<\/button>/,
    );
  });
});
