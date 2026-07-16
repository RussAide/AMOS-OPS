import {
  DX1_MILESTONE,
  DX1_SCENARIO_ID,
  createDx1PrototypeBoundary,
  type Dx1CriterionResult,
  type Dx1StreamResult,
} from "../contracts";
import {
  runDx1AgentAssistanceVerification,
  type Dx1AgentAssistanceResult,
} from "./agent-assistance";
import {
  runDx1DashboardReconciliation,
  type Dx1DashboardReconciliationResult,
} from "./dashboard-reconciliation";
import {
  runDx1DmsVerification,
  type Dx1DmsVerificationResult,
} from "./dms-verification";
import {
  runDx1MicrosoftBoundaryVerification,
  type Dx1MicrosoftBoundaryResult,
} from "./microsoft-boundary";
import {
  runDx1NilVerification,
  type Dx1NilVerificationResult,
} from "./relationship-nil";
import { assertDx1Intelligence, immutable } from "./support";

export const DX1_INTELLIGENCE_ASSERTIONS = immutable({
  "DX.1-03": [
    "DX1-DMS-EIGHT-ACTIONS",
    "DX1-DMS-GOVERNED-CREATE-CLASSIFY",
    "DX1-DMS-SEQUENTIAL-HUMAN-APPROVAL",
    "DX1-DMS-OPTIMISTIC-VERSION",
    "DX1-DMS-PERMISSION-TRIMMED-SEARCH",
    "DX1-DMS-PACKET-NO-ORPHANS",
    "DX1-DMS-MANIFEST-ONLY-EXPORT",
    "DX1-DMS-SYNTHETIC-ARCHIVE",
  ],
  "DX.1-04": [
    "DX1-AGENT-THIRTEEN-PERSONAS",
    "DX1-AGENT-ACTIVE-REGISTRY",
    "DX1-AGENT-FIVE-POINTS-OF-WORK",
    "DX1-AGENT-CITED-CONTEXT",
    "DX1-AGENT-HUMAN-GATE-PRESERVED",
    "DX1-AGENT-BYPASS-REFUSED",
  ],
  "DX.1-05": [
    "DX1-NIL-EIGHT-ENTITY-KINDS",
    "DX1-NIL-PERMISSION-TRIM-BEFORE-TRAVERSAL",
    "DX1-NIL-RELATIONSHIP-PATH",
    "DX1-NIL-GOVERNED-CITATION",
    "DX1-NIL-ZERO-EXTERNAL-SIDE-EFFECTS",
  ],
  "DX.1-06": [
    "DX1-DASHBOARD-FIVE-DOMAINS",
    "DX1-DASHBOARD-SHARED-SCENARIO",
    "DX1-DASHBOARD-SHARED-ENTITY-LINEAGE",
    "DX1-DASHBOARD-ACCEPTED-SOURCE-MILESTONES",
    "DX1-DASHBOARD-ZERO-DRIFT",
  ],
  "DX.1-07": [
    "DX1-MICROSOFT-THREE-CONTRACTS",
    "DX1-MICROSOFT-SUPPORT-ONLY-CAPABILITIES",
    "DX1-MICROSOFT-AMOS-DMS-AUTHORITY",
    "DX1-MICROSOFT-OWNERSHIP-TRANSFER-DENIED",
    "DX1-MICROSOFT-ZERO-LIVE-OPERATIONS",
  ],
} as const);

export interface Dx1IntelligencePlatformStreamResult extends Dx1StreamResult {
  readonly milestone: typeof DX1_MILESTONE;
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly dms: Readonly<Dx1DmsVerificationResult>;
  readonly agents: Readonly<Dx1AgentAssistanceResult>;
  readonly nil: Readonly<Dx1NilVerificationResult>;
  readonly dashboards: Readonly<Dx1DashboardReconciliationResult>;
  readonly microsoft: Readonly<Dx1MicrosoftBoundaryResult>;
  readonly reusedMilestones: readonly [
    "M3.1",
    "M3.2",
    "M3.3",
    "M4.1A",
    "M4.1B",
    "M4.2",
    "M5.1A",
    "M5.1B",
  ];
  readonly liveSideEffects: 0;
  readonly synthetic: true;
}

function criterion(
  criterionId: keyof typeof DX1_INTELLIGENCE_ASSERTIONS,
  evidenceIds: readonly string[],
  summary: string,
): Readonly<Dx1CriterionResult> {
  assertDx1Intelligence(
    evidenceIds.length > 0,
    `DX1_INTELLIGENCE_CRITERION_EVIDENCE_REQUIRED:${criterionId}`,
  );
  return immutable({
    criterionId,
    status: "Complete" as const,
    assertionIds: DX1_INTELLIGENCE_ASSERTIONS[criterionId],
    evidenceIds,
    summary,
  });
}

/**
 * Single deterministic root-integration entry point for DX.1 criteria 03-07.
 */
export function runDx1IntelligencePlatformStream(): Readonly<Dx1IntelligencePlatformStreamResult> {
  const dms = runDx1DmsVerification();
  const agents = runDx1AgentAssistanceVerification();
  const nil = runDx1NilVerification();
  const dashboards = runDx1DashboardReconciliation();
  const microsoft = runDx1MicrosoftBoundaryVerification();
  assertDx1Intelligence(
    dms.accepted &&
      agents.accepted &&
      nil.accepted &&
      dashboards.accepted &&
      microsoft.accepted,
    "DX1_INTELLIGENCE_COMPONENT_NOT_ACCEPTED",
  );
  const criteria: readonly Dx1CriterionResult[] = immutable([
    criterion(
      "DX.1-03",
      dms.actions.flatMap((candidate) => candidate.evidenceIds),
      "AMOS-DMS completes create, classify, approve, version, search, packetize, export, and archive through accepted M4.2 controls.",
    ),
    criterion(
      "DX.1-04",
      [
        ...agents.activePersonaKeys,
        ...agents.assistance.map((candidate) => candidate.response.responseId),
        "SYNTH-DX1-AGENT-BYPASS-PROBE",
      ],
      "The accepted persona registry routes five points of work to active bounded assistance and refuses gate bypass.",
    ),
    criterion(
      "DX.1-05",
      [
        nil.graph.graphId,
        nil.relationshipAnswer.queryId,
        ...nil.relationshipAnswer.paths.map((candidate) => candidate.pathId),
        ...nil.relationshipAnswer.citations.map(
          (candidate) => candidate.documentId,
        ),
      ],
      "NIL relates all eight required entity kinds through a permission-trimmed, cited relationship path.",
    ),
    criterion(
      "DX.1-06",
      dashboards.cards.flatMap((candidate) => [
        candidate.domain,
        candidate.sourceMilestone,
        ...candidate.sourceEvidenceIds.slice(0, 2),
      ]),
      "Five dashboard domains reconcile one shared synthetic scenario and accepted source lineage without drift.",
    ),
    criterion(
      "DX.1-07",
      [
        ...microsoft.supportDecisions.map((candidate) => candidate.decisionId),
        ...microsoft.ownershipDenialDecisions.map(
          (candidate) => candidate.decisionId,
        ),
      ],
      "Teams, Outlook, and SharePoint remain constrained support channels; AMOS retains enterprise logic and source authority.",
    ),
  ]);
  const auditEvents = immutable([
    ...dms.auditEvents,
    ...agents.auditEvents,
    ...nil.auditEvents,
    ...dashboards.auditEvents,
    ...microsoft.auditEvents,
  ]);
  assertDx1Intelligence(
    new Set(auditEvents.map((event) => event.eventId)).size ===
      auditEvents.length,
    "DX1_INTELLIGENCE_DUPLICATE_AUDIT_EVENT",
  );
  const assertionCount = Object.values(DX1_INTELLIGENCE_ASSERTIONS).reduce(
    (total, assertions) => total + assertions.length,
    0,
  );
  return immutable({
    milestone: DX1_MILESTONE,
    scenarioId: DX1_SCENARIO_ID,
    streamId: "intelligence-platform" as const,
    passed: criteria.every((candidate) => candidate.status === "Complete"),
    assertionCount,
    criteria,
    auditEvents,
    boundary: createDx1PrototypeBoundary(),
    dms,
    agents,
    nil,
    dashboards,
    microsoft,
    reusedMilestones: [
      "M3.1",
      "M3.2",
      "M3.3",
      "M4.1A",
      "M4.1B",
      "M4.2",
      "M5.1A",
      "M5.1B",
    ] as const,
    liveSideEffects: 0 as const,
    synthetic: true as const,
  });
}
