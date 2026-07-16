import { createHash } from "node:crypto";
import { getPermissions, type UserRole } from "@/constants/roles";
import { evaluateM41cClinicalAccess } from "../../m41c/clinical-access";
import {
  DX1_EVALUATED_AT,
  DX1_SCENARIO_ID,
  type Dx1AuditEvent,
} from "../contracts";
import { DX1_SYNTHETIC_PERSONAS } from "../fixtures";
import type {
  Dx1PilotAccessCode,
  Dx1PilotAccessDecision,
  Dx1PilotAccessRequest,
  Dx1PilotActor,
  Dx1SecurityAction,
  Dx1SecurityDomain,
} from "./types";

function immutable<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function stableId(prefix: string, ...parts: readonly string[]): string {
  return `${prefix}-${createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 20)
    .toUpperCase()}`;
}

function persona(actorId: string) {
  const match = DX1_SYNTHETIC_PERSONAS.find(
    (candidate) => candidate.actorId === actorId,
  );
  if (!match) throw new Error(`DX1_PERSONA_NOT_FOUND:${actorId}`);
  return match;
}

export const DX1_PILOT_ACTORS = Object.freeze({
  intake: immutable<Dx1PilotActor>({
    actorId: persona("SYNTH-DX1-ACTOR-INTAKE-001").actorId,
    role: "intake-coordinator",
    label: persona("SYNTH-DX1-ACTOR-INTAKE-001").displayLabel,
  }),
  clinician: immutable<Dx1PilotActor>({
    actorId: persona("SYNTH-DX1-ACTOR-CLINICAL-002").actorId,
    role: "therapist",
    label: persona("SYNTH-DX1-ACTOR-CLINICAL-002").displayLabel,
  }),
  qa: immutable<Dx1PilotActor>({
    actorId: persona("SYNTH-DX1-ACTOR-QA-003").actorId,
    role: "chart-auditor",
    label: persona("SYNTH-DX1-ACTOR-QA-003").displayLabel,
  }),
  revenue: immutable<Dx1PilotActor>({
    actorId: persona("SYNTH-DX1-ACTOR-REVENUE-004").actorId,
    role: "billing-specialist",
    label: persona("SYNTH-DX1-ACTOR-REVENUE-004").displayLabel,
  }),
  executive: immutable<Dx1PilotActor>({
    actorId: persona("SYNTH-DX1-ACTOR-EXEC-005").actorId,
    role: "managing-director",
    label: persona("SYNTH-DX1-ACTOR-EXEC-005").displayLabel,
  }),
  hr: immutable<Dx1PilotActor>({
    actorId: "SYNTH-DX1-ACTOR-HR-006",
    role: "hr-director",
    label: "Synthetic HR Director",
  }),
  compliance: immutable<Dx1PilotActor>({
    actorId: "SYNTH-DX1-ACTOR-COMPLIANCE-007",
    role: "hr-compliance-officer",
    label: "Synthetic Compliance Reviewer",
  }),
});

const DOMAIN_FIELDS: Readonly<Record<Dx1SecurityDomain, readonly string[]>> =
  Object.freeze({
    "phi-like-clinical": Object.freeze([
      "referral_status",
      "classification",
      "youth_reference",
      "requested_service",
      "eligibility_review_status",
      "evidence_gate_status",
      "escalation_state",
      "support_context",
      "authority_boundary",
      "human_gate_status",
      "service_event_status",
      "note_version",
      "provenance_ids",
    ]),
    hr: Object.freeze([
      "workforce_status",
      "credential_status",
      "training_status",
      "staffing_risk",
    ]),
    finance: Object.freeze([
      "authorization_status",
      "authorization_units",
      "billing_gate_status",
      "service_units",
      "projected_amount_cents",
      "lineage_ids",
    ]),
    executive: Object.freeze([
      "aggregate_operational_status",
      "aggregate_compliance_risk",
      "aggregate_revenue_status",
      "aggregate_workforce_status",
      "provenance_ids",
    ]),
    compliance: Object.freeze([
      "qa_status",
      "evidence_gate_status",
      "remediation_state",
      "escalation_state",
      "audit_event_ids",
      "risk_state",
    ]),
  });

type ActionPolicy = Readonly<Record<Dx1SecurityAction, readonly UserRole[]>>;

const DOMAIN_ROLE_POLICY: Readonly<Record<Dx1SecurityDomain, ActionPolicy>> =
  Object.freeze({
    "phi-like-clinical": Object.freeze({
      view: Object.freeze([
        "intake-coordinator",
        "therapist",
        "case-manager",
        "clinical-supervisor",
        "chart-auditor",
      ] as UserRole[]),
      record: Object.freeze([
        "intake-coordinator",
        "therapist",
        "case-manager",
      ] as UserRole[]),
      review: Object.freeze([
        "chart-auditor",
        "clinical-supervisor",
      ] as UserRole[]),
      approve: Object.freeze([
        "clinical-supervisor",
        "clinical-director",
      ] as UserRole[]),
      summarize: Object.freeze([] as UserRole[]),
    }),
    hr: Object.freeze({
      view: Object.freeze([
        "hr-director",
        "hr-compliance-officer",
        "training-coordinator",
      ] as UserRole[]),
      record: Object.freeze([
        "hr-director",
        "hr-compliance-officer",
        "training-coordinator",
      ] as UserRole[]),
      review: Object.freeze([
        "hr-director",
        "hr-compliance-officer",
      ] as UserRole[]),
      approve: Object.freeze(["hr-director"] as UserRole[]),
      summarize: Object.freeze(["managing-director"] as UserRole[]),
    }),
    finance: Object.freeze({
      view: Object.freeze([
        "billing-specialist",
        "revenue-cycle-manager",
      ] as UserRole[]),
      record: Object.freeze(["billing-specialist"] as UserRole[]),
      review: Object.freeze([
        "billing-specialist",
        "revenue-cycle-manager",
      ] as UserRole[]),
      approve: Object.freeze(["revenue-cycle-manager"] as UserRole[]),
      summarize: Object.freeze(["managing-director"] as UserRole[]),
    }),
    executive: Object.freeze({
      view: Object.freeze([
        "managing-director",
        "super-admin",
      ] as UserRole[]),
      record: Object.freeze([] as UserRole[]),
      review: Object.freeze(["managing-director"] as UserRole[]),
      approve: Object.freeze(["managing-director"] as UserRole[]),
      summarize: Object.freeze(["managing-director"] as UserRole[]),
    }),
    compliance: Object.freeze({
      view: Object.freeze([
        "chart-auditor",
        "hr-compliance-officer",
        "administrator",
      ] as UserRole[]),
      record: Object.freeze(["hr-compliance-officer"] as UserRole[]),
      review: Object.freeze([
        "chart-auditor",
        "hr-compliance-officer",
      ] as UserRole[]),
      approve: Object.freeze(["hr-compliance-officer"] as UserRole[]),
      summarize: Object.freeze(["managing-director"] as UserRole[]),
    }),
  });

function canonicalPermissionAllowed(
  role: UserRole,
  domain: Dx1SecurityDomain,
  action: Dx1SecurityAction,
): boolean {
  const permissions = getPermissions(role);
  const requiresEdit = ["record", "approve"].includes(action);
  if (domain === "phi-like-clinical")
    return requiresEdit
      ? permissions.canEditClinical
      : permissions.canViewClinical;
  if (domain === "hr")
    return requiresEdit ? permissions.canEditHR : permissions.canViewHR;
  if (domain === "finance")
    return requiresEdit ? permissions.canEditRevenue : permissions.canViewRevenue;
  if (domain === "executive") return permissions.canViewExecutive;
  return requiresEdit
    ? permissions.canEditCompliance
    : permissions.canViewCompliance;
}

function accessAudit(
  request: Dx1PilotAccessRequest,
  allowed: boolean,
  code: Dx1PilotAccessCode,
  reason: string,
): Dx1AuditEvent {
  return immutable({
    eventId: stableId(
      "SYNTH-DX1-ACCESS",
      request.stageId,
      request.actor.actorId,
      request.domain,
      request.action,
      code,
      request.requestId ?? "UNSCOPED-REQUEST",
    ),
    scenarioId: DX1_SCENARIO_ID,
    stageId: request.stageId,
    actorId: request.actor.actorId.startsWith("SYNTH-")
      ? request.actor.actorId
      : "SYNTH-DX1-REJECTED-ACTOR",
    actorRole: request.actor.role,
    action: `authorize:${request.domain}:${request.action}`,
    outcome: allowed ? "allowed" : "denied",
    reason,
    evidenceIds: Object.freeze([
      `DX1-08-${request.domain.toUpperCase().replace(/[^A-Z]+/g, "-")}`,
      code,
    ]),
    occurredAt: DX1_EVALUATED_AT,
    synthetic: true,
  });
}

function decision(
  request: Dx1PilotAccessRequest,
  allowed: boolean,
  code: Dx1PilotAccessCode,
  reason: string,
  permittedFields: readonly string[],
  canonicalClinicalDecisionCode: string | null = null,
): Dx1PilotAccessDecision {
  const permitted = new Set(permittedFields);
  return immutable({
    allowed,
    code,
    domain: request.domain,
    action: request.action,
    actorId: request.actor.actorId,
    actorRole: request.actor.role,
    permittedFields: Object.freeze([...permitted]),
    suppressedFields: Object.freeze(
      request.requestedFields.filter((field) => !permitted.has(field)),
    ),
    canonicalClinicalDecisionCode,
    reason,
    auditEvent: accessAudit(request, allowed, code, reason),
  });
}

export function evaluateDx1PilotAccess(
  request: Dx1PilotAccessRequest,
): Dx1PilotAccessDecision {
  if (request.scenarioId !== DX1_SCENARIO_ID)
    return decision(
      request,
      false,
      "DX1_SCENARIO_BOUNDARY_DENIED",
      "The request is not bound to the frozen DX.1 scenario.",
      [],
    );
  if (!request.actor.actorId.startsWith("SYNTH-"))
    return decision(
      request,
      false,
      "DX1_SYNTHETIC_ACTOR_REQUIRED",
      "Only fictional DX.1 actors are accepted.",
      [],
    );
  if (!request.recordId.startsWith("SYNTH-"))
    return decision(
      request,
      false,
      "DX1_SYNTHETIC_RECORD_REQUIRED",
      "Only fictional DX.1 records are accepted.",
      [],
    );
  if (
    request.domain === "phi-like-clinical" &&
    (!request.subjectId || !request.subjectId.startsWith("SYNTH-"))
  )
    return decision(
      request,
      false,
      "DX1_SYNTHETIC_SUBJECT_REQUIRED",
      "PHI-like access requires the frozen fictional subject identifier.",
      [],
    );
  if (
    !canonicalPermissionAllowed(
      request.actor.role,
      request.domain,
      request.action,
    )
  )
    return decision(
      request,
      false,
      "DX1_CANONICAL_PERMISSION_DENIED",
      "The canonical enterprise role does not hold the required domain permission.",
      [],
    );
  if (!DOMAIN_ROLE_POLICY[request.domain][request.action].includes(request.actor.role))
    return decision(
      request,
      false,
      "DX1_LEAST_PRIVILEGE_ROLE_DENIED",
      "DX.1 narrows the canonical role to the minimum pilot duty.",
      [],
    );

  const allowedFields = new Set(DOMAIN_FIELDS[request.domain]);
  const permittedFields = request.requestedFields.filter((field) =>
    allowedFields.has(field),
  );
  if (permittedFields.length !== request.requestedFields.length)
    return decision(
      request,
      false,
      "DX1_MINIMUM_NECESSARY_DENIED",
      "The request exceeds the frozen minimum-necessary field set.",
      permittedFields,
    );

  if (request.domain === "phi-like-clinical") {
    const purpose =
      request.actor.role === "intake-coordinator"
        ? "care_coordination"
        : request.actor.role === "chart-auditor"
          ? "quality_review"
          : request.actor.role === "clinical-supervisor"
            ? "supervision"
            : "direct_care";
    const clinicalFields =
      purpose === "care_coordination"
        ? ["safety_status", "pathway_status"]
        : ["safety_status", "pathway_status", "human_gate_status"];
    const clinical = evaluateM41cClinicalAccess({
      role: request.actor.role,
      actorId: request.actor.actorId,
      subjectId: request.subjectId!,
      purpose,
      consentState: "active",
      part2: false,
      requestedFields: clinicalFields,
      minimumNecessaryFields: clinicalFields,
      occurredAt: DX1_EVALUATED_AT,
    });
    if (!clinical.allowed)
      return decision(
        request,
        false,
        "DX1_CLINICAL_POLICY_DENIED",
        clinical.reason,
        [],
        clinical.code,
      );
    return decision(
      request,
      true,
      "DX1_ACCESS_ALLOWED",
      "Canonical clinical access and DX.1 minimum-necessary policy both allow the request.",
      permittedFields,
      clinical.code,
    );
  }

  return decision(
    request,
    true,
    "DX1_ACCESS_ALLOWED",
    "Canonical enterprise permission and DX.1 least-privilege policy both allow the request.",
    permittedFields,
  );
}

export function dx1AllowedFieldsForDomain(
  domain: Dx1SecurityDomain,
): readonly string[] {
  return DOMAIN_FIELDS[domain];
}
