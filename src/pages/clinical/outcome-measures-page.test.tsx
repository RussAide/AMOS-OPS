import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import {
  M41C_OUTCOME_MEASURE_PAGE_MODE,
  OutcomeMeasuresPage,
} from "./outcome-measures-page";
import {
  M41C_PATIENT_PROFILE_OUTCOME_TAB_MODE,
  M41C_PATIENT_PROFILE_OUTCOME_TAB_TEST_ID,
  PatientProfileOutcomeGovernancePanel,
} from "./patient-profile-page";

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("M4.1C mounted outcome-measure experience quarantine", () => {
  it("renders a metadata-only governance panel linked to the fabric", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <OutcomeMeasuresPage />
      </MemoryRouter>,
    );

    expect(M41C_OUTCOME_MEASURE_PAGE_MODE).toBe("metadata_only_quarantine");
    expect(markup).toContain('data-testid="m41c-outcome-measure-governance"');
    expect(markup).toContain("Outcome Measure Governance");
    expect(markup).toContain("Governed evaluation boundary");
    expect(markup).toContain("Synthetic evaluation only");
    expect(markup).toContain('href="/clinical/intelligence-fabric"');
  });

  it("contains no patient query, entry controls, or numeric interpretation UI", () => {
    const source = readSource("./outcome-measures-page.tsx");

    expect(source).not.toContain("trpc");
    expect(source).not.toContain("useQuery");
    expect(source).not.toContain("useMutation");
    expect(source).not.toContain("<input");
    expect(source).not.toContain("patientId");
    expect(source).not.toMatch(/\b(?:score|severity|trend)\b/i);
  });

  it("hard-quarantines the dashboard modal before its inherited execution path", () => {
    const source = readSource("./clinical-dashboard-page.tsx");
    const boundary = source.slice(
      source.indexOf("function OutcomeMeasureModal"),
      source.indexOf("Modal: View Treatment Plan"),
    );
    const quarantineIndex = boundary.indexOf(
      "if (!M41C_DASHBOARD_OUTCOME_MEASURE_PREVIEW_ENABLED)",
    );

    expect(source).toContain(
      "M41C_DASHBOARD_OUTCOME_MEASURE_PREVIEW_ENABLED = false",
    );
    expect(boundary).toContain(
      "enabled: M41C_DASHBOARD_OUTCOME_MEASURE_PREVIEW_ENABLED",
    );
    expect(quarantineIndex).toBeGreaterThan(0);
    expect(boundary).not.toContain("const measures");
    expect(boundary).not.toContain("setScores");
    expect(boundary).not.toContain("Save Scores");
    expect(boundary).not.toContain("Select Patient");
    expect(boundary).toContain(
      'data-testid="m41c-dashboard-outcome-measure-governance"',
    );
    expect(boundary).toContain('to="/clinical/intelligence-fabric"');
  });

  it("keeps the governed page mounted in the canonical route tree with accurate metadata", () => {
    const routes = readSource("../../components/shell/app-shell.tsx");
    const navigation = readSource("../../data/navData.ts");

    expect(routes).toContain('path="/clinical/outcome-measures"');
    expect(routes).toContain("<OutcomeMeasuresPage />");
    expect(navigation).toContain('title: "Outcome Measure Governance"');
    expect(navigation).toContain("Metadata-only evaluation boundary");
  });

  it("renders the patient-profile outcome tab as a metadata-only governance panel", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <PatientProfileOutcomeGovernancePanel />
      </MemoryRouter>,
    );

    expect(M41C_PATIENT_PROFILE_OUTCOME_TAB_MODE).toBe(
      "metadata_only_quarantine",
    );
    expect(M41C_PATIENT_PROFILE_OUTCOME_TAB_TEST_ID).toBe(
      "m41c-patient-profile-outcome-governance",
    );
    expect(markup).toContain(
      'data-testid="m41c-patient-profile-outcome-governance"',
    );
    expect(markup).toContain("Outcome Measure Governance");
    expect(markup).toContain("Synthetic evaluation only");
    expect(markup).toContain('href="/clinical/intelligence-fabric"');
  });

  it("removes numeric outcome presentation from the profile and disconnected fallback", () => {
    const profileSource = readSource("./patient-profile-page.tsx");
    const tabBoundary = profileSource.slice(
      profileSource.indexOf('{activeTab === "outcomes"'),
      profileSource.indexOf("{/* New Plan Modal */"),
    );
    const providerSource = readSource("../../providers/trpc.ts");
    const fallbackStart = providerSource.lastIndexOf(
      'if (procedure === "bhc.getPatient")',
    );
    const fallbackBoundary = providerSource.slice(
      fallbackStart,
      providerSource.indexOf(
        'if (procedure === "bhc.clinicianWorkload")',
        fallbackStart,
      ),
    );

    expect(tabBoundary).toContain("<PatientProfileOutcomeGovernancePanel />");
    expect(tabBoundary).not.toContain("outcomeMeasures");
    expect(tabBoundary).not.toContain("<table");
    expect(tabBoundary).not.toMatch(/\b(?:score|severity|trend)\b/i);
    expect(profileSource).toContain('{activeTab === "overview"');
    expect(profileSource).toContain('{activeTab === "plans"');
    expect(profileSource).toContain('{activeTab === "sessions"');

    expect(fallbackStart).toBeGreaterThan(0);
    expect(fallbackBoundary).toContain("outcomeMeasures: []");
    expect(fallbackBoundary).toContain(
      'disposition: "legacy_numeric_rows_quarantined"',
    );
    expect(fallbackBoundary).toContain(
      "M41C_BHC_GET_PATIENT_FALLBACK_OUTCOME_MODE",
    );
    expect(fallbackBoundary).not.toMatch(/PHQ-A|GAD-7|PSC-17/);
    expect(fallbackBoundary).not.toContain("measureType:");
    expect(fallbackBoundary).not.toContain("score:");
    expect(fallbackBoundary).not.toContain("maxScore:");
    expect(fallbackBoundary).not.toContain("severityLevel:");
    expect(fallbackBoundary).not.toContain("patientOutcomes");
  });
});
