import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { M22Workspace } from "./m22-workspace";

describe("M2.2 workspace", () => {
  it("renders the complete synthetic case-management experience", () => {
    const markup = renderToStaticMarkup(<M22Workspace syntheticDataAllowed />);
    expect(markup).toContain("MHTCM Case Management Workspace");
    expect(markup).toContain("SYNTH-M22-CASE-001");
    expect(markup).toContain("Six-function lifecycle");
    expect(markup).toContain("Immutable service plan");
    expect(markup).toContain("T1017 fail-closed gate");
    expect(markup).toContain("Authorization watch");
    expect(markup).toContain("M2.2 acceptance criteria");
    expect(markup).toContain("Revenue: full clinical case denied");
  });
});
