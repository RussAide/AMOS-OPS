import type { UserRole } from "@/constants/roles";
import {
  M41C_EVALUATION_AS_OF,
  M41C_EVIDENCE_CLASS,
} from "@contracts/m41c/shared";
import type {
  M41cClinicalGovernanceCouncil,
  M41cCompetencyGateResult,
  M41cGovernanceAction,
  M41cGovernanceDecision,
  M41cGovernanceLifecycleState,
  M41cGovernanceRecord,
  M41cGovernedArtifactKind,
  M41cSignedValidationRecord,
  M41cValidationCheck,
  M41cValidationSignature,
} from "@contracts/m41c/governance";

const NON_HUMAN_ACTOR_PATTERN =
  /^(?:ai|amos|assistant|model|system)(?:$|[-_:])/i;

function token(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return normalized || "EMPTY";
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

export function m41cDeterministicId(
  prefix: string,
  ...parts: readonly string[]
): string {
  const material = parts.join("|");
  return `${token(prefix)}-${token(parts[0] ?? "record")}-${stableHash(material)}`;
}

function assertIsoTime(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

function assertHumanActor(actorId: string, code: string): void {
  const normalized = actorId.trim();
  if (
    !normalized.startsWith("SYNTH-HUMAN-") ||
    NON_HUMAN_ACTOR_PATTERN.test(normalized)
  ) {
    throw new Error(code);
  }
}

function validateCompetencyGate(
  gate: M41cCompetencyGateResult,
): readonly string[] {
  const errors: string[] = [];
  if (!gate.staffId.startsWith("SYNTH-HUMAN-"))
    errors.push("M41C_VALIDATION_SYNTHETIC_COMPETENCY_STAFF_REQUIRED");
  if (gate.evidenceClass !== M41C_EVIDENCE_CLASS)
    errors.push("M41C_VALIDATION_COMPETENCY_EVIDENCE_BOUNDARY_VIOLATION");
  if (gate.productionUseAuthorized !== false)
    errors.push("M41C_PRODUCTION_CREDENTIAL_BOUNDARY_VIOLATION");
  if (
    !gate.passedForSyntheticDemo ||
    gate.requirementIds.length === 0 ||
    gate.requirementIds.some(
      (requirementId) => !gate.satisfiedRequirementIds.includes(requirementId),
    ) ||
    gate.missingRequirementIds.length > 0 ||
    gate.expiredRequirementIds.length > 0 ||
    gate.roleMismatchRequirementIds.length > 0
  ) {
    errors.push("M41C_VALIDATION_COMPETENCY_GATE_REQUIRED");
  }
  if (!Number.isFinite(Date.parse(gate.evaluatedAt)))
    errors.push("M41C_VALIDATION_COMPETENCY_TIME_INVALID");
  return Object.freeze(errors);
}

function unique<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(items)]);
}

export function createSyntheticM41cClinicalGovernanceCouncil(): M41cClinicalGovernanceCouncil {
  return Object.freeze({
    councilId: "SYNTH-M41C-CLINICAL-GOVERNANCE-COUNCIL",
    name: "AMOS-OPS Synthetic Clinical Governance Council",
    charterVersion: "M4.1C-SYNTH-1.0",
    effectiveAt: "2026-11-01T00:00:00.000Z",
    reviewDueAt: "2027-11-01T00:00:00.000Z",
    requiredApprovalRoles: Object.freeze([
      "clinical-director",
      "bhc-director",
    ] satisfies UserRole[]),
    members: Object.freeze([
      Object.freeze({
        memberId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        displayName: "Synthetic Clinical Director",
        role: "clinical-director" as const,
        voting: true,
        active: true,
        authorizationScopes: Object.freeze([
          "instrument",
          "algorithm",
          "guideline",
          "pathway",
          "knowledge_pack",
        ] as const),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        memberId: "SYNTH-HUMAN-BHC-DIRECTOR",
        displayName: "Synthetic BHC Director",
        role: "bhc-director" as const,
        voting: true,
        active: true,
        authorizationScopes: Object.freeze([
          "instrument",
          "algorithm",
          "guideline",
          "pathway",
          "knowledge_pack",
        ] as const),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        memberId: "SYNTH-HUMAN-CLINICAL-SUPERVISOR",
        displayName: "Synthetic Clinical Supervisor",
        role: "clinical-supervisor" as const,
        voting: true,
        active: true,
        authorizationScopes: Object.freeze([
          "instrument",
          "guideline",
          "pathway",
          "knowledge_pack",
        ] as const),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
      Object.freeze({
        memberId: "SYNTH-HUMAN-TRAINING-COORDINATOR",
        displayName: "Synthetic Training Coordinator",
        role: "training-coordinator" as const,
        voting: false,
        active: true,
        authorizationScopes: Object.freeze([
          "instrument",
          "guideline",
          "pathway",
          "knowledge_pack",
        ] as const),
        evidenceClass: M41C_EVIDENCE_CLASS,
      }),
    ]),
    productionActivationAuthority: false,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

export interface CreateM41cGovernanceRecordInput {
  artifactId: string;
  artifactKind: M41cGovernedArtifactKind;
  title: string;
  version: string;
  ownerRole: UserRole;
  sourceIds: readonly string[];
}

export function createM41cGovernanceRecord(
  input: CreateM41cGovernanceRecordInput,
): M41cGovernanceRecord {
  if (!input.artifactId.trim()) throw new Error("M41C_ARTIFACT_ID_REQUIRED");
  if (!input.title.trim()) throw new Error("M41C_ARTIFACT_TITLE_REQUIRED");
  if (!input.version.trim()) throw new Error("M41C_ARTIFACT_VERSION_REQUIRED");
  if (input.sourceIds.length === 0)
    throw new Error("M41C_ARTIFACT_SOURCE_REQUIRED");

  return Object.freeze({
    ...input,
    sourceIds: unique(input.sourceIds),
    activationState: "draft",
    lifecycleState: "draft",
    validationRecord: null,
    decisions: Object.freeze([]),
    supersededBy: null,
    withdrawnAt: null,
    productionActivationAvailable: false,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

export interface CreateM41cSignedValidationRecordInput {
  artifactId: string;
  artifactKind: M41cGovernedArtifactKind;
  artifactVersion: string;
  checks: readonly M41cValidationCheck[];
  signatures: readonly Omit<
    M41cValidationSignature,
    "signatureId" | "synthetic"
  >[];
  competencyGate: M41cCompetencyGateResult;
  sourceIds: readonly string[];
  recordedAt?: string;
}

export function createM41cSignedValidationRecord(
  input: CreateM41cSignedValidationRecordInput,
  council = createSyntheticM41cClinicalGovernanceCouncil(),
): M41cSignedValidationRecord {
  const recordedAt =
    input.recordedAt ??
    input.signatures.reduce(
      (latest, signature) =>
        Date.parse(signature.signedAt) > Date.parse(latest)
          ? signature.signedAt
          : latest,
      M41C_EVALUATION_AS_OF as string,
    );
  assertIsoTime(recordedAt, "M41C_VALIDATION_TIME_INVALID");
  if (input.checks.length === 0 || input.checks.some((check) => !check.passed))
    throw new Error("M41C_VALIDATION_CHECKS_INCOMPLETE");
  const competencyErrors = validateCompetencyGate(input.competencyGate);
  if (competencyErrors.length > 0) throw new Error(competencyErrors[0]);
  if (input.sourceIds.length === 0)
    throw new Error("M41C_VALIDATION_SOURCE_REQUIRED");
  if (
    new Set(input.checks.map((check) => check.checkId)).size !==
    input.checks.length
  ) {
    throw new Error("M41C_VALIDATION_CHECK_ID_DUPLICATE");
  }
  for (const check of input.checks) {
    if (!check.checkId.trim() || !check.label.trim())
      throw new Error("M41C_VALIDATION_CHECK_METADATA_REQUIRED");
    if (check.evidenceIds.length === 0)
      throw new Error("M41C_VALIDATION_CHECK_EVIDENCE_REQUIRED");
  }

  const signatures = input.signatures.map((signature) => {
    assertHumanActor(
      signature.signedBy,
      "M41C_MODEL_ONLY_VALIDATION_SIGNATURE_DENIED",
    );
    assertIsoTime(signature.signedAt, "M41C_VALIDATION_SIGNATURE_TIME_INVALID");
    if (Date.parse(signature.signedAt) > Date.parse(recordedAt))
      throw new Error("M41C_VALIDATION_SIGNATURE_AFTER_RECORD");
    if (!signature.attestation.trim())
      throw new Error("M41C_VALIDATION_ATTESTATION_REQUIRED");
    const member = council.members.find(
      (candidate) =>
        candidate.memberId === signature.signedBy &&
        candidate.role === signature.signedByRole,
    );
    if (!member?.active || !member.voting)
      throw new Error("M41C_COUNCIL_VOTING_MEMBER_REQUIRED");
    if (!member.authorizationScopes.includes(input.artifactKind))
      throw new Error("M41C_COUNCIL_SCOPE_AUTHORIZATION_REQUIRED");
    return Object.freeze({
      ...signature,
      signatureId: m41cDeterministicId(
        "M41C-SIGNATURE",
        input.artifactId,
        input.artifactVersion,
        signature.signedBy,
        signature.signedAt,
      ),
      synthetic: true as const,
    });
  });

  if (
    new Set(signatures.map((signature) => signature.signedBy)).size !==
      signatures.length ||
    new Set(signatures.map((signature) => signature.signedByRole)).size !==
      signatures.length
  ) {
    throw new Error("M41C_DUPLICATE_VALIDATION_SIGNER");
  }

  const signedRoles = new Set(
    signatures.map((signature) => signature.signedByRole),
  );
  for (const role of council.requiredApprovalRoles) {
    if (!signedRoles.has(role))
      throw new Error(`M41C_REQUIRED_COUNCIL_SIGNATURE_MISSING:${role}`);
  }

  return Object.freeze({
    validationId: m41cDeterministicId(
      "M41C-VALIDATION",
      input.artifactId,
      input.artifactVersion,
      recordedAt,
    ),
    artifactId: input.artifactId,
    artifactKind: input.artifactKind,
    artifactVersion: input.artifactVersion,
    checks: Object.freeze([...input.checks]),
    signatures: Object.freeze(signatures),
    approvedForSyntheticDemo: true,
    productionActivationAuthorized: false,
    competencyGateId: input.competencyGate.gateId,
    sourceIds: unique(input.sourceIds),
    recordedAt,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });
}

export function verifyM41cSignedValidationRecord(
  record: M41cSignedValidationRecord,
  council = createSyntheticM41cClinicalGovernanceCouncil(),
): readonly string[] {
  const errors: string[] = [];
  if (!record.artifactId.trim())
    errors.push("M41C_VALIDATION_ARTIFACT_REQUIRED");
  if (!record.artifactVersion.trim())
    errors.push("M41C_VALIDATION_ARTIFACT_VERSION_REQUIRED");
  if (!Number.isFinite(Date.parse(record.recordedAt)))
    errors.push("M41C_VALIDATION_TIME_INVALID");
  if (!record.competencyGateId.trim())
    errors.push("M41C_VALIDATION_COMPETENCY_GATE_ID_REQUIRED");
  if (record.evidenceClass !== M41C_EVIDENCE_CLASS)
    errors.push("M41C_VALIDATION_EVIDENCE_BOUNDARY_VIOLATION");
  if (record.productionActivationAuthorized !== false)
    errors.push("M41C_VALIDATION_PRODUCTION_AUTHORIZATION_DENIED");
  if (!record.approvedForSyntheticDemo)
    errors.push("M41C_VALIDATION_DEMO_APPROVAL_REQUIRED");
  if (
    record.checks.length === 0 ||
    record.checks.some((check) => !check.passed)
  )
    errors.push("M41C_VALIDATION_CHECKS_INCOMPLETE");
  if (record.sourceIds.length === 0)
    errors.push("M41C_VALIDATION_SOURCE_REQUIRED");
  if (new Set(record.sourceIds).size !== record.sourceIds.length)
    errors.push("M41C_VALIDATION_SOURCE_DUPLICATE");
  if (
    new Set(record.checks.map((check) => check.checkId)).size !==
    record.checks.length
  ) {
    errors.push("M41C_VALIDATION_CHECK_ID_DUPLICATE");
  }
  for (const check of record.checks) {
    if (!check.checkId.trim() || !check.label.trim())
      errors.push("M41C_VALIDATION_CHECK_METADATA_REQUIRED");
    if (check.evidenceIds.length === 0)
      errors.push(`M41C_VALIDATION_CHECK_EVIDENCE_REQUIRED:${check.checkId}`);
  }
  const expectedValidationId = m41cDeterministicId(
    "M41C-VALIDATION",
    record.artifactId,
    record.artifactVersion,
    record.recordedAt,
  );
  if (record.validationId !== expectedValidationId)
    errors.push("M41C_VALIDATION_ID_INVALID");
  if (
    new Set(record.signatures.map((signature) => signature.signedBy)).size !==
      record.signatures.length ||
    new Set(record.signatures.map((signature) => signature.signedByRole))
      .size !== record.signatures.length
  ) {
    errors.push("M41C_DUPLICATE_VALIDATION_SIGNER");
  }
  const roles = new Set(
    record.signatures.map((signature) => signature.signedByRole),
  );
  for (const role of council.requiredApprovalRoles) {
    if (!roles.has(role))
      errors.push(`M41C_REQUIRED_COUNCIL_SIGNATURE_MISSING:${role}`);
  }
  for (const signature of record.signatures) {
    const member = council.members.find(
      (candidate) =>
        candidate.memberId === signature.signedBy &&
        candidate.role === signature.signedByRole &&
        candidate.active &&
        candidate.voting,
    );
    if (!member || !member.authorizationScopes.includes(record.artifactKind))
      errors.push(`M41C_COUNCIL_SIGNATURE_INVALID:${signature.signatureId}`);
    if (
      !signature.signedBy.startsWith("SYNTH-HUMAN-") ||
      NON_HUMAN_ACTOR_PATTERN.test(signature.signedBy.trim())
    ) {
      errors.push(
        `M41C_VALIDATION_SIGNER_NOT_SYNTHETIC:${signature.signatureId}`,
      );
    }
    if (signature.synthetic !== true)
      errors.push(
        `M41C_VALIDATION_SIGNATURE_BOUNDARY_INVALID:${signature.signatureId}`,
      );
    if (!signature.attestation.trim())
      errors.push(
        `M41C_VALIDATION_ATTESTATION_REQUIRED:${signature.signatureId}`,
      );
    if (!Number.isFinite(Date.parse(signature.signedAt)))
      errors.push(
        `M41C_VALIDATION_SIGNATURE_TIME_INVALID:${signature.signatureId}`,
      );
    else if (
      Number.isFinite(Date.parse(record.recordedAt)) &&
      Date.parse(signature.signedAt) > Date.parse(record.recordedAt)
    ) {
      errors.push(
        `M41C_VALIDATION_SIGNATURE_AFTER_RECORD:${signature.signatureId}`,
      );
    }
    const expectedSignatureId = m41cDeterministicId(
      "M41C-SIGNATURE",
      record.artifactId,
      record.artifactVersion,
      signature.signedBy,
      signature.signedAt,
    );
    if (signature.signatureId !== expectedSignatureId)
      errors.push(
        `M41C_VALIDATION_SIGNATURE_ID_INVALID:${signature.signatureId}`,
      );
  }
  return Object.freeze(errors);
}

export interface ApplyM41cGovernanceActionInput {
  action: M41cGovernanceAction;
  decidedBy: string;
  decidedByRole: UserRole;
  decidedAt: string;
  rationale: string;
  sourceIds?: readonly string[];
  validationRecord?: M41cSignedValidationRecord;
  successorArtifactId?: string;
  emergencyReason?: string;
  exceptionReason?: string;
  exceptionExpiresAt?: string;
}

function expectedNextState(
  state: M41cGovernanceLifecycleState,
  action: M41cGovernanceAction,
): M41cGovernanceLifecycleState {
  if (state === "superseded" || state === "emergency_withdrawn")
    throw new Error("M41C_GOVERNANCE_TERMINAL_STATE");
  switch (action) {
    case "submit_for_validation":
      if (state !== "draft")
        throw new Error("M41C_GOVERNANCE_TRANSITION_DENIED");
      return "validation_pending";
    case "approve_demo":
      if (state !== "validation_pending")
        throw new Error("M41C_GOVERNANCE_TRANSITION_DENIED");
      return "demo_approved";
    case "record_review":
      return state;
    case "approve_exception":
      return state;
    case "quarantine":
      return "quarantined";
    case "return_to_draft":
      if (state !== "validation_pending" && state !== "quarantined")
        throw new Error("M41C_GOVERNANCE_TRANSITION_DENIED");
      return "draft";
    case "supersede":
      return "superseded";
    case "emergency_withdraw":
      return "emergency_withdrawn";
  }
}

export function applyM41cGovernanceAction(
  record: M41cGovernanceRecord,
  input: ApplyM41cGovernanceActionInput,
  council = createSyntheticM41cClinicalGovernanceCouncil(),
): M41cGovernanceRecord {
  assertHumanActor(
    input.decidedBy,
    "M41C_MODEL_ONLY_GOVERNANCE_DECISION_DENIED",
  );
  assertIsoTime(input.decidedAt, "M41C_GOVERNANCE_DECISION_TIME_INVALID");
  if (!input.rationale.trim())
    throw new Error("M41C_GOVERNANCE_RATIONALE_REQUIRED");
  const member = council.members.find(
    (candidate) =>
      candidate.memberId === input.decidedBy &&
      candidate.role === input.decidedByRole,
  );
  if (!member?.active || !member.voting)
    throw new Error("M41C_COUNCIL_VOTING_MEMBER_REQUIRED");
  if (!member.authorizationScopes.includes(record.artifactKind))
    throw new Error("M41C_COUNCIL_SCOPE_AUTHORIZATION_REQUIRED");

  const nextState = expectedNextState(record.lifecycleState, input.action);
  let validationRecord = record.validationRecord;
  if (input.action === "approve_demo") {
    if (!input.validationRecord)
      throw new Error("M41C_SIGNED_VALIDATION_REQUIRED");
    const validationErrors = verifyM41cSignedValidationRecord(
      input.validationRecord,
      council,
    );
    if (validationErrors.length > 0)
      throw new Error(
        `M41C_SIGNED_VALIDATION_INVALID:${validationErrors.join(",")}`,
      );
    if (
      input.validationRecord.artifactId !== record.artifactId ||
      input.validationRecord.artifactKind !== record.artifactKind ||
      input.validationRecord.artifactVersion !== record.version
    ) {
      throw new Error("M41C_VALIDATION_ARTIFACT_MISMATCH");
    }
    validationRecord = input.validationRecord;
  }
  if (input.action === "return_to_draft") validationRecord = null;
  if (input.action === "supersede" && !input.successorArtifactId?.trim())
    throw new Error("M41C_SUCCESSOR_ARTIFACT_REQUIRED");
  if (input.action === "emergency_withdraw" && !input.emergencyReason?.trim())
    throw new Error("M41C_EMERGENCY_WITHDRAWAL_REASON_REQUIRED");
  if (input.action === "approve_exception") {
    if (!input.exceptionReason?.trim())
      throw new Error("M41C_EXCEPTION_REASON_REQUIRED");
    if (
      !input.exceptionExpiresAt ||
      !Number.isFinite(Date.parse(input.exceptionExpiresAt)) ||
      Date.parse(input.exceptionExpiresAt) <= Date.parse(input.decidedAt)
    ) {
      throw new Error("M41C_EXCEPTION_EXPIRATION_REQUIRED");
    }
  }

  const decision: M41cGovernanceDecision = Object.freeze({
    decisionId: m41cDeterministicId(
      "M41C-GOV-DECISION",
      record.artifactId,
      String(record.decisions.length + 1),
      input.action,
      input.decidedAt,
    ),
    artifactId: record.artifactId,
    action: input.action,
    fromState: record.lifecycleState,
    toState: nextState,
    decidedBy: input.decidedBy,
    decidedByRole: input.decidedByRole,
    decidedAt: input.decidedAt,
    rationale: input.rationale,
    sourceIds: unique(input.sourceIds ?? record.sourceIds),
    validationId: input.validationRecord?.validationId ?? null,
    successorArtifactId: input.successorArtifactId ?? null,
    emergencyReason: input.emergencyReason ?? null,
    exceptionReason: input.exceptionReason ?? null,
    exceptionExpiresAt: input.exceptionExpiresAt ?? null,
    immutable: true,
    evidenceClass: M41C_EVIDENCE_CLASS,
  });

  const activationState =
    nextState === "superseded" || nextState === "emergency_withdrawn"
      ? "quarantined"
      : nextState;
  return Object.freeze({
    ...record,
    activationState,
    lifecycleState: nextState,
    validationRecord,
    decisions: Object.freeze([...record.decisions, decision]),
    supersededBy:
      input.action === "supersede"
        ? (input.successorArtifactId ?? null)
        : record.supersededBy,
    withdrawnAt:
      input.action === "emergency_withdraw"
        ? input.decidedAt
        : record.withdrawnAt,
    productionActivationAvailable: false,
  });
}

export function assertM41cProductionActivationUnavailable(): never {
  throw new Error("M41C_PRODUCTION_ACTIVATION_UNAVAILABLE");
}
