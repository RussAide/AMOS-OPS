import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  M42DocumentKnowledgeView,
} from "./m42-document-knowledge-view";
import {
  m42AcceptanceCounts,
  type M42AcceptanceStatus,
} from "./m42-experience-model";
import {
  createM42ExperienceSnapshot,
  runM42IntegratedScenario,
} from "../../../api/services/m42/experience-service";

function acceptanceStatus(): M42AcceptanceStatus {
  const result = runM42IntegratedScenario(undefined, 1);
  return {
    milestone: result.milestone,
    scenarioId: result.scenarioId,
    accepted: result.accepted,
    acceptanceFlags: result.acceptanceFlags,
    totals: result.totals,
    boundary: result.boundary,
    viewer: { role: "managing-director", tier: "T1" },
  };
}

describe("M4.2 document and knowledge experience view", () => {
  it("renders a governed loading state without inventing local content", () => {
    const html = renderToStaticMarkup(
      <M42DocumentKnowledgeView
        acceptance={null}
        configurationDemoResult={null}
        configurationSchemas={null}
        documentActionResult={null}
        documentSearchResult={null}
        governedDocuments={null}
        isEvaluatingDocument={false}
        isRefreshing={false}
        isRunningConfigurationDemo={false}
        isRunningReportDemo={false}
        isRunningScenario={false}
        isRunningVersionDemo={false}
        isSearchingDocuments={false}
        isSearchingNil={false}
        nilSearchResult={null}
        onEvaluateDocument={() => undefined}
        onRefresh={() => undefined}
        onRunConfigurationDemo={() => undefined}
        onRunReportDemo={() => undefined}
        onRunScenario={() => undefined}
        onRunVersionDemo={() => undefined}
        onSearchDocuments={() => undefined}
        onSearchNil={() => undefined}
        reportDemoResult={null}
        reportFields={null}
        scenarioResult={null}
        snapshot={null}
        state="loading"
        versionDemoResult={null}
      />,
    );
    expect(html).toContain("Loading M4.2 document and knowledge workspace");
    expect(html).not.toContain("fictional documents");
  });

  it("renders all eight operational controls and the explicit demo boundary", () => {
    const snapshot = createM42ExperienceSnapshot();
    const acceptance = acceptanceStatus();
    const html = renderToStaticMarkup(
      <M42DocumentKnowledgeView
        acceptance={acceptance}
        configurationDemoResult={null}
        configurationSchemas={null}
        documentActionResult={null}
        documentSearchResult={null}
        governedDocuments={null}
        isEvaluatingDocument={false}
        isRefreshing={false}
        isRunningConfigurationDemo={false}
        isRunningReportDemo={false}
        isRunningScenario={false}
        isRunningVersionDemo={false}
        isSearchingDocuments={false}
        isSearchingNil={false}
        nilSearchResult={null}
        onEvaluateDocument={() => undefined}
        onRefresh={() => undefined}
        onRunConfigurationDemo={() => undefined}
        onRunReportDemo={() => undefined}
        onRunScenario={() => undefined}
        onRunVersionDemo={() => undefined}
        onSearchDocuments={() => undefined}
        onSearchNil={() => undefined}
        reportDemoResult={null}
        reportFields={null}
        scenarioResult={null}
        snapshot={snapshot}
        state="ready"
        versionDemoResult={null}
      />,
    );
    expect(html).toContain("Document &amp; Knowledge Intelligence");
    expect(html).toContain("Eight-control operational map");
    for (const criterionId of [
      "M4.2-01",
      "M4.2-02",
      "M4.2-03",
      "M4.2-04",
      "M4.2-05",
      "M4.2-06",
      "M4.2-07",
      "M4.2-08",
    ]) {
      expect(html).toContain(criterionId);
    }
    expect(html).toContain("No real data");
    expect(html).toContain("No live connector writes");
    expect(html).toContain("8/8");
  });

  it("summarizes acceptance deterministically", () => {
    const acceptance = acceptanceStatus();
    expect(m42AcceptanceCounts(acceptance)).toEqual({ passed: 8, total: 8 });
    expect(m42AcceptanceCounts(null)).toEqual({ passed: 0, total: 8 });
  });
});
