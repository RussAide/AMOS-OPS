import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceEnvironmentBanner } from "./workspace-environment-banner";

const productionConfig = {
  environmentId: "amos-ops-production",
  evaluationMode: false,
  mode: "production" as const,
  productionReleaseAuthorized: true,
  productionReleaseId: "v1.3.0",
};

describe("WorkspaceEnvironmentBanner", () => {
  it("shows the amber training safety notice instead of the green production notice", () => {
    const html = renderToStaticMarkup(
      <WorkspaceEnvironmentBanner
        workspace="training"
        config={productionConfig}
      />,
    );

    expect(html).toContain('data-amos-runtime-mode="training"');
    expect(html).toContain("TRAINING WORKSPACE");
    expect(html).toContain("Synthetic data only");
    expect(html).toContain("No PHI or regulated data");
    expect(html).toContain("Not for care delivery");
    expect(html).toContain("Practice only — no certification or clearance");
    expect(html).toContain("bg-amber-300");
    expect(html).not.toContain("Authorized live operations");
    expect(html).not.toContain("bg-emerald-950");
  });

  it("preserves the green production notice in the operational workspace", () => {
    const html = renderToStaticMarkup(
      <WorkspaceEnvironmentBanner
        workspace="operational"
        config={productionConfig}
      />,
    );

    expect(html).toContain('data-amos-runtime-mode="production"');
    expect(html).toContain("PRODUCTION");
    expect(html).toContain("Authorized live operations");
    expect(html).toContain("Release: v1.3.0");
    expect(html).not.toContain("TRAINING WORKSPACE");
  });
});
