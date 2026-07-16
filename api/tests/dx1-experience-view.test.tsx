import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Dx1CriterionResult } from "../services/dx1/contracts";
import { runDx1ExperienceGovernanceStream } from "../services/dx1/experience";
import {
  Dx1EnterpriseDemoView,
  type Dx1EnterpriseDemoSnapshot,
} from "../../src/components/dx1";

function snapshot(): Dx1EnterpriseDemoSnapshot {
  const experience = runDx1ExperienceGovernanceStream();
  const otherCriteria: readonly Dx1CriterionResult[] = [
    "DX.1-03",
    "DX.1-04",
    "DX.1-05",
    "DX.1-06",
    "DX.1-07",
    "DX.1-08",
    "DX.1-10",
  ].map((criterionId) => ({
    criterionId: criterionId as Dx1CriterionResult["criterionId"],
    status: "Complete" as const,
    assertionIds: [`${criterionId}-SYNTH-ASSERTION`],
    evidenceIds: [`${criterionId}-SYNTH-EVIDENCE`],
    summary: `${criterionId} integrated stream evidence passed.`,
  }));
  return {
    milestone: "DX.1",
    scenarioId: "SYNTH-DX1-CROSS-ENTERPRISE-DEMO-001",
    evaluatedAt: experience.evaluatedAt,
    acceptance: "ACCEPTED",
    accepted: true,
    passed: true,
    assertionCount: experience.assertionCount + otherCriteria.length,
    criteria: [...experience.criteria, ...otherCriteria],
    streams: { experience },
    boundary: experience.boundary,
    viewer: {
      actorId: "SYNTH-DX1-VIEWER-001",
      role: "managing-director",
      canRunVerification: true,
    },
  };
}

const noOp = () => undefined;

describe("DX.1 cross-enterprise demo experience", () => {
  it("shows a neutral loading state before evidence is available", () => {
    const html = renderToStaticMarkup(
      <Dx1EnterpriseDemoView
        isRefreshing={false}
        isRunning={false}
        onRefresh={noOp}
        onRunVerification={noOp}
        snapshot={null}
        state="loading"
      />,
    );
    expect(html).toContain("Loading verified enterprise evidence");
    expect(html).toContain("No readiness claim is shown until evidence arrives");
    expect(html).not.toContain("ACCEPTED");
  });

  it("renders an evidence-load error and retry action", () => {
    const html = renderToStaticMarkup(
      <Dx1EnterpriseDemoView
        errorMessage="Synthetic evidence unavailable"
        isRefreshing={false}
        isRunning={false}
        onRefresh={vi.fn()}
        onRunVerification={noOp}
        snapshot={null}
        state="error"
      />,
    );
    expect(html).toContain("Enterprise evidence is unavailable");
    expect(html).toContain("Synthetic evidence unavailable");
    expect(html).toContain("Retry evidence load");
  });

  it("renders the complete cross-enterprise experience from verified stream evidence", () => {
    const html = renderToStaticMarkup(
      <Dx1EnterpriseDemoView
        isRefreshing={false}
        isRunning={false}
        onRefresh={noOp}
        onRunVerification={noOp}
        snapshot={snapshot()}
        state="ready"
      />,
    );
    expect(html).toContain("Final cross-enterprise demo verification");
    expect(html).toContain("12/12 enterprise criteria");
    expect(html).toContain("11/11 enterprise destinations");
    expect(html).toContain("Synthetic Intake Coordinator");
    expect(html).toContain("Eight-stage governance registry");
    expect(html).toContain("Frontline walkthrough proof");
    expect(html).toContain("AMOS-Coach prompt");
    expect(html).toContain("SOP-003");
    expect(html).toContain("Get issue support");
    expect(html).toContain("Release and enhancement governance");
    expect(html).toContain("Demo-only · no production activation");
    expect(html).toContain("Production rows: 0");
    expect(html).toContain("Live Microsoft writes: 0");
  });

  it("does not expose the verification action to a non-reviewer", () => {
    const reviewerRestrictedSnapshot = {
      ...snapshot(),
      viewer: {
        actorId: "SYNTH-DX1-VIEWER-002",
        role: "therapist",
        canRunIntegratedEvaluation: false,
      },
    } satisfies Dx1EnterpriseDemoSnapshot;
    const html = renderToStaticMarkup(
      <Dx1EnterpriseDemoView
        isRefreshing={false}
        isRunning={false}
        onRefresh={noOp}
        onRunVerification={noOp}
        snapshot={reviewerRestrictedSnapshot}
        state="ready"
      />,
    );
    expect(html).toContain("Reviewer required");
    expect(html).toContain("disabled");
    expect(html).not.toContain(">Verify again<");
  });
});
