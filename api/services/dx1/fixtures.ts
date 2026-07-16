import {
  DX1_EVALUATED_AT,
  DX1_SCENARIO_ID,
  type Dx1EnterpriseDomain,
  type Dx1PilotStageId,
} from "./contracts";

export interface Dx1SyntheticPersona {
  readonly actorId: string;
  readonly role: string;
  readonly displayLabel: string;
  readonly division: "bhc" | "gro" | "enterprise";
  readonly domains: readonly Dx1EnterpriseDomain[];
}

export const DX1_SYNTHETIC_PERSONAS: readonly Dx1SyntheticPersona[] = Object.freeze([
  Object.freeze({
    actorId: "SYNTH-DX1-ACTOR-INTAKE-001",
    role: "intake-coordinator",
    displayLabel: "Synthetic Intake Coordinator",
    division: "bhc",
    domains: Object.freeze(["operations", "clinical"] as const),
  }),
  Object.freeze({
    actorId: "SYNTH-DX1-ACTOR-CLINICAL-002",
    role: "clinician",
    displayLabel: "Synthetic Authorized Clinician",
    division: "bhc",
    domains: Object.freeze(["clinical"] as const),
  }),
  Object.freeze({
    actorId: "SYNTH-DX1-ACTOR-QA-003",
    role: "quality-manager",
    displayLabel: "Synthetic Quality Manager",
    division: "enterprise",
    domains: Object.freeze(["clinical", "compliance"] as const),
  }),
  Object.freeze({
    actorId: "SYNTH-DX1-ACTOR-REVENUE-004",
    role: "billing-specialist",
    displayLabel: "Synthetic Billing Specialist",
    division: "enterprise",
    domains: Object.freeze(["revenue"] as const),
  }),
  Object.freeze({
    actorId: "SYNTH-DX1-ACTOR-EXEC-005",
    role: "executive",
    displayLabel: "Synthetic Executive Reviewer",
    division: "enterprise",
    domains: Object.freeze([
      "operations",
      "compliance",
      "revenue",
      "workforce",
      "executive",
    ] as const),
  }),
]);

export interface Dx1PilotFixture {
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly youthId: string;
  readonly referralId: string;
  readonly episodeId: string;
  readonly authorizationId: string;
  readonly serviceEventId: string;
  readonly documentPacketId: string;
  readonly evaluatedAt: typeof DX1_EVALUATED_AT;
  readonly expectedStages: readonly Dx1PilotStageId[];
  readonly synthetic: true;
}

export const DX1_PILOT_FIXTURE: Readonly<Dx1PilotFixture> = Object.freeze({
  scenarioId: DX1_SCENARIO_ID,
  youthId: "SYNTH-DX1-YOUTH-001",
  referralId: "SYNTH-DX1-REFERRAL-001",
  episodeId: "SYNTH-DX1-EPISODE-001",
  authorizationId: "SYNTH-DX1-AUTH-001",
  serviceEventId: "SYNTH-DX1-SERVICE-001",
  documentPacketId: "SYNTH-DX1-PACKET-001",
  evaluatedAt: DX1_EVALUATED_AT,
  expectedStages: Object.freeze([
    "referral-received",
    "intake-review",
    "cans-trr-support",
    "authorization-setup",
    "service-delivery",
    "qa-documentation-review",
    "billing-gate",
    "executive-risk-revenue-summary",
  ] as const),
  synthetic: true,
});
