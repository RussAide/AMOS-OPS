import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  OnboardingProvider,
  createTrainingPracticeFixtures,
  mayUseIsolatedFixtures,
  resolveOnboardingFixtures,
  useOnboarding,
} from "@/context/onboarding-context";
import { M22Workspace } from "@/components/mhtcm/m22-workspace";
import { M23Workspace } from "@/components/mhrs/m23-workspace";
import { M24OperationsDashboard } from "@/components/gro/m24/m24-operations-dashboard";
import { ExecutiveDashboardPage } from "@/pages/exec/executive-dashboard-page";
import { RegulatoryFrameworkPage } from "@/pages/compliance/regulatory-framework-page";

function OnboardingProbe() {
  const state = useOnboarding();
  return (
    <output>
      {JSON.stringify({
        tracks: state.tracks.length,
        modules: state.modules.length,
        steps: state.steps.length,
        employees: state.employees.length,
        evidence: state.evidence.length,
        isUnavailable: state.isUnavailable,
      })}
    </output>
  );
}

describe("RM.1 Production fixture isolation", () => {
  it("permits fixtures only in evaluation or the isolated training workspace", () => {
    expect(mayUseIsolatedFixtures(false, null)).toBe(false);
    expect(mayUseIsolatedFixtures(false, "operational")).toBe(false);
    expect(mayUseIsolatedFixtures(true, "operational")).toBe(true);
    expect(mayUseIsolatedFixtures(false, "training")).toBe(true);
    expect(resolveOnboardingFixtures(["synthetic"], false)).toEqual([]);
    expect(resolveOnboardingFixtures(["synthetic"], true)).toEqual([
      "synthetic",
    ]);
  });

  it("starts Production onboarding empty and explicitly unavailable", () => {
    const markup = renderToStaticMarkup(
      <OnboardingProvider workspace="operational">
        <OnboardingProbe />
      </OnboardingProvider>,
    );

    expect(markup).toContain("&quot;tracks&quot;:0");
    expect(markup).toContain("&quot;modules&quot;:0");
    expect(markup).toContain("&quot;employees&quot;:0");
    expect(markup).toContain("&quot;evidence&quot;:0");
    expect(markup).toContain("&quot;isUnavailable&quot;:true");
    expect(markup).not.toContain("Synthetic Staff");
  });

  it("starts Production Training as zero-progress practice without official-looking records", () => {
    const practice = createTrainingPracticeFixtures({
      tracks: [
        {
          id: "universal-orientation",
          name: "Synthetic Track",
          description: "Synthetic practice",
          role: "clinical_staff",
          moduleCount: 1,
          completedModules: 1,
          clearanceStatus: "cleared",
        },
      ],
      modules: [
        {
          id: "mod-101",
          trackId: "universal-orientation",
          title: "Synthetic Module",
          category: "Practice",
          description: "Synthetic practice",
          stepCount: 1,
          completedSteps: 1,
          status: "completed",
        },
      ],
      steps: [
        {
          id: "step-1",
          moduleId: "mod-101",
          title: "Synthetic Step",
          content: "Synthetic practice",
          contentType: "text",
          durationMinutes: 1,
          completed: true,
        },
      ],
      employees: [
        {
          id: "employee-1",
          name: "Synthetic Staff",
          employeeId: "SYN-001",
          track: "Synthetic Track",
          startDate: "2026-07-17",
          clearanceStatus: "cleared",
          supervisor: "Synthetic Supervisor",
          completedModules: 1,
          totalModules: 1,
        },
      ],
      evidence: [
        {
          id: "evidence-1",
          title: "Synthetic Certificate",
          moduleTitle: "Synthetic Module",
          submittedAt: "2026-07-17",
          status: "approved",
          fileName: "synthetic.pdf",
          fileSize: "1 KB",
        },
      ],
    });

    expect(practice.tracks[0]).toMatchObject({
      completedModules: 0,
      clearanceStatus: "pending",
    });
    expect(practice.modules[0]).toMatchObject({
      completedSteps: 0,
      status: "available",
    });
    expect(practice.steps[0]?.completed).toBe(false);
    expect(practice.employees).toEqual([]);
    expect(practice.evidence).toEqual([]);
  });

  it.each([
    ["MHTCM", <M22Workspace syntheticDataAllowed={false} />],
    ["MHRS", <M23Workspace syntheticDataAllowed={false} />],
    [
      "GRO Residential",
      <M24OperationsDashboard syntheticDataAllowed={false} />,
    ],
  ])(
    "renders %s unavailable without synthetic operational defaults",
    (_, view) => {
      const markup = renderToStaticMarkup(view);
      expect(markup).toContain("operational data unavailable");
      expect(markup).toContain("No authoritative");
      expect(markup).not.toContain("Synthetic Youth");
      expect(markup).not.toContain("Acceptance gate passed");
      expect(markup).not.toContain("READY FOR REVENUE");
    },
  );

  it.each([
    [
      "executive command",
      <ExecutiveDashboardPage syntheticDataAllowed={false} />,
      "Executive operational data unavailable",
      ["Demo Executive", "Synthetic Staff", "Q2 2026 Operational Brief"],
    ],
    [
      "regulatory framework",
      <RegulatoryFrameworkPage syntheticDataAllowed={false} />,
      "Regulatory framework operational data unavailable",
      [
        "Synthetic prototype environment",
        "Synthetic scenario demonstrations",
        "30 / 30 mapped",
        "4 validated",
        "Fictional data only",
      ],
    ],
  ])(
    "renders %s unavailable instead of client-local fixtures",
    (_, view, unavailableMessage, prohibitedText) => {
      const markup = renderToStaticMarkup(view);
      expect(markup).toContain(unavailableMessage);
      for (const text of prohibitedText) expect(markup).not.toContain(text);
    },
  );

  it("preserves the explicitly isolated demonstration views", () => {
    const markup = [
      renderToStaticMarkup(<M22Workspace syntheticDataAllowed />),
      renderToStaticMarkup(<M23Workspace syntheticDataAllowed />),
      renderToStaticMarkup(<M24OperationsDashboard syntheticDataAllowed />),
      renderToStaticMarkup(<RegulatoryFrameworkPage syntheticDataAllowed />),
    ].join("\n");

    expect(markup).toContain("M2.2 Synthetic Demonstration");
    expect(markup).toContain("MHRS Program Operations");
    expect(markup).toContain("GRO Residential Operations");
    expect(markup).toContain("Synthetic prototype environment");
    expect(markup).toContain("Demo mode");
  });
});
