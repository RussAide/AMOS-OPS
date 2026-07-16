import {
  ENTERPRISE_ROLE_REGISTRY,
  ROLE_TIER_BY_ROLE,
  type RoleTier,
} from "@/constants/access-control";
import type { DivisionId } from "@/constants/organization";
import type { Permissions, UserRole } from "@/constants/roles";
import {
  assertM41bAuthorizedRole,
  assertM41bDivisionAccess,
  buildM41bRoleContext,
  M41B_CADENCES,
  M41B_ENVIRONMENT_LABEL,
  M41B_EVALUATION_AS_OF,
  M41B_SOURCE_REGISTER,
  canViewM41bSource,
  m41bSourceById,
  m41bTierAtLeast,
  type M41bCadence,
  type M41bCadenceBrief,
  type M41bGovernedSource,
  type M41bRecommendation,
  type M41bRoleContext,
  type M41bSourceState,
  type M41bWorkplan,
  type M41bWorkplanItem,
  type M41bWorkplanStatus,
} from "@contracts/m41b";

/**
 * Runtime workflow state is deliberately supplied separately from source truth.
 * Source content always comes from M41B_SOURCE_REGISTER; callers may only supply
 * already-persisted task state and human-approved recommendations.
 */
export interface M41bWorkplanBuildOptions {
  requestedDivision?: DivisionId;
  asOf?: string;
  existingItems?: readonly M41bWorkplanItem[];
  approvedRecommendations?: readonly M41bRecommendation[];
}

export interface M41bWorkplanTransition {
  status: M41bWorkplanStatus;
  approvalId?: string | null;
  dueAt?: string;
  dependencyIds?: readonly string[];
  completionEvidenceIds?: readonly string[];
  closedAt?: string | null;
}

interface BuildContext {
  roleContext: M41bRoleContext;
  requestedDivision?: DivisionId;
  asOf: string;
}

const CADENCE_META: Readonly<
  Record<
    M41bCadence,
    {
      label: string;
      purpose: string;
      predecessor: M41bCadence | null;
      baselineSourceId: string;
    }
  >
> = {
  daily: {
    label: "Daily / shift",
    purpose:
      "start-of-day or shift priorities, exceptions, handoffs, and evidence due",
    predecessor: null,
    baselineSourceId: "M41B-SRC-DAILY-OPS",
  },
  weekly: {
    label: "Weekly",
    purpose: "caseload, team, operating, and unresolved-exception review",
    predecessor: "daily",
    baselineSourceId: "M41B-SRC-WEEKLY-REVIEW",
  },
  monthly: {
    label: "Monthly",
    purpose: "performance, stewardship, quality, and corrective-action review",
    predecessor: "weekly",
    baselineSourceId: "M41B-SRC-MONTHLY-PERFORMANCE",
  },
  quarterly: {
    label: "Quarterly",
    purpose: "strategy, compliance, access, risk, and dependency review",
    predecessor: "monthly",
    baselineSourceId: "M41B-SRC-QUARTERLY-COMPLIANCE",
  },
  annual: {
    label: "Annual",
    purpose:
      "planning, reauthorization, accountability, and evidence-retention review",
    predecessor: "quarterly",
    baselineSourceId: "M41B-SRC-ANNUAL-PLANNING",
  },
};

const TIER_FOCUS: Readonly<Record<RoleTier, string>> = {
  T1: "enterprise leadership",
  T2: "division leadership",
  T3: "branch and supervisory",
  T4: "frontline and owned-work",
};

const PRIORITY_RANK: Readonly<Record<M41bWorkplanItem["priority"], number>> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const STATUS_WEIGHT: Readonly<Record<M41bWorkplanStatus, number>> = {
  proposed: 0,
  pending_approval: 8,
  approved: 5,
  in_progress: 15,
  evidence_pending: 24,
  completed: -100,
  escalated: 45,
  refused: -100,
};

const STATE_WEIGHT: Readonly<Record<M41bSourceState, number>> = {
  current: 10,
  stale: 38,
  missing: 86,
  contradictory: 82,
  suppressed: 70,
};

const SOURCE_TYPE_WEIGHT: Readonly<
  Record<M41bGovernedSource["sourceType"], number>
> = {
  policy: 5,
  workflow: 6,
  dashboard_alert: 34,
  meeting_action: 18,
  audit_finding: 28,
  exception: 32,
  commitment: 16,
  performance_record: 12,
};

const CADENCE_WEIGHT: Readonly<Record<M41bCadence, number>> = {
  daily: 15,
  weekly: 10,
  monthly: 7,
  quarterly: 4,
  annual: 2,
};

const TERMINAL_STATUSES = new Set<M41bWorkplanStatus>(["completed", "refused"]);

const ALLOWED_TRANSITIONS: Readonly<
  Record<M41bWorkplanStatus, readonly M41bWorkplanStatus[]>
> = {
  proposed: ["proposed", "pending_approval", "escalated", "refused"],
  pending_approval: ["pending_approval", "approved", "escalated", "refused"],
  approved: ["approved", "in_progress", "escalated", "refused"],
  in_progress: ["in_progress", "evidence_pending", "escalated"],
  evidence_pending: [
    "evidence_pending",
    "in_progress",
    "completed",
    "escalated",
  ],
  completed: ["completed"],
  escalated: [
    "escalated",
    "pending_approval",
    "approved",
    "in_progress",
    "refused",
  ],
  refused: ["refused"],
};

function canonicalRoleEntry(role: UserRole) {
  const entry = ENTERPRISE_ROLE_REGISTRY.find(
    (candidate) => candidate.role === role,
  );
  if (!entry) throw new Error(`M41B_UNKNOWN_ROLE:${role}`);
  return entry;
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function canonicalIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${code}:${value}`);
  return new Date(parsed).toISOString();
}

function copyRoleContext(context: M41bRoleContext): M41bRoleContext {
  return Object.freeze({
    ...context,
    caseloadIds: Object.freeze([...context.caseloadIds]),
    delegatedActions: Object.freeze([...context.delegatedActions]),
    supervisorRoles: Object.freeze([...context.supervisorRoles]),
  });
}

function assertRoleContext(context: M41bRoleContext): void {
  assertM41bAuthorizedRole(context.role);
  const entry = canonicalRoleEntry(context.role);
  if (context.tier !== ROLE_TIER_BY_ROLE[context.role])
    throw new Error(
      `M41B_ROLE_CONTEXT_TIER_MISMATCH:${context.role}:${context.tier}`,
    );
  if (context.division !== entry.division)
    throw new Error(
      `M41B_ROLE_CONTEXT_DIVISION_MISMATCH:${context.role}:${context.division}`,
    );
  if (context.department !== entry.department)
    throw new Error(`M41B_ROLE_CONTEXT_DEPARTMENT_MISMATCH:${context.role}`);
  if (!context.userId.trim())
    throw new Error("M41B_ROLE_CONTEXT_USER_REQUIRED");
  if (context.evidenceClass !== "synthetic_demo")
    throw new Error("M41B_NON_SYNTHETIC_CONTEXT_DENIED");

  const canonicalDelegations = new Set(
    buildM41bRoleContext(context.role).delegatedActions,
  );
  const unauthorizedDelegation = context.delegatedActions.find(
    (action) => !canonicalDelegations.has(action),
  );
  if (unauthorizedDelegation)
    throw new Error(
      `M41B_ROLE_CONTEXT_DELEGATION_MISMATCH:${context.role}:${unauthorizedDelegation}`,
    );
}

function buildContext(
  roleContext: M41bRoleContext,
  options: Pick<M41bWorkplanBuildOptions, "requestedDivision" | "asOf"> = {},
): BuildContext {
  assertRoleContext(roleContext);
  if (options.requestedDivision)
    assertM41bDivisionAccess(roleContext, options.requestedDivision);
  return {
    roleContext,
    requestedDivision: options.requestedDivision,
    asOf: canonicalIso(
      options.asOf ?? M41B_EVALUATION_AS_OF,
      "M41B_INVALID_AS_OF",
    ),
  };
}

function permissionAllowsAction(
  permissions: Permissions,
  source: M41bGovernedSource,
): boolean {
  switch (source.materialDomain) {
    case "clinical":
      return permissions.canEditClinical;
    case "supervisory":
      return permissions.canSupervise;
    case "financial":
      return permissions.canEditRevenue;
    case "regulatory":
      return permissions.canEditCompliance;
    case "personnel":
      return permissions.canEditHR || permissions.canClearPersonnel;
    case "legal":
      return permissions.canEditAdmin || permissions.canViewExecutive;
    case "operational":
      return permissions.canEditOperations || permissions.canEditGRO;
  }
}

function sourceMatchesDivision(
  source: M41bGovernedSource,
  context: BuildContext,
): boolean {
  if (context.requestedDivision)
    return source.divisions.includes(context.requestedDivision);
  if (context.roleContext.tier === "T1") return source.divisions.length > 0;
  return source.divisions.includes(context.roleContext.division);
}

function sourceAuthorized(
  source: M41bGovernedSource,
  context: BuildContext,
): boolean {
  return (
    source.evidenceClass === "synthetic_demo" &&
    m41bTierAtLeast(context.roleContext.tier, source.minimumTier) &&
    sourceMatchesDivision(source, context) &&
    canViewM41bSource(context.roleContext.role, source)
  );
}

/** Returns only canonical source-register records the role may retrieve. */
export function selectM41bSourcesForContext(
  roleContext: M41bRoleContext,
  options: Pick<M41bWorkplanBuildOptions, "requestedDivision" | "asOf"> = {},
): readonly M41bGovernedSource[] {
  const context = buildContext(roleContext, options);
  return Object.freeze(
    M41B_SOURCE_REGISTER.filter((source) => sourceAuthorized(source, context)),
  );
}

function itemDivision(
  source: M41bGovernedSource,
  context: BuildContext,
): DivisionId {
  if (context.requestedDivision) return context.requestedDivision;
  if (source.divisions.includes(context.roleContext.division))
    return context.roleContext.division;
  if (source.divisions.length === 1) return source.divisions[0];
  return context.roleContext.division;
}

function itemNaturalKey(
  context: M41bRoleContext,
  cadence: M41bCadence,
  sourceId: string,
): string {
  return `m41b:${context.userId}:${cadence}:${sourceId}`;
}

function stableToken(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sourceItemId(
  context: M41bRoleContext,
  cadence: M41bCadence,
  sourceId: string,
): string {
  return `SYNTH-M41B-WP-${stableToken(context.userId)}-${cadence.toUpperCase()}-${stableToken(sourceId)}`;
}

function endOfCadence(cadence: M41bCadence, asOf: string): string {
  const date = new Date(asOf);
  switch (cadence) {
    case "daily":
      date.setUTCHours(23, 59, 59, 999);
      break;
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7);
      date.setUTCHours(23, 59, 59, 999);
      break;
    case "monthly":
      date.setUTCMonth(date.getUTCMonth() + 1, 0);
      date.setUTCHours(23, 59, 59, 999);
      break;
    case "quarterly": {
      const nextQuarterMonth = Math.floor(date.getUTCMonth() / 3) * 3 + 3;
      date.setUTCMonth(nextQuarterMonth, 0);
      date.setUTCHours(23, 59, 59, 999);
      break;
    }
    case "annual":
      date.setUTCMonth(11, 31);
      date.setUTCHours(23, 59, 59, 999);
      break;
  }
  return date.toISOString();
}

function caseloadRelevant(
  source: M41bGovernedSource,
  context: M41bRoleContext,
): boolean {
  if (context.caseloadIds.length === 0) return false;
  if (context.caseloadIds.some((id) => source.recordIds.includes(id)))
    return true;
  return (
    source.divisions.includes(context.division) &&
    (source.sensitivity === "clinical" || source.sensitivity === "sud")
  );
}

function scoreToPriority(score: number): M41bWorkplanItem["priority"] {
  if (score >= 105) return "critical";
  if (score >= 72) return "high";
  if (score >= 42) return "medium";
  return "low";
}

function priorityScore(
  source: M41bGovernedSource,
  cadence: M41bCadence,
  context: BuildContext,
  status: M41bWorkplanStatus,
  dueAt: string,
): number {
  const entry = canonicalRoleEntry(context.roleContext.role);
  let score =
    14 +
    STATE_WEIGHT[source.state] +
    SOURCE_TYPE_WEIGHT[source.sourceType] +
    CADENCE_WEIGHT[cadence] +
    STATUS_WEIGHT[status];
  if (source.ownerRole === context.roleContext.role) score += 12;
  if (source.divisions.includes(context.roleContext.division)) score += 8;
  if (caseloadRelevant(source, context.roleContext)) score += 14;
  if (permissionAllowsAction(entry.permissions, source)) score += 8;
  if (
    !context.roleContext.delegatedActions.includes("route_workflow") &&
    source.state !== "current"
  )
    score += 8;
  if (
    !TERMINAL_STATUSES.has(status) &&
    Date.parse(dueAt) < Date.parse(context.asOf)
  )
    score += 80;
  return score;
}

export function deriveM41bPriority(
  sourceId: string,
  cadence: M41bCadence,
  roleContext: M41bRoleContext,
  options: Pick<M41bWorkplanBuildOptions, "requestedDivision" | "asOf"> & {
    status?: M41bWorkplanStatus;
    dueAt?: string;
  } = {},
): M41bWorkplanItem["priority"] {
  const context = buildContext(roleContext, options);
  const source = m41bSourceById(sourceId);
  if (!sourceAuthorized(source, context))
    throw new Error(
      `M41B_SOURCE_ACCESS_DENIED:${roleContext.role}:${sourceId}`,
    );
  if (!source.cadences.includes(cadence))
    throw new Error(
      `M41B_SOURCE_CADENCE_NOT_AUTHORIZED:${sourceId}:${cadence}`,
    );
  const dueAt = canonicalIso(
    options.dueAt ?? endOfCadence(cadence, context.asOf),
    "M41B_INVALID_DUE_AT",
  );
  return scoreToPriority(
    priorityScore(
      source,
      cadence,
      context,
      options.status ?? "pending_approval",
      dueAt,
    ),
  );
}

function predecessorIds(
  source: M41bGovernedSource,
  cadence: M41bCadence,
  context: M41bRoleContext,
): readonly string[] {
  const predecessor = CADENCE_META[cadence].predecessor;
  if (!predecessor) return Object.freeze([]);
  const predecessorSourceId = source.cadences.includes(predecessor)
    ? source.id
    : CADENCE_META[predecessor].baselineSourceId;
  return Object.freeze([
    sourceItemId(context, predecessor, predecessorSourceId),
  ]);
}

function evidenceRequirements(source: M41bGovernedSource): readonly string[] {
  const requirements = [
    `Owner disposition for ${source.id}`,
    `Completion evidence linked to governed record ${source.id}`,
    ...source.missingEvidence,
  ];
  if (source.state === "missing")
    requirements.push(
      "Authorized replacement evidence and accountable-human validation",
    );
  if (source.state === "contradictory")
    requirements.push(
      "Reconciliation record preserving every conflicting source record ID",
    );
  if (source.state === "stale")
    requirements.push(
      "Refreshed source or documented accountable-human exception",
    );
  if (source.state === "suppressed")
    requirements.push(
      "Authorized supervisor route; suppressed content must remain undisclosed",
    );
  return unique(requirements);
}

function objectiveFor(
  source: M41bGovernedSource,
  cadence: M41bCadence,
  context: BuildContext,
): string {
  const caseloadPhrase = context.roleContext.caseloadIds.length
    ? `${context.roleContext.caseloadIds.length} authorized caseload assignment(s)`
    : "the authorized role scope";
  const actionPhrase = permissionAllowsAction(
    canonicalRoleEntry(context.roleContext.role).permissions,
    source,
  )
    ? "disposition and execute within delegated authority"
    : "review and route any material disposition to an accountable human";
  return `${CADENCE_META[cadence].label} ${TIER_FOCUS[context.roleContext.tier]} review for ${caseloadPhrase}: ${actionPhrase}; preserve the ${source.state} source state and required evidence.`;
}

function freezeItem(item: M41bWorkplanItem): M41bWorkplanItem {
  return Object.freeze({
    ...item,
    dependencyIds: Object.freeze([...item.dependencyIds]),
    sourceIds: Object.freeze([...item.sourceIds]),
    evidenceRequirements: Object.freeze([...item.evidenceRequirements]),
    completionEvidenceIds: Object.freeze([...item.completionEvidenceIds]),
  });
}

function sourceToItem(
  source: M41bGovernedSource,
  cadence: M41bCadence,
  context: BuildContext,
): M41bWorkplanItem {
  const dueAt = endOfCadence(cadence, context.asOf);
  const status: M41bWorkplanStatus = "pending_approval";
  return freezeItem({
    id: sourceItemId(context.roleContext, cadence, source.id),
    naturalKey: itemNaturalKey(context.roleContext, cadence, source.id),
    cadence,
    title: `${CADENCE_META[cadence].label}: ${source.title}`,
    objective: objectiveFor(source, cadence, context),
    priority: scoreToPriority(
      priorityScore(source, cadence, context, status, dueAt),
    ),
    ownerId: context.roleContext.userId,
    ownerRole: context.roleContext.role,
    division: itemDivision(source, context),
    materialDomain: source.materialDomain,
    workflowKey: `m41b:${itemDivision(source, context)}:${cadence}:${source.sourceType}:${source.id}`,
    dueAt,
    dependencyIds: predecessorIds(source, cadence, context.roleContext),
    sourceIds: Object.freeze([source.id]),
    recommendationId: null,
    status,
    humanApprovalRequired: true,
    approvalId: null,
    evidenceRequirements: evidenceRequirements(source),
    completionEvidenceIds: Object.freeze([]),
    closedAt: null,
    evidenceClass: "synthetic_demo",
  });
}

/** Converts a canonical governed source event into one owned cadence item. */
export function convertM41bSourceToWorkplanItem(
  sourceId: string,
  cadence: M41bCadence,
  roleContext: M41bRoleContext,
  options: Pick<M41bWorkplanBuildOptions, "requestedDivision" | "asOf"> = {},
): M41bWorkplanItem {
  const context = buildContext(roleContext, options);
  const source = m41bSourceById(sourceId);
  if (!sourceAuthorized(source, context))
    throw new Error(
      `M41B_SOURCE_ACCESS_DENIED:${roleContext.role}:${sourceId}`,
    );
  if (!source.cadences.includes(cadence))
    throw new Error(
      `M41B_SOURCE_CADENCE_NOT_AUTHORIZED:${sourceId}:${cadence}`,
    );
  return sourceToItem(source, cadence, context);
}

function recommendationCadence(
  sources: readonly M41bGovernedSource[],
): M41bCadence {
  const cadence = M41B_CADENCES.find((candidate) =>
    sources.some((source) => source.cadences.includes(candidate)),
  );
  if (!cadence) throw new Error("M41B_RECOMMENDATION_CADENCE_MISSING");
  return cadence;
}

function maximumSourcePriority(
  sources: readonly M41bGovernedSource[],
  cadence: M41bCadence,
  context: BuildContext,
  dueAt: string,
): M41bWorkplanItem["priority"] {
  return sources
    .map((source) =>
      scoreToPriority(
        priorityScore(source, cadence, context, "approved", dueAt),
      ),
    )
    .sort((left, right) => PRIORITY_RANK[right] - PRIORITY_RANK[left])[0];
}

/**
 * Converts only a human-approved (or human-modified) recommendation. Proposed,
 * rejected, unapproved, inaccessible, and domain-mismatched records fail closed.
 */
export function convertApprovedM41bRecommendationToWorkplanItem(
  recommendation: M41bRecommendation,
  roleContext: M41bRoleContext,
  options: Pick<M41bWorkplanBuildOptions, "requestedDivision" | "asOf"> & {
    cadence?: M41bCadence;
  } = {},
): M41bWorkplanItem {
  const context = buildContext(roleContext, options);
  if (recommendation.evidenceClass !== "synthetic_demo")
    throw new Error(`M41B_RECOMMENDATION_NON_SYNTHETIC:${recommendation.id}`);
  if (!recommendation.sourceIds.length)
    throw new Error(`M41B_RECOMMENDATION_SOURCE_REQUIRED:${recommendation.id}`);
  if (
    !(["approved", "modified"] as const).includes(
      recommendation.status as "approved" | "modified",
    )
  )
    throw new Error(`M41B_RECOMMENDATION_NOT_APPROVED:${recommendation.id}`);
  if (!recommendation.humanDecisionId)
    throw new Error(
      `M41B_RECOMMENDATION_HUMAN_DECISION_REQUIRED:${recommendation.id}`,
    );

  const sources = recommendation.sourceIds.map((sourceId) =>
    m41bSourceById(sourceId),
  );
  const inaccessible = sources.find(
    (source) => !sourceAuthorized(source, context),
  );
  if (inaccessible)
    throw new Error(
      `M41B_RECOMMENDATION_SOURCE_ACCESS_DENIED:${roleContext.role}:${inaccessible.id}`,
    );
  if (
    sources.some(
      (source) => source.materialDomain !== recommendation.materialDomain,
    )
  )
    throw new Error(`M41B_RECOMMENDATION_DOMAIN_MISMATCH:${recommendation.id}`);

  const cadence = options.cadence ?? recommendationCadence(sources);
  if (!sources.some((source) => source.cadences.includes(cadence)))
    throw new Error(
      `M41B_RECOMMENDATION_CADENCE_NOT_SUPPORTED:${recommendation.id}:${cadence}`,
    );
  const dueAt = endOfCadence(cadence, context.asOf);
  const division = itemDivision(sources[0], context);
  const naturalKey = `m41b:${roleContext.userId}:recommendation:${recommendation.id}`;
  return freezeItem({
    id:
      recommendation.downstreamTaskId ??
      `SYNTH-M41B-WP-REC-${stableToken(roleContext.userId)}-${stableToken(recommendation.id)}`,
    naturalKey,
    cadence,
    title: `Execute approved recommendation: ${recommendation.summary}`,
    objective: `Carry out the accountable-human disposition for ${recommendation.id} within ${roleContext.role}'s delegated authority; retain source, dependency, and completion evidence lineage.`,
    priority: maximumSourcePriority(sources, cadence, context, dueAt),
    ownerId: roleContext.userId,
    ownerRole: roleContext.role,
    division,
    materialDomain: recommendation.materialDomain,
    workflowKey: `m41b:${division}:${cadence}:approved-recommendation:${recommendation.id}`,
    dueAt,
    dependencyIds: unique(
      sources.map((source) => {
        const dependencyCadence = source.cadences.includes(cadence)
          ? cadence
          : source.cadences[0];
        return sourceItemId(roleContext, dependencyCadence, source.id);
      }),
    ),
    sourceIds: unique(recommendation.sourceIds),
    recommendationId: recommendation.id,
    status: "approved",
    humanApprovalRequired: true,
    approvalId: recommendation.humanDecisionId,
    evidenceRequirements: unique(
      sources.flatMap((source) => evidenceRequirements(source)),
    ),
    completionEvidenceIds: Object.freeze([]),
    closedAt: null,
    evidenceClass: "synthetic_demo",
  });
}

function assertItemState(item: M41bWorkplanItem): void {
  if (item.evidenceClass !== "synthetic_demo")
    throw new Error(`M41B_NON_SYNTHETIC_WORKPLAN_ITEM_DENIED:${item.id}`);
  if (!item.sourceIds.length)
    throw new Error(`M41B_WORKPLAN_SOURCE_REQUIRED:${item.id}`);
  if (!item.evidenceRequirements.length)
    throw new Error(`M41B_EVIDENCE_REQUIREMENTS_REQUIRED:${item.id}`);
  if (!item.humanApprovalRequired)
    throw new Error(`M41B_HUMAN_APPROVAL_GATE_REQUIRED:${item.id}`);
  canonicalIso(item.dueAt, "M41B_INVALID_DUE_AT");
  if (
    item.humanApprovalRequired &&
    ["approved", "in_progress", "evidence_pending", "completed"].includes(
      item.status,
    ) &&
    !item.approvalId
  )
    throw new Error(`M41B_MODEL_ONLY_APPROVAL_DENIED:${item.id}`);
  if (item.status === "completed") {
    if (!item.completionEvidenceIds.length)
      throw new Error(
        `M41B_SILENT_CLOSURE_DENIED:EVIDENCE_REQUIRED:${item.id}`,
      );
    if (!item.closedAt)
      throw new Error(
        `M41B_SILENT_CLOSURE_DENIED:CLOSED_AT_REQUIRED:${item.id}`,
      );
    canonicalIso(item.closedAt, "M41B_INVALID_CLOSED_AT");
  } else if (item.closedAt !== null) {
    throw new Error(
      `M41B_SILENT_CLOSURE_DENIED:NON_COMPLETED_CLOSED:${item.id}`,
    );
  }
}

function assertExistingItemAuthorized(
  item: M41bWorkplanItem,
  context: BuildContext,
): void {
  if (
    item.ownerId !== context.roleContext.userId ||
    item.ownerRole !== context.roleContext.role
  )
    throw new Error(`M41B_WORKPLAN_OWNER_MISMATCH:${item.id}`);
  if (context.requestedDivision && item.division !== context.requestedDivision)
    throw new Error(`M41B_WORKPLAN_DIVISION_MISMATCH:${item.id}`);
  assertM41bDivisionAccess(context.roleContext, item.division);
  const sources = item.sourceIds.map((sourceId) => {
    const source = m41bSourceById(sourceId);
    if (!sourceAuthorized(source, context))
      throw new Error(
        `M41B_EXISTING_ITEM_SOURCE_ACCESS_DENIED:${item.id}:${sourceId}`,
      );
    return source;
  });
  if (!sources.some((source) => source.cadences.includes(item.cadence)))
    throw new Error(
      `M41B_EXISTING_ITEM_CADENCE_INVALID:${item.id}:${item.cadence}`,
    );
  assertItemState(item);
}

function priorityForExisting(item: M41bWorkplanItem, context: BuildContext) {
  const priorities = item.sourceIds.map((sourceId) => {
    const source = m41bSourceById(sourceId);
    return scoreToPriority(
      priorityScore(source, item.cadence, context, item.status, item.dueAt),
    );
  });
  return priorities.sort(
    (left, right) => PRIORITY_RANK[right] - PRIORITY_RANK[left],
  )[0];
}

function mergeWorkflowState(
  generatedItems: readonly M41bWorkplanItem[],
  existingItems: readonly M41bWorkplanItem[],
  context: BuildContext,
): readonly M41bWorkplanItem[] {
  const naturalKeys = new Set<string>();
  const ids = new Set<string>();
  for (const item of existingItems) {
    assertExistingItemAuthorized(item, context);
    if (naturalKeys.has(item.naturalKey))
      throw new Error(`M41B_DUPLICATE_WORKPLAN_NATURAL_KEY:${item.naturalKey}`);
    if (ids.has(item.id))
      throw new Error(`M41B_DUPLICATE_WORKPLAN_ITEM_ID:${item.id}`);
    naturalKeys.add(item.naturalKey);
    ids.add(item.id);
  }
  const existingByKey = new Map(
    existingItems.map((item) => [item.naturalKey, item]),
  );
  const matched = new Set<string>();
  const merged = generatedItems.map((generated) => {
    const existing = existingByKey.get(generated.naturalKey);
    if (!existing) return generated;
    matched.add(existing.naturalKey);
    const item = freezeItem({
      ...generated,
      id: existing.id,
      dueAt: existing.dueAt,
      dependencyIds: unique(existing.dependencyIds),
      recommendationId: existing.recommendationId ?? generated.recommendationId,
      status: existing.status,
      approvalId: existing.approvalId,
      evidenceRequirements: unique([
        ...generated.evidenceRequirements,
        ...existing.evidenceRequirements,
      ]),
      completionEvidenceIds: unique(existing.completionEvidenceIds),
      closedAt: existing.closedAt,
      priority: priorityForExisting(existing, context),
    });
    assertItemState(item);
    return item;
  });
  for (const item of existingItems) {
    if (!matched.has(item.naturalKey))
      merged.push(
        freezeItem({ ...item, priority: priorityForExisting(item, context) }),
      );
  }
  return Object.freeze(merged);
}

function compareItems(left: M41bWorkplanItem, right: M41bWorkplanItem): number {
  return (
    PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority] ||
    left.dueAt.localeCompare(right.dueAt) ||
    left.naturalKey.localeCompare(right.naturalKey)
  );
}

function limitationsFor(
  sources: readonly M41bGovernedSource[],
  items: readonly M41bWorkplanItem[],
  context: M41bRoleContext,
): readonly string[] {
  const limitations = [
    "Synthetic evaluation only; production actions and external mutations are blocked.",
  ];
  if (!context.delegatedActions.includes("route_workflow"))
    limitations.push(
      "This role must use supervisor routing for actions outside delegated authority.",
    );
  for (const source of sources) {
    if (!items.some((item) => item.sourceIds.includes(source.id))) continue;
    if (source.state !== "current")
      limitations.push(
        `${source.id} remains ${source.state}; ${source.uncertainty ?? "no validated replacement source is available"}.`,
      );
    if (source.missingEvidence.length)
      limitations.push(
        `${source.id} missing evidence: ${source.missingEvidence.join("; ")}.`,
      );
  }
  return unique(limitations);
}

function buildCadenceBrief(
  cadence: M41bCadence,
  allItems: readonly M41bWorkplanItem[],
  sources: readonly M41bGovernedSource[],
  context: BuildContext,
): M41bCadenceBrief {
  const items = Object.freeze(
    allItems.filter((item) => item.cadence === cadence).sort(compareItems),
  );
  const sourceStates = Object.freeze([
    ...new Set(
      items.flatMap((item) =>
        item.sourceIds.map((sourceId) => m41bSourceById(sourceId).state),
      ),
    ),
  ]);
  return Object.freeze({
    cadence,
    title: `${CADENCE_META[cadence].label} ${TIER_FOCUS[context.roleContext.tier]} brief — ${context.roleContext.department}`,
    purpose: `${CADENCE_META[cadence].purpose} for ${context.roleContext.role} in ${context.requestedDivision ?? context.roleContext.division}.`,
    generatedAt: context.asOf,
    items,
    sourceStates,
    limitations: limitationsFor(sources, items, context.roleContext),
  });
}

/** Builds the single authoritative, permission-aware five-cadence workplan. */
export function buildM41bWorkplan(
  roleContext: M41bRoleContext,
  options: M41bWorkplanBuildOptions = {},
): M41bWorkplan {
  const context = buildContext(roleContext, options);
  const sources = M41B_SOURCE_REGISTER.filter((source) =>
    sourceAuthorized(source, context),
  );
  const sourceItems = sources.flatMap((source) =>
    source.cadences.map((cadence) => sourceToItem(source, cadence, context)),
  );
  const recommendationItems = (options.approvedRecommendations ?? []).map(
    (recommendation) =>
      convertApprovedM41bRecommendationToWorkplanItem(
        recommendation,
        roleContext,
        {
          requestedDivision: options.requestedDivision,
          asOf: context.asOf,
        },
      ),
  );
  const allItems = mergeWorkflowState(
    [...sourceItems, ...recommendationItems],
    options.existingItems ?? [],
    context,
  );
  const briefs = Object.freeze(
    Object.fromEntries(
      M41B_CADENCES.map((cadence) => [
        cadence,
        buildCadenceBrief(cadence, allItems, sources, context),
      ]),
    ) as unknown as Readonly<Record<M41bCadence, M41bCadenceBrief>>,
  );
  return Object.freeze({
    milestone: "M4.1B",
    environmentId: "AMOS-OPS-M4.1B-EVALUATION",
    environmentLabel: M41B_ENVIRONMENT_LABEL,
    generatedAt: context.asOf,
    roleContext: copyRoleContext(roleContext),
    briefs,
    productionActionsBlocked: true,
    evidenceClass: "synthetic_demo",
  });
}

/**
 * Applies an explicit governed status transition. Completion never supplies a
 * closure timestamp or evidence implicitly; both must arrive from the caller.
 */
export function transitionM41bWorkplanItem(
  item: M41bWorkplanItem,
  transition: M41bWorkplanTransition,
): M41bWorkplanItem {
  assertItemState(item);
  if (!ALLOWED_TRANSITIONS[item.status].includes(transition.status))
    throw new Error(
      `M41B_WORKPLAN_TRANSITION_DENIED:${item.id}:${item.status}:${transition.status}`,
    );
  const transitioned = freezeItem({
    ...item,
    status: transition.status,
    approvalId:
      transition.approvalId === undefined
        ? item.approvalId
        : transition.approvalId,
    dueAt:
      transition.dueAt === undefined
        ? item.dueAt
        : canonicalIso(transition.dueAt, "M41B_INVALID_DUE_AT"),
    dependencyIds:
      transition.dependencyIds === undefined
        ? item.dependencyIds
        : unique(transition.dependencyIds),
    completionEvidenceIds:
      transition.completionEvidenceIds === undefined
        ? item.completionEvidenceIds
        : unique(transition.completionEvidenceIds),
    closedAt:
      transition.closedAt === undefined ? item.closedAt : transition.closedAt,
  });
  assertItemState(transitioned);
  return transitioned;
}
