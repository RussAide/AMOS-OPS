import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { M41cLegacyCansQuarantine } from "./m41c-legacy-cans-quarantine";

describe("M4.1C legacy CANS quarantine experience", () => {
  it("shows the governed replacement without rendering scoring or action logic", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <M41cLegacyCansQuarantine surface="toolkit" />
      </MemoryRouter>,
    );

    expect(markup).toContain("Legacy CANS scoring is unavailable");
    expect(markup).toContain("M4.1C governed quarantine");
    expect(markup).toContain("Separate TRR CANS and DFPS CANS 3.0");
    expect(markup).toContain("/clinical/intelligence-fabric");
    expect(markup).not.toContain("Save Assessment");
    expect(markup).not.toContain("Action Level thresholds");
    expect(markup).not.toContain("Total Score</div>");
  });
});
