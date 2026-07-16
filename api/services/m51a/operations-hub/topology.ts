import {
  M51A_SITE_CODES,
  type M51aHubSite,
  type M51aSiteCode,
} from "@contracts/m51a/operations-hub";

function token(value: string): string {
  return (
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 46) || "EMPTY"
  );
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

export function m51aHubDeterministicId(
  prefix: string,
  ...parts: readonly string[]
): string {
  return `SYNTH-${token(prefix)}-${stableHash(parts.join("|"))}`;
}

export function m51aHubImmutable<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function site(
  input: Omit<
    M51aHubSite,
    | "siteId"
    | "architectureState"
    | "liveMicrosoftSiteId"
    | "liveProvisioningAvailable"
    | "synthetic"
  >,
): M51aHubSite {
  return m51aHubImmutable({
    ...input,
    siteId: `SYNTH-M51A-SITE-${token(input.code)}`,
    architectureState: "approved_synthetic_architecture",
    liveMicrosoftSiteId: null,
    liveProvisioningAvailable: false,
    synthetic: true,
  });
}

export const M51A_OPERATIONS_HUB_SITE_ID =
  "SYNTH-M51A-SITE-OPERATIONS-HUB" as const;

export function createSyntheticM51aHubTopology(): readonly M51aHubSite[] {
  return m51aHubImmutable([
    site({
      code: "operations-hub",
      name: "Adolbi Care Operations Hub",
      kind: "communication_hub",
      purpose:
        "Shared navigation, branding, operational knowledge discovery, and governed content roll-up under AMOS-DMS authority.",
      ownerRole: "managing-director",
      divisionId: "enterprise",
      hubAssociation: "governing_hub",
      parentHubSiteId: null,
      sharedNavigationEligible: true,
      contentRollupEligible: true,
      generalSearchEligible: true,
      lifecycleBoundary:
        "Publishes approved operational guidance; never governs restricted systems of record.",
    }),
    site({
      code: "corporate-office",
      name: "Corporate Office Operations",
      kind: "associated_operational_site",
      purpose: "Enterprise governance, administration, strategy, and shared operating knowledge.",
      ownerRole: "administrator",
      divisionId: "eo",
      hubAssociation: "associated",
      parentHubSiteId: M51A_OPERATIONS_HUB_SITE_ID,
      sharedNavigationEligible: true,
      contentRollupEligible: true,
      generalSearchEligible: true,
      lifecycleBoundary: "Non-restricted corporate operational content only.",
    }),
    site({
      code: "bhc-operations",
      name: "BHC Operations",
      kind: "associated_operational_site",
      purpose: "Behavioral Health Center program operations and approved non-record clinical guidance.",
      ownerRole: "bhc-director",
      divisionId: "bhc",
      hubAssociation: "associated",
      parentHubSiteId: M51A_OPERATIONS_HUB_SITE_ID,
      sharedNavigationEligible: true,
      contentRollupEligible: true,
      generalSearchEligible: true,
      lifecycleBoundary: "Operational guidance only; client records remain in segregated zones.",
    }),
    site({
      code: "gro-operations",
      name: "GRO Operations",
      kind: "associated_operational_site",
      purpose: "Residential operations, approved procedures, safety, and campus knowledge.",
      ownerRole: "gro-administrator",
      divisionId: "gro",
      hubAssociation: "associated",
      parentHubSiteId: M51A_OPERATIONS_HUB_SITE_ID,
      sharedNavigationEligible: true,
      contentRollupEligible: true,
      generalSearchEligible: true,
      lifecycleBoundary: "Residential operating guidance; youth records are excluded.",
    }),
    site({
      code: "learning-workforce",
      name: "Learning and Workforce",
      kind: "associated_operational_site",
      purpose: "Published learning, competency, onboarding, and workforce-development knowledge.",
      ownerRole: "hr-director",
      divisionId: "eo",
      hubAssociation: "associated",
      parentHubSiteId: M51A_OPERATIONS_HUB_SITE_ID,
      sharedNavigationEligible: true,
      contentRollupEligible: true,
      generalSearchEligible: true,
      lifecycleBoundary: "Learning content only; personnel records remain segregated.",
    }),
    site({
      code: "contracts-projects",
      name: "Contracts and Projects",
      kind: "associated_operational_site",
      purpose: "Approved partnership, growth, project, change, and release collaboration.",
      ownerRole: "managing-director",
      divisionId: "eo",
      hubAssociation: "associated",
      parentHubSiteId: M51A_OPERATIONS_HUB_SITE_ID,
      sharedNavigationEligible: true,
      contentRollupEligible: true,
      generalSearchEligible: true,
      lifecycleBoundary: "Approved collaboration content; privileged legal records remain segregated.",
    }),
    site({
      code: "future-campus",
      name: "Future Campus Operations",
      kind: "associated_operational_site",
      purpose: "Approved future-campus planning and operational-readiness knowledge.",
      ownerRole: "facilities-manager",
      divisionId: "gad",
      hubAssociation: "associated",
      parentHubSiteId: M51A_OPERATIONS_HUB_SITE_ID,
      sharedNavigationEligible: true,
      contentRollupEligible: true,
      generalSearchEligible: true,
      lifecycleBoundary: "Planning and readiness artifacts only; future provisioning remains disabled.",
    }),
    site({
      code: "restricted-clinical-records",
      name: "Restricted Clinical Records Zone",
      kind: "restricted_record_zone",
      purpose: "Segregated synthetic clinical-record architecture reference.",
      ownerRole: "clinical-director",
      divisionId: "bhc",
      hubAssociation: "segregated",
      parentHubSiteId: null,
      sharedNavigationEligible: false,
      contentRollupEligible: false,
      generalSearchEligible: false,
      lifecycleBoundary: "No general hub navigation, roll-up, or broad indexing.",
    }),
    site({
      code: "restricted-sud-part2",
      name: "Restricted SUD and Part 2 Zone",
      kind: "restricted_record_zone",
      purpose: "Separately permissioned synthetic SUD and Part 2 architecture reference.",
      ownerRole: "clinical-director",
      divisionId: "bhc",
      hubAssociation: "segregated",
      parentHubSiteId: null,
      sharedNavigationEligible: false,
      contentRollupEligible: false,
      generalSearchEligible: false,
      lifecycleBoundary: "Metadata-only or excluded; explicit consent and permission required.",
    }),
    site({
      code: "restricted-personnel",
      name: "Restricted Personnel Records Zone",
      kind: "restricted_record_zone",
      purpose: "Segregated workforce and personnel record architecture reference.",
      ownerRole: "hr-director",
      divisionId: "eo",
      hubAssociation: "segregated",
      parentHubSiteId: null,
      sharedNavigationEligible: false,
      contentRollupEligible: false,
      generalSearchEligible: false,
      lifecycleBoundary: "Personnel records never enter general workforce navigation or roll-up.",
    }),
    site({
      code: "restricted-payroll",
      name: "Restricted Payroll Zone",
      kind: "restricted_record_zone",
      purpose: "Segregated payroll record architecture reference.",
      ownerRole: "hr-director",
      divisionId: "eo",
      hubAssociation: "segregated",
      parentHubSiteId: null,
      sharedNavigationEligible: false,
      contentRollupEligible: false,
      generalSearchEligible: false,
      lifecycleBoundary: "Payroll content is excluded from the general hub corpus.",
    }),
    site({
      code: "restricted-finance",
      name: "Restricted Finance Zone",
      kind: "restricted_record_zone",
      purpose: "Segregated finance and revenue record architecture reference.",
      ownerRole: "revenue-cycle-manager",
      divisionId: "eo",
      hubAssociation: "segregated",
      parentHubSiteId: null,
      sharedNavigationEligible: false,
      contentRollupEligible: false,
      generalSearchEligible: false,
      lifecycleBoundary: "Restricted financial records are never broadly indexed or rolled up.",
    }),
    site({
      code: "restricted-legal",
      name: "Restricted Legal Zone",
      kind: "restricted_record_zone",
      purpose: "Segregated privileged legal record architecture reference.",
      ownerRole: "administrator",
      divisionId: "eo",
      hubAssociation: "segregated",
      parentHubSiteId: null,
      sharedNavigationEligible: false,
      contentRollupEligible: false,
      generalSearchEligible: false,
      lifecycleBoundary: "Privileged legal content remains outside general navigation and indexing.",
    }),
    site({
      code: "system-managed",
      name: "Excluded System-Managed Repository Zone",
      kind: "system_managed_zone",
      purpose: "PersonalCacheLibrary, HR365 support, and other dependency-managed repository exclusions.",
      ownerRole: "super-admin",
      divisionId: "enterprise",
      hubAssociation: "excluded_system_managed",
      parentHubSiteId: null,
      sharedNavigationEligible: false,
      contentRollupEligible: false,
      generalSearchEligible: false,
      lifecycleBoundary: "Excluded from ordinary migration, crawling, indexing, and writes.",
    }),
  ] satisfies M51aHubSite[]);
}

export function validateM51aHubTopology(
  sites: readonly M51aHubSite[],
): readonly string[] {
  const errors: string[] = [];
  const siteIds = new Set<string>();
  const codes = new Set<M51aSiteCode>();
  for (const candidate of sites) {
    if (siteIds.has(candidate.siteId))
      errors.push(`DUPLICATE_SITE_ID:${candidate.siteId}`);
    if (codes.has(candidate.code))
      errors.push(`DUPLICATE_SITE_CODE:${candidate.code}`);
    siteIds.add(candidate.siteId);
    codes.add(candidate.code);
    if (!candidate.ownerRole) errors.push(`SITE_OWNER_REQUIRED:${candidate.code}`);
    if (!candidate.purpose.trim()) errors.push(`SITE_PURPOSE_REQUIRED:${candidate.code}`);
    if (!candidate.lifecycleBoundary.trim())
      errors.push(`SITE_LIFECYCLE_BOUNDARY_REQUIRED:${candidate.code}`);
    if (
      candidate.liveMicrosoftSiteId !== null ||
      candidate.liveProvisioningAvailable !== false ||
      !candidate.synthetic
    )
      errors.push(`SITE_SYNTHETIC_BOUNDARY_INVALID:${candidate.code}`);
  }
  for (const requiredCode of M51A_SITE_CODES)
    if (!codes.has(requiredCode)) errors.push(`REQUIRED_SITE_MISSING:${requiredCode}`);

  const hubs = sites.filter((candidate) => candidate.kind === "communication_hub");
  if (hubs.length !== 1) errors.push("EXACTLY_ONE_COMMUNICATION_HUB_REQUIRED");
  const hub = hubs[0];
  if (
    hub &&
    (hub.siteId !== M51A_OPERATIONS_HUB_SITE_ID ||
      hub.hubAssociation !== "governing_hub" ||
      hub.parentHubSiteId !== null ||
      !hub.sharedNavigationEligible ||
      !hub.contentRollupEligible ||
      !hub.generalSearchEligible)
  )
    errors.push("OPERATIONS_HUB_AUTHORITY_INVALID");

  for (const candidate of sites) {
    if (candidate.kind === "associated_operational_site") {
      if (
        candidate.parentHubSiteId !== M51A_OPERATIONS_HUB_SITE_ID ||
        candidate.hubAssociation !== "associated"
      )
        errors.push(`ASSOCIATED_SITE_PARENT_INVALID:${candidate.code}`);
      if (
        !candidate.sharedNavigationEligible ||
        !candidate.contentRollupEligible ||
        !candidate.generalSearchEligible
      )
        errors.push(`ASSOCIATED_SITE_VISIBILITY_INVALID:${candidate.code}`);
    }
    if (
      candidate.kind === "restricted_record_zone" ||
      candidate.kind === "system_managed_zone"
    ) {
      if (
        candidate.parentHubSiteId !== null ||
        candidate.sharedNavigationEligible ||
        candidate.contentRollupEligible ||
        candidate.generalSearchEligible
      )
        errors.push(`RESTRICTED_ZONE_EXPOSURE:${candidate.code}`);
      if (
        !["segregated", "excluded_system_managed"].includes(
          candidate.hubAssociation,
        )
      )
        errors.push(`RESTRICTED_ZONE_ASSOCIATION_INVALID:${candidate.code}`);
    }
  }
  return m51aHubImmutable([...new Set(errors)]);
}
