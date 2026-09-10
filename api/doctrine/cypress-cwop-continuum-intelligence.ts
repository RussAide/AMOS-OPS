import type {
  CypressS7AuditEvent,
  CypressS7ExecutiveDecisionCase,
  CypressS7Exception,
  CypressS7NegotiationCase,
  CypressS7PreviewResult,
  CypressS7PreviewScenario,
  CypressS7Status,
  CypressS7ValueEvidenceSource,
  CypressS7ValueMeasurement,
} from "../../contracts/doctrine/cypress-cwop-continuum-intelligence";
import { buildCypressS5Preview } from "./cypress-referral-acuity-rate";
import { buildCypressS6Preview } from "./cypress-admin-workforce-stability";

const LICENSED_CAPACITY = 10 as const;
const FUTURE_CAPACITY = 16 as const;
const RATE_FLOOR = 450 as const;
const RATE_TARGET = 550 as const;
const RATE_ENHANCED = 650 as const;

const STRATEGIC_HYPOTHESIS =
  "A maintained, appropriately funded continuum should reduce recurring crisis utilization, placement disruption, emergency settings, repeated placement search, and administrative escalation.";

function continuumSnapshots(): CypressS7PreviewResult["continuum"] {
  const placement = buildCypressS6Preview("hospitalization_return");
  const highAcuity = buildCypressS5Preview("high_acuity_accept");
  return [
    {
      phase: "BEFORE_ADOLBI",
      cwopEpisodes: 3,
      placementBreakdowns: 2,
      hospitalOrEdEpisodes: 3,
      lawEnforcementOrTransportEvents: 2,
      placementSearches: 4,
      dailyRate: null,
      supervisionLevel: null,
      staffingAndSupports: [],
      crisisEvents: null,
      stabilityDays: null,
      hospitalReturns: null,
      placementMaintained: null,
      safeReturn: null,
      stepDownSuccess: null,
      renewedCwopEpisodes: null,
      evidenceRefs: [
        "SYNTH-S7-BASELINE-CWOP-001",
        "SYNTH-S7-BASELINE-HOSPITAL-001",
        "SYNTH-S7-BASELINE-PLACEMENT-SEARCH-001",
      ],
    },
    {
      phase: "DURING_ADOLBI",
      cwopEpisodes: null,
      placementBreakdowns: null,
      hospitalOrEdEpisodes: 1,
      lawEnforcementOrTransportEvents: 0,
      placementSearches: 0,
      dailyRate: highAcuity.rateControl.proposedDailyRate,
      supervisionLevel: highAcuity.acuityProfile.supervision,
      staffingAndSupports: [...placement.placementContinuity.supportChanges],
      crisisEvents: 2,
      stabilityDays: 21,
      hospitalReturns: placement.placementContinuity.safeReturn ? 1 : 0,
      placementMaintained: placement.placementContinuity.underlyingPlacementStatus === "ACTIVE",
      safeReturn: placement.placementContinuity.safeReturn,
      stepDownSuccess: null,
      renewedCwopEpisodes: null,
      evidenceRefs: [
        ...placement.placementContinuity.steps.flatMap((step) => step.evidenceRefs),
        ...highAcuity.acuityProfile.evidenceRefs,
      ],
    },
    {
      phase: "OUTCOME",
      cwopEpisodes: null,
      placementBreakdowns: 0,
      hospitalOrEdEpisodes: 0,
      lawEnforcementOrTransportEvents: 0,
      placementSearches: 0,
      dailyRate: null,
      supervisionLevel: null,
      staffingAndSupports: [],
      crisisEvents: 0,
      stabilityDays: 30,
      hospitalReturns: null,
      placementMaintained: true,
      safeReturn: true,
      stepDownSuccess: true,
      renewedCwopEpisodes: 0,
      evidenceRefs: [
        "SYNTH-S7-OUTCOME-STABILITY-001",
        "SYNTH-S7-OUTCOME-STEPDOWN-001",
        "SYNTH-S7-OUTCOME-CONTINUITY-001",
      ],
    },
  ];
}

function valueSources(
  scenario: CypressS7PreviewScenario,
): readonly CypressS7ValueEvidenceSource[] {
  if (scenario === "validated_value_case") {
    return [
      {
        sourceId: "SYNTH-S7-PARTNER-COST-001",
        sourceType: "PARTNER_COST_DATA",
        validated: true,
        baselineCost: 52_000,
        continuumCost: 45_500,
        evidenceRefs: [
          "SYNTH-S7-PARTNER-COST-BASELINE-001",
          "SYNTH-S7-CONTINUUM-COST-001",
        ],
      },
      {
        sourceId: "SYNTH-S7-UTILIZATION-001",
        sourceType: "UTILIZATION_HISTORY",
        validated: true,
        baselineCost: null,
        continuumCost: null,
        evidenceRefs: ["SYNTH-S7-UTILIZATION-HISTORY-001"],
      },
    ];
  }

  if (scenario === "unsupported_savings_claim_blocked") {
    return [
      {
        sourceId: "SYNTH-S7-UNVALIDATED-COST-001",
        sourceType: "DOCUMENTED_ALTERNATIVE_USE",
        validated: false,
        baselineCost: 61_000,
        continuumCost: 44_000,
        evidenceRefs: [],
      },
    ];
  }

  return [];
}

function valueMeasurement(
  scenario: CypressS7PreviewScenario,
  sources: readonly CypressS7ValueEvidenceSource[],
): CypressS7ValueMeasurement {
  const dollarClaimRequested =
    scenario === "validated_value_case" ||
    scenario === "unsupported_savings_claim_blocked";
  const costSource = sources.find(
    (source) =>
      source.validated &&
      source.baselineCost !== null &&
      source.continuumCost !== null &&
      source.evidenceRefs.length > 0,
  );
  const sourceSupported = Boolean(costSource);
  const dollarClaimAllowed = dollarClaimRequested && sourceSupported;
  const estimatedAvoidedCost =
    dollarClaimAllowed && costSource
      ? costSource.baselineCost! - costSource.continuumCost!
      : null;

  return {
    strategicHypothesis: STRATEGIC_HYPOTHESIS,
    dollarClaimRequested,
    dollarClaimAllowed,
    estimatedAvoidedCost,
    sourceSupported,
    sourceRefs: costSource?.evidenceRefs ?? [],
    payerGuarantee: false,
    unilateralBillingAllowed: false,
    reason: dollarClaimAllowed
      ? "Synthetic validated partner-cost evidence supports a bounded avoided-cost comparison for negotiation-case demonstration only."
      : dollarClaimRequested
        ? "A dollar-savings claim was requested without validated partner/claims/utilization cost evidence, so AMOS-OPS withholds the amount."
        : "AMOS-OPS may report utilization and outcome trends now, but dollar savings remain hypothesis-only until credible cost evidence is validated.",
  };
}

function executiveDecisionCase(
  scenario: CypressS7PreviewScenario,
): CypressS7ExecutiveDecisionCase {
  if (scenario === "executive_trend_referral_declines") {
    const decline = buildCypressS5Preview("target_population_decline_review");
    return {
      created: true,
      caseId: "SYNTH-S7-EXEC-DECLINES-001",
      trigger: "REPEATED_TARGET_POPULATION_DECLINES",
      reservedAuthority: "GOVERNING_BODY_OR_OWNERSHIP",
      observation:
        "Three target-population decline events repeat the same convenience/low-acuity pattern and require doctrine review rather than narrative alerting.",
      evidenceRefs: [
        ...decline.acuityProfile.evidenceRefs,
        ...decline.audit.map((event) => event.eventId),
        "SYNTH-S7-DECLINE-TREND-001",
      ],
      decisionQuestion:
        "Does the repeated decline pattern reflect an operational capability gap requiring investment/support, or an unauthorized drift from the approved high-acuity target-population doctrine?",
      unsupportedNarrativeAlert: false,
    };
  }

  if (scenario === "executive_trend_low_census") {
    return {
      created: true,
      caseId: "SYNTH-S7-EXEC-CENSUS-001",
      trigger: "LOW_CENSUS",
      reservedAuthority: "GOVERNING_BODY_OR_OWNERSHIP",
      observation:
        "Verified census remained at 4 of 10 licensed beds across the controlled observation set, below the approved operating ramp expectation.",
      evidenceRefs: [
        "SYNTH-S7-CENSUS-SNAPSHOT-001",
        "SYNTH-S7-CENSUS-SNAPSHOT-002",
        "SYNTH-S7-CENSUS-SNAPSHOT-003",
      ],
      decisionQuestion:
        "What referral, contracting, staffing, or market-execution action should ownership authorize to correct sustained underutilization without changing the licensed 10-bed control?",
      unsupportedNarrativeAlert: false,
    };
  }

  if (scenario === "executive_trend_rate_drift") {
    const rate = buildCypressS5Preview("below_floor_rate_blocked");
    return {
      created: true,
      caseId: "SYNTH-S7-EXEC-RATE-001",
      trigger: "RATE_DRIFT",
      reservedAuthority: "GOVERNING_BODY_OR_OWNERSHIP",
      observation:
        "A below-floor rate proposal recurred within the synthetic observation set while high-acuity resource requirements remained evidenced.",
      evidenceRefs: [
        ...rate.rateControl.rateEvidence,
        ...rate.audit.map((event) => event.eventId),
        "SYNTH-S7-RATE-TREND-001",
      ],
      decisionQuestion:
        "Should ownership reject, renegotiate, or expressly revise the material rate posture while preserving the approved service model and documented resource burden?",
      unsupportedNarrativeAlert: false,
    };
  }

  return {
    created: false,
    caseId: null,
    trigger: null,
    reservedAuthority: "GOVERNING_BODY_OR_OWNERSHIP",
    observation: "No executive trend threshold is asserted in this scenario.",
    evidenceRefs: [],
    decisionQuestion: null,
    unsupportedNarrativeAlert: false,
  };
}

function negotiationCase(
  measurement: CypressS7ValueMeasurement,
): CypressS7NegotiationCase {
  const ready = measurement.dollarClaimAllowed && measurement.sourceSupported;
  return {
    ready,
    aggregateOnly: true,
    requiredEvidence: [
      "verified outcomes",
      "resource requirements",
      "validated utilization/cost comparison",
      "defined performance measures",
      "agreed rate mechanism",
    ],
    performanceMeasures: [
      "placement maintained",
      "crisis/hospital utilization",
      "safe return after hospitalization",
      "step-down/discharge stability",
      "renewed CWOP or placement-search activity",
    ],
    reservedAuthority: "GOVERNING_BODY_OR_OWNERSHIP",
    nextDecision: ready
      ? "Ownership may use the aggregate verified evidence to negotiate a strategic CWOP continuum arrangement and sustainable rate methodology."
      : "Continue evidence collection; do not present a dollar-savings negotiation case until validated cost/utilization evidence is available.",
  };
}

function exceptions(
  scenario: CypressS7PreviewScenario,
  measurement: CypressS7ValueMeasurement,
  decisionCase: CypressS7ExecutiveDecisionCase,
): readonly CypressS7Exception[] {
  const rows: CypressS7Exception[] = [];
  if (scenario === "unsupported_savings_claim_blocked") {
    rows.push({
      code: "CWOP_DOLLAR_CLAIM_UNSUPPORTED",
      severity: "EVIDENCE",
      disposition: "BLOCK",
      summary:
        "Avoided-cost dollars cannot be reported because the supplied cost source is not validated and has no supporting evidence references.",
    });
  }
  if (measurement.dollarClaimRequested && !measurement.sourceSupported) {
    rows.push({
      code: "CWOP_VALUE_SOURCE_NOT_VALIDATED",
      severity: "CONTROL",
      disposition: "BLOCK",
      summary:
        "The strategic hypothesis may be stated, but a savings estimate is withheld until credible partner, claims, encounter, utilization, or other validated cost evidence exists.",
    });
  }
  if (decisionCase.created) {
    rows.push({
      code: "EXECUTIVE_DECISION_CASE_REQUIRED",
      severity: "EXECUTIVE",
      disposition: "REVIEW",
      summary:
        "The verified trend crosses into a reserved business-model, capacity, rate, or CWOP-strategy decision and is routed to ownership instead of being resolved by the operating layer.",
    });
  }
  return rows;
}

function auditEvents(
  measurement: CypressS7ValueMeasurement,
  negotiation: CypressS7NegotiationCase,
  decisionCase: CypressS7ExecutiveDecisionCase,
): readonly CypressS7AuditEvent[] {
  return [
    {
      eventId: "SYNTH-S7-AUD-001",
      eventType: "CWOP_BASELINE_EVALUATED",
      status: "PASS",
      detail: "Pre-Adolbi CWOP, placement disruption, hospital/ED, transport/law-enforcement, and placement-search indicators were captured with synthetic evidence references.",
    },
    {
      eventId: "SYNTH-S7-AUD-002",
      eventType: "CWOP_RESOURCE_PROFILE_EVALUATED",
      status: "PASS",
      detail: "Accepted S5 acuity/rate controls and S6 support-modification evidence were reused for the resource profile.",
    },
    {
      eventId: "SYNTH-S7-AUD-003",
      eventType: "CWOP_AUTHORIZED_ECONOMICS_EVALUATED",
      status: "PASS",
      detail: "The $450/$550/$650 controls are treated as operating/negotiation controls, not payer guarantees or unilateral billing authority.",
    },
    {
      eventId: "SYNTH-S7-AUD-004",
      eventType: "CWOP_STABILIZATION_PERFORMANCE_EVALUATED",
      status: "PASS",
      detail: "Placement continuity, safe return, stability days, crisis episodes, and transition outcomes were evaluated.",
    },
    {
      eventId: "SYNTH-S7-AUD-005",
      eventType: "CWOP_VALUE_EVIDENCE_EVALUATED",
      status: measurement.dollarClaimRequested && !measurement.dollarClaimAllowed ? "BLOCKED" : "PASS",
      detail: measurement.reason,
    },
    {
      eventId: "SYNTH-S7-AUD-006",
      eventType: "CWOP_EXECUTIVE_TREND_EVALUATED",
      status: decisionCase.created ? "REVIEW_REQUIRED" : "PASS",
      detail: decisionCase.created
        ? `Evidence-backed executive decision case created for ${decisionCase.trigger}.`
        : "No reserved executive trend threshold was asserted.",
    },
    {
      eventId: "SYNTH-S7-AUD-007",
      eventType: "CWOP_NEGOTIATION_CASE_EVALUATED",
      status: negotiation.ready ? "PASS" : "BLOCKED",
      detail: negotiation.nextDecision,
    },
  ];
}

export function getCypressS7Status(): CypressS7Status {
  return {
    sprint: "Cypress Doctrine Sprint 01",
    stage: "S7",
    capability: "CWOP Continuum Intelligence",
    previewAvailable: true,
    previewEnvironment: "SYNTHETIC_PREVIEW",
    noPhi: true,
    s6Accepted: true,
    s8Authorized: false,
    productionPromotion: "NOT_AUTHORIZED",
    message:
      "S7 implements the accepted before/during/outcome CWOP continuum framework, source-gated avoided-cost evidence, and evidence-backed executive trend routing. Dollar savings are withheld unless validated cost/utilization evidence supports the comparison.",
  };
}

export function buildCypressS7Preview(
  scenario: CypressS7PreviewScenario,
): CypressS7PreviewResult {
  const continuum = continuumSnapshots();
  const sources = valueSources(scenario);
  const measurement = valueMeasurement(scenario, sources);
  const decisionCase = executiveDecisionCase(scenario);
  const negotiation = negotiationCase(measurement);
  const exceptionRows = exceptions(scenario, measurement, decisionCase);

  const outcome: CypressS7PreviewResult["outcome"] = decisionCase.created
    ? "EXECUTIVE_DECISION_CASE_CREATED"
    : scenario === "unsupported_savings_claim_blocked"
      ? "VALUE_CLAIM_BLOCKED"
      : negotiation.ready
        ? "VALUE_EVIDENCE_READY"
        : "CONTINUUM_TRACKING_ACTIVE";

  const title =
    outcome === "EXECUTIVE_DECISION_CASE_CREATED"
      ? "CWOP evidence routed to an executive decision case"
      : outcome === "VALUE_CLAIM_BLOCKED"
        ? "Unsupported CWOP savings claim blocked"
        : outcome === "VALUE_EVIDENCE_READY"
          ? "Validated CWOP value evidence ready for negotiation"
          : "CWOP continuum tracking active; dollar value remains evidence-gated";

  const summary =
    outcome === "EXECUTIVE_DECISION_CASE_CREATED"
      ? "Repeated operational signals are supported by evidence and routed to ownership as a decision question rather than emitted as an unsupported narrative alert."
      : outcome === "VALUE_CLAIM_BLOCKED"
        ? "The continuum outcome record remains usable, but AMOS-OPS refuses to manufacture avoided-cost dollars from an unvalidated source."
        : outcome === "VALUE_EVIDENCE_READY"
          ? "The synthetic demonstration includes validated partner-cost evidence, so a bounded avoided-cost comparison may support an aggregate negotiation case; it does not create payer authorization or unilateral billing authority."
          : "Before/during/outcome utilization and stability evidence is tracked now. The strategic value hypothesis is visible, while dollar savings remain withheld until credible validated source data is available.";

  const exactNextAction =
    decisionCase.created
      ? `Route ${decisionCase.caseId} and its evidence package to Governing Body/Ownership for the reserved decision; do not let the operating layer silently redefine the model.`
      : outcome === "VALUE_CLAIM_BLOCKED"
        ? "Obtain credible partner/claims/encounter/utilization cost evidence and validate it before reporting any avoided-cost dollar comparison."
        : outcome === "VALUE_EVIDENCE_READY"
          ? "Preserve the validated aggregate evidence package for an authorized CWOP continuum negotiation; do not convert it into unilateral billing or payer-guarantee language."
          : "Continue before/during/outcome evidence collection and report utilization/stability trends without attaching unsupported dollar savings.";

  return {
    sprint: "Cypress Doctrine Sprint 01",
    stage: "S7",
    environment: "SYNTHETIC_PREVIEW",
    noPhi: true,
    scenario,
    testCaseId: `S7-${scenario.replace(/_/g, "-").toUpperCase()}`,
    capabilityLevels: ["L11"],
    licensedCapacity: LICENSED_CAPACITY,
    futureCapacity: FUTURE_CAPACITY,
    rateFloor: RATE_FLOOR,
    rateTarget: RATE_TARGET,
    rateEnhanced: RATE_ENHANCED,
    continuum,
    valueSources: sources,
    valueMeasurement: measurement,
    negotiationCase: negotiation,
    executiveDecisionCase: decisionCase,
    outcome,
    exceptions: exceptionRows,
    audit: auditEvents(measurement, negotiation, decisionCase),
    executiveVisibility: [
      `Continuum evidence phases: ${continuum.map((row) => row.phase).join(" → ")}`,
      `Dollar claim: ${measurement.dollarClaimAllowed ? "SOURCE SUPPORTED" : "WITHHELD / NOT REQUESTED"}`,
      `Negotiation case: ${negotiation.ready ? "EVIDENCE READY" : "NOT READY"}`,
      `Executive decision case: ${decisionCase.created ? decisionCase.trigger : "NONE"}`,
      "S8 remains not authorized; production promotion remains not authorized.",
    ],
    title,
    summary,
    exactNextAction,
    s8Authorized: false,
    productionPromotion: "NOT_AUTHORIZED",
  };
}
