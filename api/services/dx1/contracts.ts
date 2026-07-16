export const DX1_MILESTONE = "DX.1" as const;
export const DX1_SCENARIO_ID = "SYNTH-DX1-CROSS-ENTERPRISE-DEMO-001" as const;
export const DX1_EVALUATED_AT = "2026-07-15T18:00:00.000Z" as const;
export const DX1_EXACT_ACCEPTANCE_STATEMENT =
  "A representative user can enter through the Operations Hub, complete the approved eight-step synthetic referral-to-executive pilot without technical burden, obtain contextual agent assistance, observe governed document and relationship intelligence, and see the resulting enterprise status while permissions, evidence gates, auditability, and the Microsoft support-layer boundary remain intact." as const;

export const DX1_CRITERION_IDS = [
  "DX.1-01",
  "DX.1-02",
  "DX.1-03",
  "DX.1-04",
  "DX.1-05",
  "DX.1-06",
  "DX.1-07",
  "DX.1-08",
  "DX.1-09",
  "DX.1-10",
  "DX.1-11",
  "DX.1-12",
] as const;

export type Dx1CriterionId = (typeof DX1_CRITERION_IDS)[number];
export type Dx1CriterionStatus = "Complete" | "Partial — action remains" | "Not started";

export const DX1_PILOT_STAGE_IDS = [
  "referral-received",
  "intake-review",
  "cans-trr-support",
  "authorization-setup",
  "service-delivery",
  "qa-documentation-review",
  "billing-gate",
  "executive-risk-revenue-summary",
] as const;

export type Dx1PilotStageId = (typeof DX1_PILOT_STAGE_IDS)[number];

export const DX1_ENTERPRISE_DOMAINS = [
  "operations",
  "clinical",
  "compliance",
  "revenue",
  "workforce",
  "executive",
] as const;

export type Dx1EnterpriseDomain = (typeof DX1_ENTERPRISE_DOMAINS)[number];

export interface Dx1PrototypeBoundary {
  readonly synthetic: true;
  readonly demoMode: true;
  readonly productionRows: 0;
  readonly liveExternalCalls: 0;
  readonly liveMicrosoftReads: 0;
  readonly liveMicrosoftWrites: 0;
  readonly liveClinicalScoringActivations: 0;
  readonly liveLevelOfCareDecisions: 0;
  readonly realNotificationsSent: 0;
  readonly deployments: 0;
  readonly githubPushes: 0;
}

export function createDx1PrototypeBoundary(): Readonly<Dx1PrototypeBoundary> {
  return Object.freeze({
    synthetic: true,
    demoMode: true,
    productionRows: 0,
    liveExternalCalls: 0,
    liveMicrosoftReads: 0,
    liveMicrosoftWrites: 0,
    liveClinicalScoringActivations: 0,
    liveLevelOfCareDecisions: 0,
    realNotificationsSent: 0,
    deployments: 0,
    githubPushes: 0,
  });
}

export interface Dx1AuditEvent {
  readonly eventId: string;
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly stageId: Dx1PilotStageId | "cross-enterprise";
  readonly actorId: string;
  readonly actorRole: string;
  readonly action: string;
  readonly outcome: "allowed" | "denied" | "held" | "completed";
  readonly reason: string;
  readonly evidenceIds: readonly string[];
  readonly occurredAt: string;
  readonly synthetic: true;
}

export interface Dx1CriterionResult {
  readonly criterionId: Dx1CriterionId;
  readonly status: Dx1CriterionStatus;
  readonly assertionIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly summary: string;
}

export interface Dx1StreamResult {
  readonly streamId: "experience-governance" | "intelligence-platform" | "security-pilot";
  readonly passed: boolean;
  readonly assertionCount: number;
  readonly criteria: readonly Dx1CriterionResult[];
  readonly auditEvents: readonly Dx1AuditEvent[];
  readonly boundary: Readonly<Dx1PrototypeBoundary>;
}
