import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrganizationModelPage } from "./organization-model-page";
import { BHC_DEPARTMENTS, CAMPUS_STAGES, OPERATING_DIVISIONS } from "@/constants/organization";

describe("M1.1 authoritative organization model", () => {
  it("renders all divisions, BHC departments, and canonical campus stages", () => {
    const markup = renderToStaticMarkup(<OrganizationModelPage />);

    for (const division of OPERATING_DIVISIONS) {
      expect(markup).toContain(division.code);
      expect(markup).toContain(division.name);
      expect(markup).toContain(division.categoryTag);
    }
    for (const department of Object.values(BHC_DEPARTMENTS)) {
      expect(markup).toContain(department.shortName);
      expect(markup).toContain(department.name);
    }
    for (const stage of CAMPUS_STAGES) {
      expect(markup).toContain(stage.name);
      expect(markup).toContain(stage.controlledCapacity);
    }
    expect(markup).toContain("Fictional Demonstration Reference");
  });
});
