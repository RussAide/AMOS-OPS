import type { DivisionId } from "../../../../src/constants/organization";
import {
  ALL_ROLES,
  ROLE_DEFINITIONS,
  type UserRole,
} from "../../../../src/constants/roles";
import { ROLE_TIER_BY_ROLE } from "../../../../src/constants/access-control";
import {
  M51B_APPROVED_TENANT_BOUNDARY,
  M51B_EVALUATION_STARTED_AT,
} from "../../../../contracts/m51b/shared";
import type {
  M51BTeamsDestination,
  M51BTeamsEventCandidate,
  M51BTeamsIdentity,
} from "../../../../contracts/m51b/teams";
import { buildM51AActorContext } from "../../m51a/role-context";
import { deepFreeze } from "./support";

export const M51B_TEAMS_DESTINATION_IDS = deepFreeze({
  enterpriseLeadership: "SYNTH-M51B-DEST-ENTERPRISE-LEADERSHIP",
  bhcCareCoordination: "SYNTH-M51B-DEST-BHC-CARE-COORDINATION",
  groOperations: "SYNTH-M51B-DEST-GRO-OPERATIONS",
  enterpriseCompliance: "SYNTH-M51B-DEST-ENTERPRISE-COMPLIANCE",
  workforceLearning: "SYNTH-M51B-DEST-WORKFORCE-LEARNING",
} as const);

function definitionFor(role: UserRole) {
  const definition = ROLE_DEFINITIONS.find((candidate) => candidate.id === role);
  if (!definition) throw new Error("M51B_TEAMS_ROLE_DEFINITION_NOT_FOUND");
  return definition;
}

export function m51bTeamsActorId(role: UserRole): string {
  return `SYNTH-M51A-ACTOR-${role.toUpperCase()}`;
}

export function m51bTeamsUserId(role: UserRole): string {
  return `SYNTH-M365-USER-${role.toUpperCase()}`;
}

export function createSyntheticM51BTeamsIdentity(
  role: UserRole,
  overrides: Partial<M51BTeamsIdentity> = {},
): M51BTeamsIdentity {
  const definition = definitionFor(role);
  return deepFreeze({
    actorId: m51bTeamsActorId(role),
    teamsUserId: m51bTeamsUserId(role),
    role,
    tier: ROLE_TIER_BY_ROLE[role],
    divisionId: definition.division,
    tenantId: M51B_APPROVED_TENANT_BOUNDARY,
    identityKind: "member",
    status: "active",
    displayLabel: definition.label,
    synthetic: true,
    ...overrides,
  });
}

export function createSyntheticM51BTeamsIdentities(): readonly M51BTeamsIdentity[] {
  return deepFreeze(
    ALL_ROLES.map((role) => createSyntheticM51BTeamsIdentity(role)),
  );
}

function roleIds(predicate: (role: UserRole) => boolean): readonly string[] {
  return deepFreeze(
    ALL_ROLES.filter(predicate).map((role) => m51bTeamsUserId(role)),
  );
}

const T1_T2_ROLES = deepFreeze(
  ALL_ROLES.filter((role) =>
    ["T1", "T2"].includes(ROLE_TIER_BY_ROLE[role]),
  ),
);
const T1_T2_T3_ROLES = deepFreeze(
  ALL_ROLES.filter((role) => ROLE_TIER_BY_ROLE[role] !== "T4"),
);
const BHC_ROLES = deepFreeze(
  ALL_ROLES.filter((role) => definitionFor(role).division === "bhc"),
);
const GRO_ROLES = deepFreeze(
  ALL_ROLES.filter((role) => definitionFor(role).division === "gro"),
);
const COMPLIANCE_ROLES = deepFreeze(
  ALL_ROLES.filter((role) =>
    [
      "super-admin",
      "managing-director",
      "administrator",
      "hr-director",
      "hr-compliance-officer",
      "training-coordinator",
      "facilities-manager",
      "gro-administrator",
      "program-director",
      "bhc-director",
      "treatment-director",
      "clinical-director",
      "chart-auditor",
    ].includes(role),
  ),
);

const ALL_DIVISIONS = deepFreeze<DivisionId[]>(["gro", "bhc", "eo", "gad"]);

function destination(
  input: Omit<
    M51BTeamsDestination,
    | "tenantId"
    | "active"
    | "mentionPolicy"
    | "notificationSensitivity"
    | "physicalUrlExposed"
    | "synthetic"
  >,
): M51BTeamsDestination {
  return deepFreeze({
    ...input,
    tenantId: M51B_APPROVED_TENANT_BOUNDARY,
    active: true,
    mentionPolicy: "explicit_intended_recipients_only",
    notificationSensitivity: "internal",
    physicalUrlExposed: false,
    synthetic: true,
  });
}

export function createSyntheticM51BTeamsDestinations(): readonly M51BTeamsDestination[] {
  return deepFreeze([
    destination({
      destinationId: M51B_TEAMS_DESTINATION_IDS.enterpriseLeadership,
      logicalName: "Enterprise Leadership Decisions",
      teamId: "SYNTH-M365-TEAM-ENTERPRISE-LEADERSHIP",
      channelId: "SYNTH-M365-CHANNEL-DECISIONS",
      allowedEventTypes: [
        "workplan_assignment_approved",
        "compliance_action_approved",
        "executive_decision_approved",
      ],
      allowedDivisions: ALL_DIVISIONS,
      allowedSenderRoles: T1_T2_ROLES,
      allowedRecipientRoles: T1_T2_ROLES,
      memberTeamsUserIds: roleIds((role) => T1_T2_ROLES.includes(role)),
    }),
    destination({
      destinationId: M51B_TEAMS_DESTINATION_IDS.bhcCareCoordination,
      logicalName: "BHC Care Coordination",
      teamId: "SYNTH-M365-TEAM-BHC",
      channelId: "SYNTH-M365-CHANNEL-CARE-COORDINATION",
      allowedEventTypes: [
        "workplan_assignment_approved",
        "compliance_action_approved",
        "clinical_review_approved",
      ],
      allowedDivisions: ["bhc"],
      allowedSenderRoles: T1_T2_ROLES,
      allowedRecipientRoles: BHC_ROLES,
      memberTeamsUserIds: roleIds(
        (role) => BHC_ROLES.includes(role) || ROLE_TIER_BY_ROLE[role] === "T1",
      ),
    }),
    destination({
      destinationId: M51B_TEAMS_DESTINATION_IDS.groOperations,
      logicalName: "GRO Operations",
      teamId: "SYNTH-M365-TEAM-GRO",
      channelId: "SYNTH-M365-CHANNEL-OPERATIONS",
      allowedEventTypes: [
        "workplan_assignment_approved",
        "compliance_action_approved",
        "incident_followup_approved",
      ],
      allowedDivisions: ["gro"],
      allowedSenderRoles: T1_T2_ROLES,
      allowedRecipientRoles: GRO_ROLES,
      memberTeamsUserIds: roleIds(
        (role) => GRO_ROLES.includes(role) || ROLE_TIER_BY_ROLE[role] === "T1",
      ),
    }),
    destination({
      destinationId: M51B_TEAMS_DESTINATION_IDS.enterpriseCompliance,
      logicalName: "Enterprise Compliance Actions",
      teamId: "SYNTH-M365-TEAM-ENTERPRISE-COMPLIANCE",
      channelId: "SYNTH-M365-CHANNEL-ACTIONS",
      allowedEventTypes: [
        "workplan_assignment_approved",
        "compliance_action_approved",
        "incident_followup_approved",
        "training_due_approved",
      ],
      allowedDivisions: ALL_DIVISIONS,
      allowedSenderRoles: T1_T2_T3_ROLES,
      allowedRecipientRoles: COMPLIANCE_ROLES,
      memberTeamsUserIds: roleIds((role) => COMPLIANCE_ROLES.includes(role)),
    }),
    destination({
      destinationId: M51B_TEAMS_DESTINATION_IDS.workforceLearning,
      logicalName: "Workforce Learning",
      teamId: "SYNTH-M365-TEAM-WORKFORCE",
      channelId: "SYNTH-M365-CHANNEL-LEARNING",
      allowedEventTypes: [
        "workplan_assignment_approved",
        "training_due_approved",
      ],
      allowedDivisions: ALL_DIVISIONS,
      allowedSenderRoles: T1_T2_T3_ROLES,
      allowedRecipientRoles: ALL_ROLES,
      memberTeamsUserIds: roleIds(() => true),
    }),
  ]);
}

export function createSyntheticM51BTeamsEvent(
  overrides: Partial<M51BTeamsEventCandidate> = {},
): M51BTeamsEventCandidate {
  return deepFreeze({
    eventId: "SYNTH-M51B-TEAMS-EVENT-001",
    eventType: "executive_decision_approved",
    approvalStatus: "approved",
    approvedByActorId: m51bTeamsActorId("super-admin"),
    occurredAt: M51B_EVALUATION_STARTED_AT,
    approvedAt: "2026-07-15T12:00:02.000Z",
    approvalExpiresAt: "2026-07-15T13:00:02.000Z",
    sourceSystem: "amos-ops",
    sourceReference: "SYNTH-M51B-WORK-ITEM-001",
    sourceSensitivity: "internal",
    consentStatus: "not_applicable",
    divisionId: "eo",
    ownerRole: "managing-director",
    destinationId: M51B_TEAMS_DESTINATION_IDS.enterpriseLeadership,
    intendedRecipientActorIds: [m51bTeamsActorId("managing-director")],
    acknowledgementRequired: true,
    priority: "important",
    dueAt: "2026-07-16T17:00:00.000Z",
    synthetic: true,
    ...overrides,
  });
}

export function createSyntheticM51BTeamsActor(role: UserRole) {
  return buildM51AActorContext(role);
}

