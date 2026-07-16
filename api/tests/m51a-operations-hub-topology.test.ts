import { describe, expect, it } from "vitest";
import { M51A_SITE_CODES } from "@contracts/m51a/operations-hub";
import {
  createSyntheticM51aOperationsHubArchitecture,
  validateM51aOperationsHubArchitecture,
} from "../services/m51a/operations-hub/architecture-scenario";
import {
  M51A_OPERATIONS_HUB_SITE_ID,
  createSyntheticM51aHubTopology,
  validateM51aHubTopology,
} from "../services/m51a/operations-hub/topology";

describe("M5.1A Hub A01 topology and governing authority", () => {
  it("builds one deterministic hub, six associated sites, and seven segregated zones", () => {
    const first = createSyntheticM51aHubTopology();
    const second = createSyntheticM51aHubTopology();
    expect(second).toEqual(first);
    expect(first).toHaveLength(14);
    expect(first.filter((site) => site.kind === "communication_hub")).toHaveLength(1);
    expect(
      first.filter((site) => site.kind === "associated_operational_site"),
    ).toHaveLength(6);
    expect(
      first.filter(
        (site) =>
          site.kind === "restricted_record_zone" ||
          site.kind === "system_managed_zone",
      ),
    ).toHaveLength(7);
    expect(first.map((site) => site.code)).toEqual(M51A_SITE_CODES);
  });

  it("associates only approved operational sites to the hub", () => {
    const sites = createSyntheticM51aHubTopology();
    const associated = sites.filter(
      (site) => site.kind === "associated_operational_site",
    );
    expect(
      associated.every(
        (site) =>
          site.parentHubSiteId === M51A_OPERATIONS_HUB_SITE_ID &&
          site.hubAssociation === "associated" &&
          site.sharedNavigationEligible,
      ),
    ).toBe(true);
    expect(associated.map((site) => site.code)).toEqual([
      "corporate-office",
      "bhc-operations",
      "gro-operations",
      "learning-workforce",
      "contracts-projects",
      "future-campus",
    ]);
  });

  it("keeps clinical, Part 2, workforce, payroll, finance, legal, and system zones outside general exposure", () => {
    const restricted = createSyntheticM51aHubTopology().filter(
      (site) =>
        site.kind === "restricted_record_zone" ||
        site.kind === "system_managed_zone",
    );
    for (const site of restricted) {
      expect(site.parentHubSiteId).toBeNull();
      expect(site.sharedNavigationEligible).toBe(false);
      expect(site.contentRollupEligible).toBe(false);
      expect(site.generalSearchEligible).toBe(false);
      expect(["segregated", "excluded_system_managed"]).toContain(
        site.hubAssociation,
      );
    }
  });

  it("makes AMOS-DMS the authority and Microsoft 365 only the constrained collaboration layer", () => {
    const architecture = createSyntheticM51aOperationsHubArchitecture();
    expect(architecture).toMatchObject({
      governingSystem: "AMOS-DMS",
      collaborationLayer: "Microsoft 365 constrained synthetic architecture",
      sharePointIsGoverningSystem: false,
      approvedByRole: "managing-director",
      liveSiteProvisioning: false,
      liveExternalWrites: 0,
      realDataUsed: false,
      synthetic: true,
    });
    expect(validateM51aOperationsHubArchitecture(architecture)).toEqual([]);
  });

  it("requires every site owner, purpose, and synthetic boundary", () => {
    for (const site of createSyntheticM51aHubTopology()) {
      expect(site.ownerRole).toBeTruthy();
      expect(site.purpose.length).toBeGreaterThan(20);
      expect(site.architectureState).toBe("approved_synthetic_architecture");
      expect(site.liveMicrosoftSiteId).toBeNull();
      expect(site.liveProvisioningAvailable).toBe(false);
      expect(site.synthetic).toBe(true);
    }
  });

  it("detects duplicate and missing topology identities", () => {
    const sites = createSyntheticM51aHubTopology();
    const corrupted = [sites[0], sites[0], ...sites.slice(2)];
    expect(validateM51aHubTopology(corrupted)).toEqual(
      expect.arrayContaining([
        `DUPLICATE_SITE_ID:${sites[0].siteId}`,
        `DUPLICATE_SITE_CODE:${sites[0].code}`,
        "REQUIRED_SITE_MISSING:corporate-office",
      ]),
    );
  });

  it("fails closed when a restricted zone is associated or exposed", () => {
    const sites = createSyntheticM51aHubTopology();
    const restricted = sites.find(
      (site) => site.code === "restricted-sud-part2",
    )!;
    const corrupted = sites.map((site) =>
      site.code === restricted.code
        ? {
            ...site,
            parentHubSiteId: M51A_OPERATIONS_HUB_SITE_ID,
            sharedNavigationEligible: true,
            contentRollupEligible: true,
          }
        : site,
    );
    expect(validateM51aHubTopology(corrupted)).toContain(
      "RESTRICTED_ZONE_EXPOSURE:restricted-sud-part2",
    );
  });

  it("rejects an associated site with disabled hub visibility or no lifecycle boundary", () => {
    const sites = createSyntheticM51aHubTopology();
    const corrupted = sites.map((site) =>
      site.code === "bhc-operations"
        ? {
            ...site,
            sharedNavigationEligible: false,
            contentRollupEligible: false,
            generalSearchEligible: false,
            lifecycleBoundary: "",
          }
        : site,
    );
    expect(validateM51aHubTopology(corrupted)).toEqual(
      expect.arrayContaining([
        "ASSOCIATED_SITE_VISIBILITY_INVALID:bhc-operations",
        "SITE_LIFECYCLE_BOUNDARY_REQUIRED:bhc-operations",
      ]),
    );
  });
});
