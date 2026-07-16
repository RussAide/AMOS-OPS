import type { UserRole } from "../../src/constants/roles";
import type { M41cActivationState, M41cEvidenceClass } from "./shared";

export const M41C_GOVERNED_ARTIFACT_KINDS = [
  "instrument",
  "algorithm",
  "guideline",
  "pathway",
  "knowledge_pack",
] as const;
export type M41cGovernedArtifactKind =
  (typeof M41C_GOVERNED_ARTIFACT_KINDS)[number];

export const M41C_GOVERNANCE_ACTIONS = [
  "submit_for_validation",
  "approve_demo",
  "record_review",
  "approve_exception",
  "quarantine",
  "return_to_draft",
  "supersede",
  "emergency_withdraw",
] as const;
export type M41cGovernanceAction = (typeof M41C_GOVERNANCE_ACTIONS)[number];

export type M41cGovernanceLifecycleState =
  M41cActivationState | "superseded" | "emergency_withdrawn";

export interface M41cCouncilMember {
  memberId: string;
  displayName: string;
  role: UserRole;
  voting: boolean;
  active: boolean;
  authorizationScopes: readonly M41cGovernedArtifactKind[];
  evidenceClass: M41cEvidenceClass;
}

export interface M41cClinicalGovernanceCouncil {
  councilId: string;
  name: string;
  charterVersion: string;
  effectiveAt: string;
  reviewDueAt: string;
  requiredApprovalRoles: readonly UserRole[];
  members: readonly M41cCouncilMember[];
  productionActivationAuthority: false;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cValidationCheck {
  checkId: string;
  label: string;
  passed: boolean;
  evidenceIds: readonly string[];
  notes: readonly string[];
}

export interface M41cValidationSignature {
  signatureId: string;
  signedBy: string;
  signedByRole: UserRole;
  signedAt: string;
  attestation: string;
  synthetic: true;
}

export interface M41cSignedValidationRecord {
  validationId: string;
  artifactId: string;
  artifactKind: M41cGovernedArtifactKind;
  artifactVersion: string;
  checks: readonly M41cValidationCheck[];
  signatures: readonly M41cValidationSignature[];
  approvedForSyntheticDemo: boolean;
  productionActivationAuthorized: false;
  competencyGateId: string;
  sourceIds: readonly string[];
  recordedAt: string;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cGovernanceDecision {
  decisionId: string;
  artifactId: string;
  action: M41cGovernanceAction;
  fromState: M41cGovernanceLifecycleState;
  toState: M41cGovernanceLifecycleState;
  decidedBy: string;
  decidedByRole: UserRole;
  decidedAt: string;
  rationale: string;
  sourceIds: readonly string[];
  validationId: string | null;
  successorArtifactId: string | null;
  emergencyReason: string | null;
  exceptionReason: string | null;
  exceptionExpiresAt: string | null;
  immutable: true;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cGovernanceRecord {
  artifactId: string;
  artifactKind: M41cGovernedArtifactKind;
  title: string;
  version: string;
  ownerRole: UserRole;
  activationState: M41cActivationState;
  lifecycleState: M41cGovernanceLifecycleState;
  sourceIds: readonly string[];
  validationRecord: M41cSignedValidationRecord | null;
  decisions: readonly M41cGovernanceDecision[];
  supersededBy: string | null;
  withdrawnAt: string | null;
  productionActivationAvailable: false;
  evidenceClass: M41cEvidenceClass;
}

export type M41cCompetencyScope =
  | "governance_approval"
  | "instrument_administration"
  | "instrument_interpretation"
  | "pathway_guidance"
  | "safety_escalation"
  | "documentation"
  | "supervised_demo_use";

export interface M41cCompetencyRequirement {
  requirementId: string;
  title: string;
  scope: M41cCompetencyScope;
  permittedRoles: readonly UserRole[];
  pathwayIds: readonly string[];
  instrumentProfileIds: readonly string[];
  requiresExternalCertification: boolean;
  certificationType: string | null;
  supervisedUseRequired: boolean;
  renewalDays: number;
  ownerRole: UserRole;
  sourceIds: readonly string[];
  evidenceClass: M41cEvidenceClass;
}

export interface M41cCompetencyAttestation {
  attestationId: string;
  requirementId: string;
  staffId: string;
  staffRole: UserRole;
  completedAt: string;
  expiresAt: string;
  evidenceIds: readonly string[];
  externalCertificationId: string | null;
  supervisedBy: string | null;
  attestedBy: string;
  attestedByRole: UserRole;
  attestedAt: string;
  revokedAt: string | null;
  synthetic: true;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cCompetencyRegistry {
  registryId: string;
  asOf: string;
  requirements: readonly M41cCompetencyRequirement[];
  attestations: readonly M41cCompetencyAttestation[];
  productionCredentialingAvailable: false;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cCompetencyGateResult {
  gateId: string;
  staffId: string;
  staffRole: UserRole;
  requirementIds: readonly string[];
  satisfiedRequirementIds: readonly string[];
  missingRequirementIds: readonly string[];
  expiredRequirementIds: readonly string[];
  roleMismatchRequirementIds: readonly string[];
  passedForSyntheticDemo: boolean;
  productionUseAuthorized: false;
  evaluatedAt: string;
  evidenceClass: M41cEvidenceClass;
}
