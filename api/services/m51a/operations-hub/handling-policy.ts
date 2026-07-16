import {
  M51A_HANDLING_CLASS_CODES,
  type M51aDownloadBehavior,
  type M51aHandlingAction,
  type M51aHandlingClass,
  type M51aHandlingClassCode,
  type M51aHandlingDecision,
  type M51aIndexBehavior,
} from "@contracts/m51a/operations-hub";
import {
  authorizeAccess,
  ROLE_TIER_BY_ROLE,
  type RoleTier,
} from "@/constants/access-control";
import { ALL_ROLES, type UserRole } from "@/constants/roles";
import { m51aHubDeterministicId, m51aHubImmutable } from "./topology";

function handling(
  code: M51aHandlingClassCode,
  name: string,
  minimumTier: RoleTier,
  indexBehavior: M51aIndexBehavior,
  downloadBehavior: M51aDownloadBehavior,
  generalHubRollupAllowed: boolean,
): M51aHandlingClass {
  return m51aHubImmutable({
    classId: `SYNTH-M51A-HANDLING-${code.toUpperCase()}`,
    code,
    name,
    syntheticPurviewLabelRef: `SYNTH-PURVIEW-${code.toUpperCase()}`,
    minimumTier,
    auditRequired: true,
    dlpPolicyRef: `SYNTH-DLP-${code.toUpperCase()}`,
    indexBehavior,
    downloadBehavior,
    generalHubRollupAllowed,
    permissionTrimmed: true,
    livePurviewActivation: false,
    synthetic: true,
  });
}

export function createSyntheticM51aHandlingClasses(): readonly M51aHandlingClass[] {
  return m51aHubImmutable([
    handling(
      "internal-general",
      "Internal General",
      "T4",
      "general_permission_trimmed",
      "allowed_audited",
      true,
    ),
    handling(
      "internal-controlled",
      "Internal Controlled",
      "T4",
      "permission_trimmed",
      "controlled_audited",
      true,
    ),
    handling(
      "confidential",
      "Confidential",
      "T3",
      "permission_trimmed",
      "controlled_audited",
      false,
    ),
    handling(
      "restricted-clinical",
      "Restricted Clinical",
      "T4",
      "metadata_only_permission_trimmed",
      "blocked",
      false,
    ),
    handling(
      "restricted-sud-part2",
      "Restricted SUD / Part 2",
      "T4",
      "metadata_only_permission_trimmed",
      "blocked",
      false,
    ),
    handling(
      "restricted-workforce-financial",
      "Restricted Workforce / Financial",
      "T4",
      "metadata_only_permission_trimmed",
      "blocked",
      false,
    ),
  ]);
}

const PART2_ROLES = new Set<UserRole>([
  "super-admin",
  "managing-director",
  "administrator",
  "bhc-director",
  "treatment-director",
  "clinical-director",
  "clinical-supervisor",
  "therapist",
  "nurse",
  "qmhp-cs",
]);

function canonicalRole(role: string): UserRole | null {
  return ALL_ROLES.includes(role as UserRole) ? (role as UserRole) : null;
}

function restrictedDomainAllowed(
  role: UserRole,
  handlingClass: M51aHandlingClassCode,
): boolean {
  if (handlingClass === "restricted-clinical")
    return authorizeAccess(
      { role },
      { domain: "clinical", action: "read", division: "bhc" },
    ).allowed;
  if (handlingClass === "restricted-sud-part2")
    return (
      PART2_ROLES.has(role) &&
      authorizeAccess(
        { role },
        { domain: "clinical", action: "read", division: "bhc" },
      ).allowed
    );
  if (handlingClass === "restricted-workforce-financial")
    return (
      authorizeAccess({ role }, { domain: "hr", action: "read" }).allowed ||
      authorizeAccess({ role }, { domain: "revenue", action: "read" }).allowed
    );
  return true;
}

function tierRank(tier: RoleTier): number {
  return { T1: 1, T2: 2, T3: 3, T4: 4 }[tier];
}

export function evaluateM51aHandlingAction(input: {
  role: string;
  handlingClass: string;
  action: M51aHandlingAction;
}): M51aHandlingDecision {
  const role = canonicalRole(input.role);
  const policy = createSyntheticM51aHandlingClasses().find(
    (candidate) => candidate.code === input.handlingClass,
  );
  const reasonCodes: string[] = [];
  if (!role) reasonCodes.push("UNKNOWN_ROLE");
  if (!policy) reasonCodes.push("UNKNOWN_HANDLING_CLASS");
  let allowed = reasonCodes.length === 0;
  let metadataOnly = false;

  if (role && policy) {
    const roleTier = ROLE_TIER_BY_ROLE[role];
    if (tierRank(roleTier) > tierRank(policy.minimumTier)) {
      allowed = false;
      reasonCodes.push(`MINIMUM_TIER_REQUIRED:${policy.minimumTier}`);
    }
    if (
      (input.action === "general_navigation" ||
        input.action === "general_rollup") &&
      !policy.generalHubRollupAllowed
    ) {
      allowed = false;
      reasonCodes.push("GENERAL_HUB_EXPOSURE_DENIED");
    }
    if (input.action === "index") {
      if (policy.indexBehavior === "excluded") {
        allowed = false;
        reasonCodes.push("INDEXING_EXCLUDED");
      }
      metadataOnly = policy.indexBehavior === "metadata_only_permission_trimmed";
    }
    if (input.action === "download" && policy.downloadBehavior === "blocked") {
      allowed = false;
      reasonCodes.push("DOWNLOAD_BLOCKED_BY_HANDLING_CLASS");
    }
    if (
      policy.code.startsWith("restricted-") &&
      !restrictedDomainAllowed(role, policy.code)
    ) {
      allowed = false;
      reasonCodes.push("RESTRICTED_DOMAIN_PERMISSION_DENIED");
    }
    if (
      policy.indexBehavior === "metadata_only_permission_trimmed" &&
      input.action === "content_read"
    ) {
      allowed = false;
      metadataOnly = true;
      reasonCodes.push("METADATA_ONLY_IN_HUB_CONTEXT");
    }
    if (
      policy.indexBehavior === "metadata_only_permission_trimmed" &&
      input.action === "metadata_read"
    )
      metadataOnly = true;
  }

  if (allowed) reasonCodes.push("HANDLING_POLICY_ALLOWED");
  return m51aHubImmutable({
    decisionId: m51aHubDeterministicId(
      "M51A-HANDLING",
      input.role,
      input.handlingClass,
      input.action,
    ),
    handlingClass: policy?.code ?? "unknown",
    action: input.action,
    allowed,
    metadataOnly,
    permissionTrimmed: true,
    reasonCodes: m51aHubImmutable(reasonCodes),
    livePolicyMutation: false,
    synthetic: true,
  });
}

export function validateM51aHandlingClasses(
  classes: readonly M51aHandlingClass[],
): readonly string[] {
  const errors: string[] = [];
  const codes = new Set<M51aHandlingClassCode>();
  for (const item of classes) {
    if (codes.has(item.code)) errors.push(`DUPLICATE_HANDLING_CLASS:${item.code}`);
    codes.add(item.code);
    if (!item.syntheticPurviewLabelRef.startsWith("SYNTH-PURVIEW-"))
      errors.push(`SYNTHETIC_LABEL_REFERENCE_REQUIRED:${item.code}`);
    if (!item.dlpPolicyRef.startsWith("SYNTH-DLP-"))
      errors.push(`SYNTHETIC_DLP_REFERENCE_REQUIRED:${item.code}`);
    if (
      item.livePurviewActivation !== false ||
      !item.auditRequired ||
      !item.permissionTrimmed ||
      !item.synthetic
    )
      errors.push(`HANDLING_BOUNDARY_INVALID:${item.code}`);
    if (
      item.code.startsWith("restricted-") &&
      (item.generalHubRollupAllowed || item.downloadBehavior !== "blocked")
    )
      errors.push(`RESTRICTED_HANDLING_EXPOSURE:${item.code}`);
  }
  for (const code of M51A_HANDLING_CLASS_CODES)
    if (!codes.has(code)) errors.push(`REQUIRED_HANDLING_CLASS_MISSING:${code}`);
  return m51aHubImmutable([...new Set(errors)]);
}
