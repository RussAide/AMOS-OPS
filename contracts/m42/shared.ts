import type { DivisionId } from "../../src/constants/organization";
import type { UserRole } from "../../src/constants/roles";

export const M42_MILESTONE = "M4.2" as const;
export const M42_ENVIRONMENT_ID = "AMOS-OPS-M4.2-DOCUMENT-KNOWLEDGE-EVALUATION" as const;
export const M42_ENVIRONMENT_LABEL = "SYNTHETIC DOCUMENT AND KNOWLEDGE PROTOTYPE — NO REAL DATA — NO LIVE EXTERNAL WRITES" as const;
export const M42_EVALUATION_AS_OF = "2026-12-15T08:00:00.000Z" as const;
export const M42_EVIDENCE_CLASS = "synthetic_document_knowledge_demo" as const;
export type M42EvidenceClass = typeof M42_EVIDENCE_CLASS;

export const M42_ROLE_TIERS = ["T1", "T2", "T3", "T4"] as const;
export type M42RoleTier = (typeof M42_ROLE_TIERS)[number];
export const M42_SENSITIVITY_LEVELS = ["public", "internal", "confidential", "restricted", "part2"] as const;
export type M42SensitivityLevel = (typeof M42_SENSITIVITY_LEVELS)[number];
export const M42_RECORD_STATES = ["draft", "in_review", "approved", "published", "superseded", "withdrawn", "retained"] as const;
export type M42RecordState = (typeof M42_RECORD_STATES)[number];

export const M42_PROHIBITED_ACTIONS = [
  "production_disposition", "production_deletion", "live_external_publish", "live_external_sync",
  "live_disclosure", "live_recipient_delivery", "real_data_ingestion", "github_push", "deployment",
] as const;
export type M42ProhibitedAction = (typeof M42_PROHIBITED_ACTIONS)[number];

export const M42_CRITERION_IDS = ["M4.2-01", "M4.2-02", "M4.2-03", "M4.2-04", "M4.2-05", "M4.2-06", "M4.2-07", "M4.2-08"] as const;
export type M42CriterionId = (typeof M42_CRITERION_IDS)[number];

export interface M42ActorContext {
  actorId: string;
  role: UserRole;
  tier: M42RoleTier;
  divisionIds: readonly DivisionId[];
  permissions: readonly string[];
  sensitivityClearance: readonly M42SensitivityLevel[];
  minimumNecessaryPurpose: string;
  synthetic: true;
}

export interface M42SourceCitation {
  sourceId: string;
  stableObjectId: string;
  title: string;
  version: string;
  ownerRole: UserRole;
  recordState: M42RecordState;
  classification: M42SensitivityLevel;
  sourceOfTruthUri: string;
  effectiveAt: string;
  reviewedAt: string;
  contentHash: string;
  synthetic: true;
}

export interface M42AuditEvent {
  eventId: string;
  eventType: "document_registered" | "access_evaluated" | "disclosure_blocked" | "version_created" |
    "approval_recorded" | "record_superseded" | "legal_hold_applied" | "disposition_blocked" |
    "search_executed" | "citation_returned" | "report_saved" | "report_executed" |
    "export_manifest_created" | "configuration_validated" | "configuration_changed" |
    "configuration_rolled_back" | "external_write_blocked";
  actorId: string;
  actorRole: UserRole;
  entityType: "document" | "version" | "search" | "report" | "configuration";
  entityId: string;
  correlationId: string;
  sourceIds: readonly string[];
  outcome: "allowed" | "denied" | "blocked" | "recorded";
  reason: string;
  occurredAt: string;
  immutable: true;
  evidenceClass: M42EvidenceClass;
}

export interface M42AcceptanceFlag {
  criterionId: M42CriterionId;
  passed: boolean;
  assertionCount: number;
  summary: string;
  evidenceIds: readonly string[];
}

export interface M42DemoBoundary {
  environmentId: typeof M42_ENVIRONMENT_ID;
  environmentLabel: typeof M42_ENVIRONMENT_LABEL;
  evidenceClass: M42EvidenceClass;
  syntheticOnly: true;
  realDataUsed: false;
  liveConnectorMutation: false;
  liveDisclosure: false;
  productionDisposition: false;
  productionDeployment: false;
  githubPush: false;
  prohibitedActions: readonly M42ProhibitedAction[];
}

export function createM42DemoBoundary(): M42DemoBoundary {
  return Object.freeze({
    environmentId: M42_ENVIRONMENT_ID,
    environmentLabel: M42_ENVIRONMENT_LABEL,
    evidenceClass: M42_EVIDENCE_CLASS,
    syntheticOnly: true,
    realDataUsed: false,
    liveConnectorMutation: false,
    liveDisclosure: false,
    productionDisposition: false,
    productionDeployment: false,
    githubPush: false,
    prohibitedActions: M42_PROHIBITED_ACTIONS,
  });
}

export function requireM42SyntheticId(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^SYNTH-[A-Z0-9][A-Z0-9._:-]*$/i.test(normalized)) throw new Error(`M42_${label.toUpperCase()}_SYNTHETIC_ID_REQUIRED`);
  return normalized;
}

export function tierAtLeastT2(tier: M42RoleTier): boolean {
  return tier === "T1" || tier === "T2";
}
