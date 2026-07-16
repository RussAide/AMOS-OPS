import type { UserRole } from "@/constants/roles";
import type {
  Dx1AuditEvent,
  Dx1PilotStageId,
  Dx1StreamResult,
} from "../contracts";

export const DX1_SECURITY_DOMAINS = [
  "phi-like-clinical",
  "hr",
  "finance",
  "executive",
  "compliance",
] as const;

export type Dx1SecurityDomain = (typeof DX1_SECURITY_DOMAINS)[number];
export type Dx1SecurityAction =
  | "view"
  | "record"
  | "review"
  | "approve"
  | "summarize";

export interface Dx1PilotActor {
  readonly actorId: string;
  readonly role: UserRole;
  readonly label: string;
}

export interface Dx1PilotAccessRequest {
  readonly requestId?: string;
  readonly scenarioId: string;
  readonly stageId: Dx1PilotStageId | "cross-enterprise";
  readonly actor: Dx1PilotActor;
  readonly domain: Dx1SecurityDomain;
  readonly action: Dx1SecurityAction;
  readonly recordId: string;
  readonly subjectId?: string;
  readonly requestedFields: readonly string[];
}

export type Dx1PilotAccessCode =
  | "DX1_ACCESS_ALLOWED"
  | "DX1_SCENARIO_BOUNDARY_DENIED"
  | "DX1_SYNTHETIC_ACTOR_REQUIRED"
  | "DX1_SYNTHETIC_RECORD_REQUIRED"
  | "DX1_SYNTHETIC_SUBJECT_REQUIRED"
  | "DX1_CANONICAL_PERMISSION_DENIED"
  | "DX1_LEAST_PRIVILEGE_ROLE_DENIED"
  | "DX1_MINIMUM_NECESSARY_DENIED"
  | "DX1_CLINICAL_POLICY_DENIED";

export interface Dx1PilotAccessDecision {
  readonly allowed: boolean;
  readonly code: Dx1PilotAccessCode;
  readonly domain: Dx1SecurityDomain;
  readonly action: Dx1SecurityAction;
  readonly actorId: string;
  readonly actorRole: UserRole;
  readonly permittedFields: readonly string[];
  readonly suppressedFields: readonly string[];
  readonly canonicalClinicalDecisionCode: string | null;
  readonly reason: string;
  readonly auditEvent: Dx1AuditEvent;
}

export interface Dx1PilotStageRecord {
  readonly sequence: number;
  readonly stageId: Dx1PilotStageId;
  readonly scenarioId: string;
  readonly ownerId: string;
  readonly ownerRole: UserRole;
  readonly status: "completed";
  readonly evidenceGate: "passed";
  readonly escalationState: "none" | "resolved";
  readonly artifactId: string;
  readonly evidenceIds: readonly string[];
  readonly sourceModules: readonly string[];
  readonly artifact: Readonly<Record<string, unknown>>;
  readonly inputFingerprint: string;
  readonly outputFingerprint: string;
  readonly auditEventId: string;
  readonly completedAt: string;
  readonly synthetic: true;
}

export interface Dx1PilotAttemptResult {
  readonly accepted: boolean;
  readonly stageId: Dx1PilotStageId;
  readonly code:
    | "DX1_STAGE_COMPLETED"
    | "DX1_STAGE_SEQUENCE_DENIED"
    | "DX1_STAGE_ACCESS_DENIED"
    | "DX1_STAGE_EVIDENCE_HELD";
  readonly reason: string;
  readonly stage: Dx1PilotStageRecord | null;
  readonly accessDecision: Dx1PilotAccessDecision | null;
  readonly businessFingerprintBefore: string;
  readonly businessFingerprintAfter: string;
  readonly businessStageCountBefore: number;
  readonly businessStageCountAfter: number;
  readonly partialBusinessSideEffects: 0;
  readonly auditEventIds: readonly string[];
}

export interface Dx1PilotAttemptInput {
  readonly stageId: Dx1PilotStageId;
  readonly actor: Dx1PilotActor;
  readonly evidenceAvailable?: boolean;
}

export interface Dx1SecurityPilotResult extends Dx1StreamResult {
  readonly streamId: "security-pilot";
  readonly scenarioId: string;
  readonly status: "completed";
  readonly stages: readonly Dx1PilotStageRecord[];
  readonly attempts: readonly Dx1PilotAttemptResult[];
  readonly accessDecisions: readonly Dx1PilotAccessDecision[];
  readonly deniedAttempts: readonly Dx1PilotAttemptResult[];
  readonly deniedAccessDecisions: readonly Dx1PilotAccessDecision[];
  readonly completedStageCount: 8;
  readonly skippedStageCount: 0;
  readonly orphanedArtifactCount: 0;
  readonly inconsistentSummaryCount: 0;
  readonly partialSideEffectCount: 0;
  readonly traceFingerprint: string;
}
