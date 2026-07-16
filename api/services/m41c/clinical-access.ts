import {
  M41C_EVALUATION_AS_OF,
  M41C_PROHIBITED_ACTIONS,
  type M41cAuditEvent,
  type M41cClinicalRoleContext,
  type M41cConsentState,
  type M41cProhibitedAction,
} from "@contracts/m41c/shared";
import { buildM41bRoleContext, canApproveM41b } from "@contracts/m41b";
import { ALL_ROLES, getPermissions, type UserRole } from "@/constants/roles";
import { createM41cAuditEvent } from "./pathway-orchestrator";

export const M41C_AUTHORIZED_ROLES = Object.freeze([...ALL_ROLES]);

export const M41C_CLINICAL_VIEW_ROLES = Object.freeze(
  ALL_ROLES.filter((role) => getPermissions(role).canViewClinical),
);

export const M41C_CLINICAL_EDIT_ROLES = Object.freeze(
  ALL_ROLES.filter((role) => getPermissions(role).canEditClinical),
);

export const M41C_CLINICAL_APPROVER_ROLES = Object.freeze(
  ALL_ROLES.filter((role) => canApproveM41b(role, "clinical")),
);

const PART2_DEMO_ROLES = new Set<UserRole>([
  "administrator",
  "bhc-director",
  "treatment-director",
  "clinical-director",
  "clinical-supervisor",
  "therapist",
  "nurse",
  "qmhp-cs",
  "case-manager",
]);

export type M41cClinicalAccessPurpose =
  | "direct_care"
  | "supervision"
  | "quality_review"
  | "care_coordination"
  | "clinical_governance"
  | "training_oversight";

export interface M41cClinicalAccessRequest {
  role: UserRole;
  actorId?: string;
  subjectId: string;
  purpose: M41cClinicalAccessPurpose;
  consentState?: M41cConsentState;
  part2: boolean;
  requestedFields: readonly string[];
  minimumNecessaryFields: readonly string[];
  occurredAt?: string;
}

export interface M41cClinicalAccessDecision {
  allowed: boolean;
  code:
    | "M41C_ACCESS_ALLOWED"
    | "M41C_REAL_ACTOR_DENIED"
    | "M41C_ROLE_ACCESS_DENIED"
    | "M41C_REAL_SUBJECT_DENIED"
    | "M41C_MINIMUM_NECESSARY_DENIED"
    | "M41C_CONSENT_DENIED"
    | "M41C_PART2_ACCESS_DENIED";
  reason: string;
  context: M41cClinicalRoleContext;
  permittedFields: readonly string[];
  suppressedFields: readonly string[];
  auditEvent: M41cAuditEvent;
}

const PURPOSE_FIELD_POLICY: Readonly<
  Record<M41cClinicalAccessPurpose, readonly string[]>
> = Object.freeze({
  direct_care: Object.freeze([
    "safety_status",
    "due_items",
    "missing_evidence",
    "pathway_status",
    "human_gate_status",
    "source_metadata",
    "continuum_status",
    "outcome_summary",
    "medication_safety_status",
  ]),
  supervision: Object.freeze([
    "safety_status",
    "due_items",
    "missing_evidence",
    "pathway_status",
    "human_gate_status",
    "source_metadata",
    "continuum_status",
    "outcome_summary",
    "medication_safety_status",
  ]),
  quality_review: Object.freeze([
    "safety_status",
    "missing_evidence",
    "pathway_status",
    "human_gate_status",
    "source_metadata",
    "continuum_status",
    "outcome_summary",
  ]),
  care_coordination: Object.freeze([
    "safety_status",
    "due_items",
    "missing_evidence",
    "pathway_status",
    "continuum_status",
  ]),
  clinical_governance: Object.freeze([
    "missing_evidence",
    "pathway_status",
    "human_gate_status",
    "source_metadata",
    "outcome_summary",
  ]),
  training_oversight: Object.freeze([
    "missing_evidence",
    "human_gate_status",
    "source_metadata",
  ]),
});

export function getM41cGovernedMinimumNecessaryFields(input: {
  role: UserRole;
  purpose: M41cClinicalAccessPurpose;
  part2: boolean;
}): readonly string[] {
  const fields = [...PURPOSE_FIELD_POLICY[input.purpose]];
  if (input.part2 && PART2_DEMO_ROLES.has(input.role))
    fields.push("part2_notes");
  return Object.freeze(fields);
}

function assertKnownRole(role: UserRole): void {
  if (!M41C_AUTHORIZED_ROLES.includes(role))
    throw new Error(`M41C_UNKNOWN_ROLE:${role}`);
}

function clinicalPermissions(role: UserRole): readonly string[] {
  const permissions = getPermissions(role);
  return Object.freeze([
    ...(permissions.canViewClinical ? ["clinical_read"] : []),
    ...(permissions.canEditClinical ? ["clinical_demo_workflow_submit"] : []),
    ...(permissions.canSupervise ? ["clinical_supervision"] : []),
    ...(canApproveM41b(role, "clinical") ? ["clinical_human_approval"] : []),
    ...(PART2_DEMO_ROLES.has(role) ? ["part2_demo_read"] : []),
  ]);
}

export function buildM41cClinicalRoleContext(
  role: UserRole,
  options: {
    actorId?: string;
    purpose?: M41cClinicalAccessPurpose;
    consentState?: M41cConsentState;
    qualificationIds?: readonly string[];
    certificationIds?: readonly string[];
  } = {},
): M41cClinicalRoleContext {
  assertKnownRole(role);
  const base = buildM41bRoleContext(
    role,
    options.actorId ?? `SYNTH-M41C-${role.toUpperCase().replace(/-/g, "_")}`,
  );
  return Object.freeze({
    ...base,
    clinicalPermissions: clinicalPermissions(role),
    qualificationIds: Object.freeze([...(options.qualificationIds ?? [])]),
    certificationIds: Object.freeze([...(options.certificationIds ?? [])]),
    minimumNecessaryPurpose: options.purpose ?? "direct_care",
    consentState: options.consentState ?? "active",
    part2AccessPermitted: PART2_DEMO_ROLES.has(role),
  });
}

function decision(
  input: M41cClinicalAccessRequest,
  context: M41cClinicalRoleContext,
  allowed: boolean,
  code: M41cClinicalAccessDecision["code"],
  reason: string,
  permittedFields: readonly string[],
): M41cClinicalAccessDecision {
  const permitted = new Set(permittedFields);
  const occurredAt = input.occurredAt ?? M41C_EVALUATION_AS_OF;
  const auditSubjectId = input.subjectId.startsWith("SYNTH-")
    ? input.subjectId
    : "SYNTH-REJECTED-SUBJECT-IDENTIFIER";
  const correlationId = `SYNTH-M41C-ACCESS-${auditSubjectId.replace(/[^A-Za-z0-9-]/g, "-")}`;
  const auditEvent = createM41cAuditEvent({
    eventType: "access_evaluated",
    actorId: context.userId,
    actorRole: input.role,
    entityType: "episode",
    entityId: auditSubjectId,
    correlationId,
    after: {
      allowed,
      code,
      purpose: input.purpose,
      requestedFields: [...input.requestedFields],
      permittedFields: [...permitted],
      suppressedFields: input.requestedFields.filter(
        (field) => !permitted.has(field),
      ),
      part2: input.part2,
    },
    rationale: reason,
    occurredAt,
  });
  return Object.freeze({
    allowed,
    code,
    reason,
    context,
    permittedFields: Object.freeze([...permitted]),
    suppressedFields: Object.freeze(
      input.requestedFields.filter((field) => !permitted.has(field)),
    ),
    auditEvent,
  });
}

export function evaluateM41cClinicalAccess(
  input: M41cClinicalAccessRequest,
): M41cClinicalAccessDecision {
  const syntheticActor =
    input.actorId === undefined || input.actorId.startsWith("SYNTH-");
  const context = buildM41cClinicalRoleContext(input.role, {
    actorId: syntheticActor ? input.actorId : undefined,
    purpose: input.purpose,
    consentState: input.consentState,
  });
  if (!syntheticActor)
    return decision(
      input,
      context,
      false,
      "M41C_REAL_ACTOR_DENIED",
      "Only synthetic actor identifiers are accepted in the prototype.",
      [],
    );
  if (!input.subjectId.startsWith("SYNTH-"))
    return decision(
      input,
      context,
      false,
      "M41C_REAL_SUBJECT_DENIED",
      "Only synthetic subject identifiers are accepted in the prototype.",
      [],
    );
  if (!getPermissions(input.role).canViewClinical)
    return decision(
      input,
      context,
      false,
      "M41C_ROLE_ACCESS_DENIED",
      "The role does not hold clinical-detail permission.",
      [],
    );
  const allowedFields = new Set(
    getM41cGovernedMinimumNecessaryFields({
      role: input.role,
      purpose: input.purpose,
      part2: input.part2,
    }),
  );
  if (input.requestedFields.some((field) => !allowedFields.has(field)))
    return decision(
      input,
      context,
      false,
      "M41C_MINIMUM_NECESSARY_DENIED",
      "The request exceeds the server-governed minimum-necessary field policy.",
      input.requestedFields.filter((field) => allowedFields.has(field)),
    );
  const consentState = input.consentState ?? "active";
  if (!["active", "not_required"].includes(consentState))
    return decision(
      input,
      context,
      false,
      "M41C_CONSENT_DENIED",
      `Consent state ${consentState} does not permit the requested demonstration access.`,
      [],
    );
  if (input.part2 && !context.part2AccessPermitted)
    return decision(
      input,
      context,
      false,
      "M41C_PART2_ACCESS_DENIED",
      "The role is not authorized for the synthetic Part 2 segment.",
      [],
    );
  return decision(
    input,
    context,
    true,
    "M41C_ACCESS_ALLOWED",
    "Role, purpose, consent, Part 2, and minimum-necessary controls passed.",
    input.requestedFields,
  );
}

export function assertM41cClinicalAccess(
  input: M41cClinicalAccessRequest,
): M41cClinicalRoleContext {
  const result = evaluateM41cClinicalAccess(input);
  if (!result.allowed) throw new Error(`${result.code}:${result.reason}`);
  return result.context;
}

export function assertM41cActionPermitted(
  action: string,
): asserts action is Exclude<string, M41cProhibitedAction> {
  if ((M41C_PROHIBITED_ACTIONS as readonly string[]).includes(action))
    throw new Error(`M41C_PROHIBITED_ACTION:${action}`);
}
