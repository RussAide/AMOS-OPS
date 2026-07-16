import type { UserRole } from "@/constants/roles";
import {
  M41C_EVALUATION_AS_OF,
  M41C_EVIDENCE_CLASS,
} from "@contracts/m41c/shared";
import type {
  M41cCompetencyAttestation,
  M41cCompetencyGateResult,
  M41cCompetencyRegistry,
} from "@contracts/m41c/governance";
import { m41cDeterministicId } from "./clinical-governance";

const NON_HUMAN_ACTOR_PATTERN =
  /^(?:ai|amos|assistant|model|system)(?:$|[-_:])/i;

function assertIsoTime(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

export function createSyntheticM41cCompetencyRegistry(): M41cCompetencyRegistry {
  return Object.freeze({
    registryId: "SYNTH-M41C-COMPETENCY-REGISTRY",
    asOf: M41C_EVALUATION_AS_OF,
    requirements: Object.freeze([
      Object.freeze({
        requirementId: "M41C-COMP-GOVERNANCE-APPROVER",
        title: "Synthetic clinical governance approval competency",
        scope: "governance_approval" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "bhc-director",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze([]),
        instrumentProfileIds: Object.freeze([]),
        requiresExternalCertification: false,
        certificationType: null,
        supervisedUseRequired: false,
        renewalDays: 365,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-CONTROLLING-DOCTRINE"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        requirementId: "M41C-COMP-SYNTHETIC-INSTRUMENT-USER",
        title: "Synthetic instrument administration and documentation",
        scope: "supervised_demo_use" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "clinical-supervisor",
          "qmhp-cs",
          "therapist",
          "case-manager",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze(["SYNTH-M41C-PATHWAY-STANDIN"]),
        instrumentProfileIds: Object.freeze(["SYNTH-M41C-INSTRUMENT-STANDIN"]),
        requiresExternalCertification: false,
        certificationType: null,
        supervisedUseRequired: true,
        renewalDays: 180,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        requirementId: "M41C-COMP-PATHWAY",
        title: "Governed synthetic youth pathway use and documentation",
        scope: "pathway_guidance" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "clinical-supervisor",
          "treatment-director",
          "therapist",
          "qmhp-cs",
          "case-manager",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze([
          "M41C-PATHWAY-DEPRESSION",
          "M41C-PATHWAY-ANXIETY",
          "M41C-PATHWAY-TRAUMA",
          "M41C-PATHWAY-SUBSTANCE-USE",
          "M41C-PATHWAY-DISRUPTIVE-BEHAVIOR",
          "M41C-PATHWAY-CROSS-CUTTING",
          "M41C-PATHWAY-TRR-DEMO",
          "M41C-PATHWAY-SUICIDE-CRISIS-DEMO",
          "M41C-PATHWAY-MEDICATION-PHYSICAL-HEALTH-DEMO",
        ]),
        instrumentProfileIds: Object.freeze(["SYNTH-M41C-INSTRUMENT-STANDIN"]),
        requiresExternalCertification: false,
        certificationType: null,
        supervisedUseRequired: true,
        renewalDays: 180,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-CONTROLLING-DOCTRINE"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        requirementId: "M41C-COMP-CLINICAL-GUIDANCE-REVIEWER",
        title: "Ask AMOS clinical guidance and routing review",
        scope: "pathway_guidance" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "bhc-director",
          "clinical-supervisor",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze(["SYNTH-M41C-GOVERNED-GUIDANCE-PATHWAY"]),
        instrumentProfileIds: Object.freeze([]),
        requiresExternalCertification: false,
        certificationType: null,
        supervisedUseRequired: true,
        renewalDays: 180,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-CONTROLLING-DOCTRINE"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        requirementId: "M41C-COMP-YOUTH-SUICIDE-SAFETY",
        title: "Youth suicide and crisis escalation responsibility",
        scope: "safety_escalation" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "clinical-supervisor",
          "treatment-director",
          "therapist",
          "qmhp-cs",
          "crisis-intervention-specialist",
          "nurse",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze(["M41C-PATHWAY-SUICIDE-CRISIS-DEMO"]),
        instrumentProfileIds: Object.freeze([]),
        requiresExternalCertification: false,
        certificationType: null,
        supervisedUseRequired: true,
        renewalDays: 180,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-NIMH-ASQ-TOOLKIT"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        requirementId: "M41C-COMP-MEDICATION-AND-PHYSICAL-HEALTH-SAFETY",
        title: "Medication and physical-health safety workflow boundaries",
        scope: "safety_escalation" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "clinical-supervisor",
          "treatment-director",
          "nurse",
          "medication-aide",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze([
          "M41C-PATHWAY-MEDICATION-PHYSICAL-HEALTH-DEMO",
        ]),
        instrumentProfileIds: Object.freeze([]),
        requiresExternalCertification: false,
        certificationType: null,
        supervisedUseRequired: true,
        renewalDays: 180,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-CONTROLLING-DOCTRINE"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        requirementId: "M41C-COMP-TRR-REVIEW",
        title: "Synthetic TRR package review boundary",
        scope: "pathway_guidance" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "clinical-supervisor",
          "treatment-director",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze(["M41C-PATHWAY-TRR-DEMO"]),
        instrumentProfileIds: Object.freeze(["M41C-INSTRUMENT-TRR-CANS"]),
        requiresExternalCertification: false,
        certificationType: null,
        supervisedUseRequired: true,
        renewalDays: 180,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-TRR-CANS-METADATA"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        requirementId: "M41C-COMP-LOC-HUMAN-REVIEW",
        title: "Nonbinding level-of-care human review boundary",
        scope: "pathway_guidance" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "clinical-supervisor",
          "treatment-director",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze(["M41C-PATHWAY-TRR-DEMO"]),
        instrumentProfileIds: Object.freeze(["M41C-INSTRUMENT-TRR-CANS"]),
        requiresExternalCertification: false,
        certificationType: null,
        supervisedUseRequired: true,
        renewalDays: 180,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-TRR-CANS-METADATA"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        requirementId: "M41C-COMP-CMBHS-RECONCILIATION",
        title: "CMBHS read-and-reconcile simulation competency",
        scope: "documentation" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "clinical-supervisor",
          "chart-auditor",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze([]),
        instrumentProfileIds: Object.freeze([]),
        requiresExternalCertification: false,
        certificationType: null,
        supervisedUseRequired: true,
        renewalDays: 180,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-HHSC-CMBHS"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        requirementId: "M41C-COMP-CLINICAL-FABRIC-MONITORING",
        title: "Clinical fabric monitoring and escalation competency",
        scope: "documentation" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "clinical-supervisor",
          "chart-auditor",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze([]),
        instrumentProfileIds: Object.freeze([]),
        requiresExternalCertification: false,
        certificationType: null,
        supervisedUseRequired: true,
        renewalDays: 180,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-CONTROLLING-DOCTRINE"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        requirementId: "M41C-COMP-CONTINUUM-TRANSITION",
        title: "Youth continuum transition and aftercare accountability",
        scope: "documentation" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "clinical-supervisor",
          "treatment-director",
          "program-director",
          "case-manager",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze([]),
        instrumentProfileIds: Object.freeze([]),
        requiresExternalCertification: false,
        certificationType: null,
        supervisedUseRequired: true,
        renewalDays: 180,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-CONTROLLING-DOCTRINE"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        requirementId: "M41C-COMP-TRR-CANS-CERTIFICATION",
        title: "TRR CANS certification evidence",
        scope: "instrument_administration" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "clinical-supervisor",
          "qmhp-cs",
          "case-manager",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze(["M41C-PATHWAY-TRR"]),
        instrumentProfileIds: Object.freeze(["M41C-INSTRUMENT-TRR-CANS"]),
        requiresExternalCertification: true,
        certificationType: "TRR_CANS_CURRENT",
        supervisedUseRequired: false,
        renewalDays: 365,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-TRR-CANS-METADATA"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        requirementId: "M41C-COMP-DFPS-CANS-3-CERTIFICATION",
        title: "DFPS CANS 3.0 qualification and certification evidence",
        scope: "instrument_administration" as const,
        permittedRoles: Object.freeze([
          "clinical-director",
          "clinical-supervisor",
          "qmhp-cs",
          "case-manager",
        ] satisfies UserRole[]),
        pathwayIds: Object.freeze(["M41C-PATHWAY-DFPS-CANS-3"]),
        instrumentProfileIds: Object.freeze(["M41C-INSTRUMENT-DFPS-CANS-3"]),
        requiresExternalCertification: true,
        certificationType: "DFPS_CANS_3_CURRENT",
        supervisedUseRequired: false,
        renewalDays: 365,
        ownerRole: "clinical-director" as const,
        sourceIds: Object.freeze(["M41C-SRC-DFPS-CANS-3-METADATA"]),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
    ]),
    attestations: Object.freeze([
      Object.freeze({
        attestationId: "SYNTH-M41C-ATTEST-CLINICAL-DIRECTOR-GOV",
        requirementId: "M41C-COMP-GOVERNANCE-APPROVER",
        staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        staffRole: "clinical-director" as const,
        completedAt: "2026-11-01T08:00:00.000Z",
        expiresAt: "2027-11-01T08:00:00.000Z",
        evidenceIds: Object.freeze(["SYNTH-M41C-EVIDENCE-GOV-COMP-001"]),
        externalCertificationId: null,
        supervisedBy: null,
        attestedBy: "SYNTH-HUMAN-TRAINING-COORDINATOR",
        attestedByRole: "training-coordinator" as const,
        attestedAt: "2026-11-01T08:05:00.000Z",
        revokedAt: null,
        synthetic: true as const,
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        attestationId: "SYNTH-M41C-ATTEST-BHC-DIRECTOR-GOV",
        requirementId: "M41C-COMP-GOVERNANCE-APPROVER",
        staffId: "SYNTH-HUMAN-BHC-DIRECTOR",
        staffRole: "bhc-director" as const,
        completedAt: "2026-11-01T08:00:00.000Z",
        expiresAt: "2027-11-01T08:00:00.000Z",
        evidenceIds: Object.freeze(["SYNTH-M41C-EVIDENCE-GOV-COMP-002"]),
        externalCertificationId: null,
        supervisedBy: null,
        attestedBy: "SYNTH-HUMAN-TRAINING-COORDINATOR",
        attestedByRole: "training-coordinator" as const,
        attestedAt: "2026-11-01T08:05:00.000Z",
        revokedAt: null,
        synthetic: true as const,
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        attestationId: "SYNTH-M41C-ATTEST-CLINICAL-DIRECTOR-DEMO",
        requirementId: "M41C-COMP-SYNTHETIC-INSTRUMENT-USER",
        staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        staffRole: "clinical-director" as const,
        completedAt: "2026-11-01T09:00:00.000Z",
        expiresAt: "2027-05-01T09:00:00.000Z",
        evidenceIds: Object.freeze(["SYNTH-M41C-EVIDENCE-DEMO-COMP-001"]),
        externalCertificationId: null,
        supervisedBy: "SYNTH-HUMAN-CLINICAL-SUPERVISOR",
        attestedBy: "SYNTH-HUMAN-TRAINING-COORDINATOR",
        attestedByRole: "training-coordinator" as const,
        attestedAt: "2026-11-01T09:05:00.000Z",
        revokedAt: null,
        synthetic: true as const,
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      ...[
        "M41C-COMP-PATHWAY",
        "M41C-COMP-CLINICAL-GUIDANCE-REVIEWER",
        "M41C-COMP-YOUTH-SUICIDE-SAFETY",
        "M41C-COMP-MEDICATION-AND-PHYSICAL-HEALTH-SAFETY",
        "M41C-COMP-TRR-REVIEW",
        "M41C-COMP-LOC-HUMAN-REVIEW",
        "M41C-COMP-CMBHS-RECONCILIATION",
        "M41C-COMP-CLINICAL-FABRIC-MONITORING",
        "M41C-COMP-CONTINUUM-TRANSITION",
      ].map((requirementId, index) =>
        Object.freeze({
          attestationId: `SYNTH-M41C-ATTEST-CLINICAL-DIRECTOR-PATHWAY-${String(index + 1).padStart(2, "0")}`,
          requirementId,
          staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
          staffRole: "clinical-director" as const,
          completedAt: "2026-11-01T10:00:00.000Z",
          expiresAt: "2027-05-01T10:00:00.000Z",
          evidenceIds: Object.freeze([
            `SYNTH-M41C-EVIDENCE-PATHWAY-COMP-${String(index + 1).padStart(2, "0")}`,
          ]),
          externalCertificationId: null,
          supervisedBy: "SYNTH-HUMAN-CLINICAL-SUPERVISOR",
          attestedBy: "SYNTH-HUMAN-TRAINING-COORDINATOR",
          attestedByRole: "training-coordinator" as const,
          attestedAt: "2026-11-01T10:05:00.000Z",
          revokedAt: null,
          synthetic: true as const,
          evidenceClass: M41C_EVIDENCE_CLASS,
        }),
      ),
    ]),
    productionCredentialingAvailable: false,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

export interface RecordM41cCompetencyAttestationInput {
  requirementId: string;
  staffId: string;
  staffRole: UserRole;
  completedAt: string;
  expiresAt: string;
  evidenceIds: readonly string[];
  externalCertificationId?: string | null;
  supervisedBy?: string | null;
  attestedBy: string;
  attestedByRole: UserRole;
  attestedAt: string;
}

export function recordM41cCompetencyAttestation(
  registry: M41cCompetencyRegistry,
  input: RecordM41cCompetencyAttestationInput,
): M41cCompetencyRegistry {
  const requirement = registry.requirements.find(
    (candidate) => candidate.requirementId === input.requirementId,
  );
  if (!requirement) throw new Error("M41C_COMPETENCY_REQUIREMENT_NOT_FOUND");
  if (!requirement.permittedRoles.includes(input.staffRole))
    throw new Error("M41C_COMPETENCY_ROLE_NOT_PERMITTED");
  if (!input.staffId.startsWith("SYNTH-"))
    throw new Error("M41C_COMPETENCY_SYNTHETIC_STAFF_REQUIRED");
  if (
    !input.attestedBy.trim() ||
    !input.attestedBy.startsWith("SYNTH-HUMAN-") ||
    NON_HUMAN_ACTOR_PATTERN.test(input.attestedBy.trim())
  ) {
    throw new Error("M41C_MODEL_ONLY_COMPETENCY_ATTESTATION_DENIED");
  }
  if (input.attestedByRole !== "training-coordinator")
    throw new Error("M41C_TRAINING_COORDINATOR_ATTESTATION_REQUIRED");
  assertIsoTime(input.completedAt, "M41C_COMPETENCY_COMPLETION_TIME_INVALID");
  assertIsoTime(input.expiresAt, "M41C_COMPETENCY_EXPIRATION_TIME_INVALID");
  assertIsoTime(input.attestedAt, "M41C_COMPETENCY_ATTESTATION_TIME_INVALID");
  if (Date.parse(input.expiresAt) <= Date.parse(input.completedAt))
    throw new Error("M41C_COMPETENCY_EXPIRATION_INVALID");
  if (input.evidenceIds.length === 0)
    throw new Error("M41C_COMPETENCY_EVIDENCE_REQUIRED");
  if (input.evidenceIds.some((id) => !id.startsWith("SYNTH-")))
    throw new Error("M41C_COMPETENCY_SYNTHETIC_EVIDENCE_REQUIRED");
  if (
    requirement.requiresExternalCertification &&
    !input.externalCertificationId?.trim()
  ) {
    throw new Error("M41C_EXTERNAL_CERTIFICATION_EVIDENCE_REQUIRED");
  }
  if (requirement.supervisedUseRequired && !input.supervisedBy?.trim())
    throw new Error("M41C_SUPERVISED_USE_EVIDENCE_REQUIRED");
  if (input.supervisedBy && !input.supervisedBy.startsWith("SYNTH-HUMAN-"))
    throw new Error("M41C_COMPETENCY_SYNTHETIC_SUPERVISOR_REQUIRED");
  if (
    input.externalCertificationId &&
    !input.externalCertificationId.startsWith("SYNTH-")
  ) {
    throw new Error("M41C_COMPETENCY_SYNTHETIC_CERTIFICATION_REQUIRED");
  }

  const attestation: M41cCompetencyAttestation = Object.freeze({
    attestationId: m41cDeterministicId(
      "M41C-ATTESTATION",
      input.requirementId,
      input.staffId,
      input.completedAt,
    ),
    ...input,
    externalCertificationId: input.externalCertificationId ?? null,
    supervisedBy: input.supervisedBy ?? null,
    evidenceIds: Object.freeze([...new Set(input.evidenceIds)]),
    revokedAt: null,
    synthetic: true,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
  return Object.freeze({
    ...registry,
    attestations: Object.freeze([...registry.attestations, attestation]),
  });
}

export interface EvaluateM41cCompetencyGateInput {
  staffId: string;
  staffRole: UserRole;
  requirementIds: readonly string[];
  evaluatedAt?: string;
}

export function evaluateM41cCompetencyGate(
  registry: M41cCompetencyRegistry,
  input: EvaluateM41cCompetencyGateInput,
): M41cCompetencyGateResult {
  if (!input.staffId.startsWith("SYNTH-HUMAN-"))
    throw new Error("M41C_COMPETENCY_SYNTHETIC_STAFF_REQUIRED");
  const evaluatedAt = input.evaluatedAt ?? registry.asOf;
  assertIsoTime(evaluatedAt, "M41C_COMPETENCY_EVALUATION_TIME_INVALID");
  const requirementIds = Object.freeze(
    [...new Set(input.requirementIds)].sort(),
  );
  const satisfied: string[] = [];
  const missing: string[] = [];
  const expired: string[] = [];
  const roleMismatch: string[] = [];

  for (const requirementId of requirementIds) {
    const requirement = registry.requirements.find(
      (candidate) => candidate.requirementId === requirementId,
    );
    if (!requirement) {
      missing.push(requirementId);
      continue;
    }
    if (!requirement.permittedRoles.includes(input.staffRole)) {
      roleMismatch.push(requirementId);
      continue;
    }
    const attestations = registry.attestations.filter(
      (candidate) =>
        candidate.requirementId === requirementId &&
        candidate.staffId === input.staffId &&
        candidate.staffRole === input.staffRole &&
        candidate.revokedAt === null,
    );
    const current = attestations.find(
      (candidate) =>
        Date.parse(candidate.completedAt) <= Date.parse(evaluatedAt) &&
        Date.parse(candidate.expiresAt) > Date.parse(evaluatedAt) &&
        (!requirement.requiresExternalCertification ||
          Boolean(candidate.externalCertificationId)) &&
        (!requirement.supervisedUseRequired || Boolean(candidate.supervisedBy)),
    );
    if (current) {
      satisfied.push(requirementId);
    } else if (
      attestations.some(
        (candidate) =>
          Date.parse(candidate.expiresAt) <= Date.parse(evaluatedAt),
      )
    ) {
      expired.push(requirementId);
    } else {
      missing.push(requirementId);
    }
  }

  return Object.freeze({
    gateId: m41cDeterministicId(
      "M41C-COMP-GATE",
      input.staffId,
      input.staffRole,
      requirementIds.join(","),
      evaluatedAt,
    ),
    staffId: input.staffId,
    staffRole: input.staffRole,
    requirementIds,
    satisfiedRequirementIds: Object.freeze(satisfied),
    missingRequirementIds: Object.freeze(missing),
    expiredRequirementIds: Object.freeze(expired),
    roleMismatchRequirementIds: Object.freeze(roleMismatch),
    passedForSyntheticDemo:
      requirementIds.length > 0 &&
      satisfied.length === requirementIds.length &&
      missing.length === 0 &&
      expired.length === 0 &&
      roleMismatch.length === 0,
    productionUseAuthorized: false,
    evaluatedAt,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

export function assertM41cCompetencyGatePassed(
  gate: M41cCompetencyGateResult,
): void {
  if (!gate.passedForSyntheticDemo)
    throw new Error("M41C_COMPETENCY_GATE_NOT_SATISFIED");
  if (gate.productionUseAuthorized !== false)
    throw new Error("M41C_PRODUCTION_CREDENTIAL_BOUNDARY_VIOLATION");
}
