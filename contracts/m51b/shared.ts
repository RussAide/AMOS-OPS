export const M51B_CRITERION_IDS = Object.freeze([
  "M5.1B-AC-01",
  "M5.1B-AC-02",
  "M5.1B-AC-03",
  "M5.1B-AC-04",
  "M5.1B-AC-05",
  "M5.1B-AC-06",
  "M5.1B-AC-07",
  "M5.1B-AC-08",
] as const);

export type M51BCriterionId = (typeof M51B_CRITERION_IDS)[number];

export const M51B_EVIDENCE_CLASS =
  "synthetic_microsoft_365_workflow_integration_demo" as const;

export const M51B_EVALUATION_STARTED_AT =
  "2026-07-15T12:00:00.000Z" as const;

export const M51B_APPROVED_TENANT_BOUNDARY =
  "SYNTHETIC-ADOLBI-NONPRODUCTION-TENANT" as const;

export type M51BIntegrationChannel = "teams" | "outlook" | "sharepoint";

export interface M51BDemoBoundary {
  environmentId: "AMOS-OPS-M5.1B-MICROSOFT-INTEGRATION-EVALUATION";
  environmentLabel: string;
  evidenceClass: typeof M51B_EVIDENCE_CLASS;
  syntheticOnly: true;
  realDataUsed: false;
  realFileContentRead: false;
  liveGraphCalls: 0;
  liveMicrosoftReads: 0;
  liveMicrosoftWrites: 0;
  realNotificationsSent: 0;
  realMailRead: 0;
  productionRows: 0;
  liveWrites: 0;
  liveConnectorMutation: false;
  tenantProvisioning: false;
  productionSecretRead: false;
  productionDeployment: false;
  githubPush: false;
}

export function createM51BDemoBoundary(): Readonly<M51BDemoBoundary> {
  return Object.freeze({
    environmentId: "AMOS-OPS-M5.1B-MICROSOFT-INTEGRATION-EVALUATION",
    environmentLabel:
      "SYNTHETIC MICROSOFT 365 WORKFLOW INTEGRATION — NO REAL DATA — NO LIVE MICROSOFT CALLS",
    evidenceClass: M51B_EVIDENCE_CLASS,
    syntheticOnly: true,
    realDataUsed: false,
    realFileContentRead: false,
    liveGraphCalls: 0,
    liveMicrosoftReads: 0,
    liveMicrosoftWrites: 0,
    realNotificationsSent: 0,
    realMailRead: 0,
    productionRows: 0,
    liveWrites: 0,
    liveConnectorMutation: false,
    tenantProvisioning: false,
    productionSecretRead: false,
    productionDeployment: false,
    githubPush: false,
  });
}

export interface M51BAuditEvent {
  eventId: string;
  eventType: string;
  channel: M51BIntegrationChannel | "integration";
  occurredAt: string;
  actorId: string;
  correlationId: string;
  idempotencyKey: string;
  outcome: "accepted" | "denied" | "queued" | "delivered" | "failed" | "recovered";
  reasonCodes: readonly string[];
  immutable: true;
  evidenceClass: typeof M51B_EVIDENCE_CLASS;
  synthetic: true;
}

export interface M51BAcceptanceFlag {
  criterionId: M51BCriterionId;
  passed: boolean;
  assertionCount: number;
  summary: string;
  evidenceIds: readonly string[];
}

export function elapsedSeconds(startedAt: string, completedAt: string): number {
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started)
    return Number.POSITIVE_INFINITY;
  return (completed - started) / 1_000;
}
