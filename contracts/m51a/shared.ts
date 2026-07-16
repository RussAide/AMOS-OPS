import type { DivisionId } from "../../src/constants/organization";
import type { UserRole } from "../../src/constants/roles";
import type { M42RoleTier } from "../m42/shared";

export const M51A_MILESTONE = "M5.1A" as const;
export const M51A_ENVIRONMENT_ID =
  "AMOS-OPS-M5.1A-OPERATIONS-HUB-CONNECTOR-EVALUATION" as const;
export const M51A_ENVIRONMENT_LABEL =
  "SYNTHETIC OPERATIONS HUB AND MICROSOFT CONNECTOR ARCHITECTURE — NO REAL DATA — NO LIVE MICROSOFT WRITES" as const;
export const M51A_EVALUATION_AS_OF = "2026-07-15T12:00:00.000Z" as const;
export const M51A_EVIDENCE_CLASS =
  "synthetic_operations_hub_connector_architecture_demo" as const;
export type M51AEvidenceClass = typeof M51A_EVIDENCE_CLASS;

export const M51A_CRITERION_IDS = [
  "M5.1A-AC-01",
  "M5.1A-AC-02",
  "M5.1A-AC-03",
  "M5.1A-AC-04",
  "M5.1A-AC-05",
  "M5.1A-AC-06",
  "M5.1A-AC-07",
  "M5.1A-AC-08",
] as const;
export type M51ACriterionId = (typeof M51A_CRITERION_IDS)[number];

export const M51A_PROHIBITED_ACTIONS = [
  "live_site_provisioning",
  "live_library_configuration",
  "live_purview_or_dlp_activation",
  "live_microsoft_graph_read",
  "live_microsoft_graph_write",
  "live_sharepoint_sync",
  "live_teams_notification",
  "live_outlook_intake",
  "real_content_ingestion",
  "restricted_record_migration",
  "production_secret_use",
  "production_deployment",
  "github_push",
] as const;
export type M51AProhibitedAction =
  (typeof M51A_PROHIBITED_ACTIONS)[number];

export interface M51AActorContext {
  actorId: string;
  role: UserRole;
  tier: M42RoleTier;
  divisionIds: readonly DivisionId[];
  permissions: readonly string[];
  minimumNecessaryPurpose: string;
  synthetic: true;
}

export interface M51AAuditEvent {
  eventId: string;
  eventType:
    | "hub_architecture_validated"
    | "route_evaluated"
    | "publication_evaluated"
    | "inventory_registered"
    | "disposition_assigned"
    | "connector_mode_evaluated"
    | "stable_object_resolved"
    | "connector_operation_blocked"
    | "connector_retry_recorded"
    | "connector_conflict_recorded"
    | "reconciliation_completed"
    | "pilot_rolled_back"
    | "unauthorized_retrieval_blocked"
    | "live_write_blocked";
  actorId: string;
  actorRole: UserRole;
  entityType:
    | "hub"
    | "site"
    | "library"
    | "route"
    | "repository"
    | "item"
    | "connector"
    | "pilot";
  entityId: string;
  correlationId: string;
  outcome: "allowed" | "denied" | "blocked" | "recorded";
  reason: string;
  occurredAt: string;
  immutable: true;
  evidenceClass: M51AEvidenceClass;
}

export interface M51AAcceptanceFlag {
  criterionId: M51ACriterionId;
  passed: boolean;
  assertionCount: number;
  summary: string;
  evidenceIds: readonly string[];
}

export interface M51ADemoBoundary {
  environmentId: typeof M51A_ENVIRONMENT_ID;
  environmentLabel: typeof M51A_ENVIRONMENT_LABEL;
  evidenceClass: M51AEvidenceClass;
  syntheticOnly: true;
  realDataUsed: false;
  realFileContentRead: false;
  productionRows: 0;
  liveWrites: 0;
  liveMicrosoftReads: 0;
  liveMicrosoftWrites: 0;
  liveSiteProvisioning: false;
  liveConnectorMutation: false;
  restrictedRecordMigration: false;
  productionDeployment: false;
  githubPush: false;
  prohibitedActions: readonly M51AProhibitedAction[];
}

export function createM51ADemoBoundary(): M51ADemoBoundary {
  return Object.freeze({
    environmentId: M51A_ENVIRONMENT_ID,
    environmentLabel: M51A_ENVIRONMENT_LABEL,
    evidenceClass: M51A_EVIDENCE_CLASS,
    syntheticOnly: true,
    realDataUsed: false,
    realFileContentRead: false,
    productionRows: 0,
    liveWrites: 0,
    liveMicrosoftReads: 0,
    liveMicrosoftWrites: 0,
    liveSiteProvisioning: false,
    liveConnectorMutation: false,
    restrictedRecordMigration: false,
    productionDeployment: false,
    githubPush: false,
    prohibitedActions: M51A_PROHIBITED_ACTIONS,
  });
}

export function requireM51ASyntheticId(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^SYNTH-[A-Z0-9][A-Z0-9._:-]*$/i.test(normalized))
    throw new Error(
      `M51A_${label.toUpperCase()}_SYNTHETIC_ID_REQUIRED`,
    );
  return normalized;
}
