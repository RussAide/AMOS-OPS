import { describe, expect, it } from "vitest";
import {
  AMOS_PRODUCTION_WEB_ORIGIN,
  canonicalWebLocation,
} from "../canonical-web";

describe("Production canonical web surface", () => {
  it("redirects the Railway root to the sole Netlify-backed web origin", () => {
    expect(
      canonicalWebLocation("https://amos-ops-production.up.railway.app/"),
    ).toBe(`${AMOS_PRODUCTION_WEB_ORIGIN}/`);
  });

  it("preserves deep-link paths and query parameters", () => {
    expect(
      canonicalWebLocation(
        "https://amos-ops-production.up.railway.app/admin/access-recovery?source=railway",
      ),
    ).toBe(
      `${AMOS_PRODUCTION_WEB_ORIGIN}/admin/access-recovery?source=railway`,
    );
  });

  it("does not copy the Railway host into the destination", () => {
    expect(
      canonicalWebLocation(
        "https://amos-ops-production.up.railway.app/login?next=%2Fdashboard",
      ),
    ).not.toContain("up.railway.app");
  });
});
