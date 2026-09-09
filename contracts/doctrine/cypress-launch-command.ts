export const CYPRESS_LAUNCH_PREVIEW_SCENARIOS = [
  "controlled_baseline",
  "future_capacity_blocked",
  "runtime_dependency",
  "authority_conflict",
  "calendar_bypass_blocked",
] as const;

export type CypressLaunchPreviewScenario =
  (typeof CYPRESS_LAUNCH_PREVIEW_SCENARIOS)[number];

export const CYPRESS_CAPABILITY_LEVELS = [
  "L0",
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
  "L8",
  "L9",
  "L10",
  "L11",
  "L12",
] as const;

export type CypressCapabilityLevel =
  (typeof CYPRESS_CAPABILITY_LEVELS)[number];

export type CypressLaunchGateState =
  | "VERIFIED_READY"
  | "BLOCKED"
  | "PENDING_EVIDENCE"
  | "NOT_AUTHORIZED";

export type CypressLaunchOutcome =
  | "READY_FOR_AUTHORIZED_LEVEL"
  | "BLOCKED"
  | "AUTHORITY_CONFLICT";

export interface CypressDoctrineRule {
  readonly id: string;
  readonly title: string;
  readonly domain:
    | "authority"
    | "capacity"
    | "rate"
    | "acuity"
    | "placement_stability"
    | "records"
    | "repository"
    | "launch_gating";
  readonly authorityState: "CURRENT_CONTROLLING";
  readonly statement: string;
  readonly controlValue?: string;
}

export interface CypressCapabilityGate {
  readonly level: CypressCapabilityLevel;
  readonly title: string;
  readonly state: CypressLaunchGateState;
  readonly evidence: readonly string[];
  readonly blockers: readonly string[];
}

export interface CypressLaunchException {
  readonly code: string;
  readonly severity: "CONTROL" | "DEPENDENCY" | "AUTHORITY";
  readonly summary: string;
  readonly disposition: "BLOCK" | "CARRY_FORWARD";
}

export interface CypressLaunchTraceEntry {
  readonly step: string;
  readonly status: "PASS" | "BLOCKED" | "NOT_REACHED";
  readonly detail: string;
}

export interface CypressLaunchCommandPreviewResult {
  readonly scenario: CypressLaunchPreviewScenario;
  readonly environment: "SYNTHETIC_PREVIEW";
  readonly noPhi: true;
  readonly outcome: CypressLaunchOutcome;
  readonly requestedLevel: CypressCapabilityLevel;
  readonly highestVerifiedLevel: CypressCapabilityLevel;
  readonly licensedCapacity: 10;
  readonly requestedCapacity: 10 | 16;
  readonly futureCapacity: 16;
  readonly productionPromotion: "NOT_AUTHORIZED";
  readonly rateDoctrine: {
    readonly floor: 450;
    readonly target: 550;
    readonly enhanced: 650;
    readonly currency: "USD";
    readonly qualifier: "CONTROLLED_DOCTRINE_NOT_PAYER_GUARANTEE";
  };
  readonly doctrine: readonly CypressDoctrineRule[];
  readonly gates: readonly CypressCapabilityGate[];
  readonly exceptions: readonly CypressLaunchException[];
  readonly trace: readonly CypressLaunchTraceEntry[];
  readonly title: string;
  readonly summary: string;
  readonly exactNextAction: string;
}

export interface CypressLaunchCommandStatus {
  readonly sprint: "Cypress Doctrine Sprint 01";
  readonly stage: "S4";
  readonly capability: "Launch Command / Doctrine";
  readonly previewAvailable: true;
  readonly previewEnvironment: "SYNTHETIC_PREVIEW";
  readonly noPhi: true;
  readonly liveProductionAuthorized: false;
  readonly productionPromotion: "NOT_AUTHORIZED";
  readonly message: string;
}
