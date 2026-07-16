import {
  M51A_HUB_CRITERION_IDS,
  M51A_HUB_EVALUATION_AS_OF,
  type M51aHubArchitectureScenarioResult,
  type M51aHubCriterionResult,
  type M51aOperationsHubArchitecture,
} from "@contracts/m51a/operations-hub";
import {
  createSyntheticM51aHubContentModel,
  validateM51aHubContentModel,
} from "./content-model";
import {
  createSyntheticM51aHandlingClasses,
  evaluateM51aHandlingAction,
  validateM51aHandlingClasses,
} from "./handling-policy";
import {
  buildAllM51aRoleRouteProjections,
  createSyntheticM51aIntranetMap,
  resolveM51aIntranetRoute,
  validateM51aIntranetMap,
} from "./intranet-map";
import {
  createSyntheticM51aPublishingCandidates,
  selectM51aAuthoritativeGuidance,
} from "./publishing";
import {
  createSyntheticM51aHubTopology,
  m51aHubImmutable,
  validateM51aHubTopology,
} from "./topology";

function criterion(
  criterionId: M51aHubCriterionResult["criterionId"],
  passed: boolean,
  assertionCount: number,
  summary: string,
  evidenceIds: readonly string[],
): M51aHubCriterionResult {
  return m51aHubImmutable({
    criterionId,
    passed,
    assertionCount,
    summary,
    evidenceIds: m51aHubImmutable([...evidenceIds]),
  });
}

export function createSyntheticM51aOperationsHubArchitecture(): M51aOperationsHubArchitecture {
  const sites = createSyntheticM51aHubTopology();
  const contentModel = createSyntheticM51aHubContentModel();
  const handlingClasses = createSyntheticM51aHandlingClasses();
  const intranetRoutes = createSyntheticM51aIntranetMap();
  return m51aHubImmutable({
    architectureId: "SYNTH-M51A-OPERATIONS-HUB-ARCHITECTURE-V1",
    name: "Adolbi Care Operations Hub",
    governingSystem: "AMOS-DMS",
    collaborationLayer: "Microsoft 365 constrained synthetic architecture",
    sharePointIsGoverningSystem: false,
    sites,
    libraries: contentModel.libraries,
    contentTypes: contentModel.contentTypes,
    metadataDefinitions: contentModel.metadataDefinitions,
    handlingClasses,
    intranetRoutes,
    approvedAt: M51A_HUB_EVALUATION_AS_OF,
    approvedByRole: "managing-director",
    liveSiteProvisioning: false,
    liveExternalWrites: 0,
    realDataUsed: false,
    synthetic: true,
  });
}

export function validateM51aOperationsHubArchitecture(
  architecture: M51aOperationsHubArchitecture,
): readonly string[] {
  const errors: string[] = [];
  if (
    architecture.governingSystem !== "AMOS-DMS" ||
    architecture.sharePointIsGoverningSystem !== false
  )
    errors.push("AMOS_DMS_GOVERNING_AUTHORITY_REQUIRED");
  if (
    architecture.liveSiteProvisioning !== false ||
    architecture.liveExternalWrites !== 0 ||
    architecture.realDataUsed !== false ||
    !architecture.synthetic
  )
    errors.push("OPERATIONS_HUB_SYNTHETIC_BOUNDARY_INVALID");
  errors.push(...validateM51aHubTopology(architecture.sites));
  errors.push(
    ...validateM51aHubContentModel(
      {
        libraries: architecture.libraries,
        contentTypes: architecture.contentTypes,
        metadataDefinitions: architecture.metadataDefinitions,
        synthetic: true,
      },
      architecture.sites,
    ),
  );
  errors.push(...validateM51aHandlingClasses(architecture.handlingClasses));
  errors.push(
    ...validateM51aIntranetMap(
      architecture.intranetRoutes,
      architecture.sites,
    ),
  );
  return m51aHubImmutable([...new Set(errors)]);
}

export function runM51aHubArchitectureScenario(): M51aHubArchitectureScenarioResult {
  const architecture = createSyntheticM51aOperationsHubArchitecture();
  const topologyValidationErrors = validateM51aHubTopology(architecture.sites);
  const contentModelValidationErrors = validateM51aHubContentModel(
    {
      libraries: architecture.libraries,
      contentTypes: architecture.contentTypes,
      metadataDefinitions: architecture.metadataDefinitions,
      synthetic: true,
    },
    architecture.sites,
  );
  const handlingValidationErrors = validateM51aHandlingClasses(
    architecture.handlingClasses,
  );
  const routeValidationErrors = validateM51aIntranetMap(
    architecture.intranetRoutes,
    architecture.sites,
  );
  const roleProjections = buildAllM51aRoleRouteProjections(
    architecture.intranetRoutes,
    architecture.sites,
  );
  const publishing = selectM51aAuthoritativeGuidance(
    createSyntheticM51aPublishingCandidates(),
  );
  const associatedOperationalSites = architecture.sites.filter(
    (site) => site.kind === "associated_operational_site",
  ).length;
  const restrictedOrSystemZones = architecture.sites.filter(
    (site) =>
      site.kind === "restricted_record_zone" ||
      site.kind === "system_managed_zone",
  ).length;
  const allRolesHaveCoreRoutes = roleProjections.every((projection) => {
    const codes = new Set(projection.routes.map((route) => route.code));
    return (
      codes.has("home-enterprise-operations") &&
      codes.has("my-work-eia") &&
      codes.has("enterprise-dms-search")
    );
  });
  const unknownRoleDenied = !resolveM51aIntranetRoute(
    "unknown-role",
    "home-enterprise-operations",
    architecture.intranetRoutes,
    architecture.sites,
  ).allowed;
  const handlingChecks = {
    unknownClassDenied: !evaluateM51aHandlingAction({
      role: "managing-director",
      handlingClass: "unknown",
      action: "index",
    }).allowed,
    part2GeneralDenied: !evaluateM51aHandlingAction({
      role: "clinical-director",
      handlingClass: "restricted-sud-part2",
      action: "general_rollup",
    }).allowed,
    part2MetadataTrimmed:
      evaluateM51aHandlingAction({
        role: "therapist",
        handlingClass: "restricted-sud-part2",
        action: "metadata_read",
      }).metadataOnly,
    restrictedDownloadDenied: !evaluateM51aHandlingAction({
      role: "clinical-director",
      handlingClass: "restricted-clinical",
      action: "download",
    }).allowed,
  };

  const criteria = m51aHubImmutable([
    criterion(
      "M5.1A-HUB-01",
      topologyValidationErrors.length === 0 &&
        architecture.sites.length === 14 &&
        associatedOperationalSites === 6 &&
        restrictedOrSystemZones === 7 &&
        architecture.governingSystem === "AMOS-DMS" &&
        !architecture.sharePointIsGoverningSystem,
      8,
      "One governed Operations Hub, six associated operational sites, and seven segregated restricted/system zones validate with AMOS-DMS authority.",
      ["M51A_HUB_TOPOLOGY"],
    ),
    criterion(
      "M5.1A-HUB-02",
      contentModelValidationErrors.length === 0 &&
        architecture.libraries.length === 10 &&
        architecture.contentTypes.length === 11 &&
        architecture.metadataDefinitions.length === 18 &&
        architecture.libraries.filter(
          (library) => library.authoritativeGuidanceEligible,
        ).length === 1,
      7,
      "Ten libraries, eleven content types, and eighteen required metadata fields form one internally consistent content architecture.",
      ["M51A_HUB_CONTENT_MODEL"],
    ),
    criterion(
      "M5.1A-HUB-03",
      handlingValidationErrors.length === 0 &&
        architecture.handlingClasses.length === 6 &&
        Object.values(handlingChecks).every(Boolean),
      7,
      "Six synthetic handling classes enforce permission trimming, restricted-zone containment, DLP/download rules, and metadata-only boundaries.",
      ["M51A_HUB_HANDLING_POLICY"],
    ),
    criterion(
      "M5.1A-HUB-04",
      routeValidationErrors.length === 0 &&
        architecture.intranetRoutes.length === 11 &&
        roleProjections.length === 36 &&
        allRolesHaveCoreRoutes &&
        unknownRoleDenied,
      8,
      "The eleven-area stable logical intranet map is evaluated for all thirty-six canonical roles and denies unknown roles without disclosing targets.",
      ["M51A_HUB_INTRANET_MAP"],
    ),
    criterion(
      "M5.1A-HUB-05",
      publishing.citations.length === 2 &&
        publishing.deniedObjectIds.length === 5 &&
        publishing.decisions.every(
          (decision) =>
            !decision.liveMicrosoftPublishPerformed &&
            decision.liveExternalWrites === 0,
        ),
      7,
      "Only approved, current, source-visible Published Intranet Content becomes authoritative staff guidance; all other states fail closed.",
      ["M51A_HUB_AUTHORITATIVE_PUBLISHING"],
    ),
  ]);
  const firstFivePassed = criteria.every((item) => item.passed);
  const completeCriteria = m51aHubImmutable([
    ...criteria,
    criterion(
      "M5.1A-HUB-06",
      firstFivePassed &&
        validateM51aOperationsHubArchitecture(architecture).length === 0 &&
        architecture.liveExternalWrites === 0 &&
        !architecture.realDataUsed &&
        !architecture.liveSiteProvisioning,
      8,
      "The integrated architecture cross-references topology, content, handling, routes, roles, and publishing with zero real data or live Microsoft writes.",
      ["M51A_HUB_ARCHITECTURE_SCENARIO"],
    ),
  ]);
  if (completeCriteria.length !== M51A_HUB_CRITERION_IDS.length)
    throw new Error("M51A_HUB_CRITERION_COUNT_INVALID");

  return m51aHubImmutable({
    scenarioId: "SYNTH-M51A-HUB-ARCHITECTURE-SCENARIO",
    executedAt: M51A_HUB_EVALUATION_AS_OF,
    architecture,
    topologyValidationErrors,
    contentModelValidationErrors,
    handlingValidationErrors,
    routeValidationErrors,
    roleProjections,
    publishingDecisions: publishing.decisions,
    criteria: completeCriteria,
    accepted: completeCriteria.every((item) => item.passed),
    totals: m51aHubImmutable({
      sites: architecture.sites.length,
      associatedOperationalSites,
      restrictedOrSystemZones,
      libraries: architecture.libraries.length,
      contentTypes: architecture.contentTypes.length,
      metadataFields: architecture.metadataDefinitions.length,
      handlingClasses: architecture.handlingClasses.length,
      intranetDestinations: architecture.intranetRoutes.length,
      canonicalRolesEvaluated: roleProjections.length,
      authoritativeGuidanceItems: publishing.citations.length,
      productionRows: 0,
      liveExternalWrites: 0,
    }),
    synthetic: true,
  });
}
