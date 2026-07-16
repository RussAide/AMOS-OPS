import {
  DX1_CRITERION_IDS,
  DX1_EVALUATED_AT,
  DX1_MILESTONE,
  DX1_SCENARIO_ID,
  createDx1PrototypeBoundary,
  type Dx1AuditEvent,
  type Dx1CriterionId,
  type Dx1CriterionResult,
  type Dx1PrototypeBoundary,
  type Dx1StreamResult,
} from "./contracts";
import { runDx1ExperienceGovernanceStream } from "./experience";
import { runDx1IntelligencePlatformStream } from "./intelligence";
import { runDx1SecurityPilotStream } from "./pilot";

const EXPECTED_STREAM_CRITERIA: Readonly<
  Record<Dx1StreamResult["streamId"], readonly Dx1CriterionId[]>
> = Object.freeze({
  "experience-governance": Object.freeze([
    "DX.1-01",
    "DX.1-02",
    "DX.1-09",
    "DX.1-11",
    "DX.1-12",
  ] as const),
  "intelligence-platform": Object.freeze([
    "DX.1-03",
    "DX.1-04",
    "DX.1-05",
    "DX.1-06",
    "DX.1-07",
  ] as const),
  "security-pilot": Object.freeze(["DX.1-08", "DX.1-10"] as const),
});

function assertDx1(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sameIds(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

function assertZeroLiveBoundary(boundary: Readonly<Dx1PrototypeBoundary>): void {
  assertDx1(boundary.synthetic, "DX1_SYNTHETIC_BOUNDARY_REQUIRED");
  assertDx1(boundary.demoMode, "DX1_DEMO_MODE_REQUIRED");
  for (const [key, value] of Object.entries(boundary)) {
    if (key === "synthetic" || key === "demoMode") continue;
    assertDx1(value === 0, `DX1_ZERO_LIVE_BOUNDARY_VIOLATION:${key}`);
  }
}

export interface Dx1IntegratedScenarioInput {
  readonly experience: Readonly<Dx1StreamResult>;
  readonly intelligence: Readonly<Dx1StreamResult>;
  readonly pilot: Readonly<Dx1StreamResult>;
}

export interface Dx1IntegratedScenarioResult {
  readonly schemaVersion: "1.0";
  readonly milestone: typeof DX1_MILESTONE;
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly evaluatedAt: typeof DX1_EVALUATED_AT;
  readonly acceptance: "ACCEPTED" | "NOT_ACCEPTED";
  readonly accepted: boolean;
  readonly passed: boolean;
  readonly assertionCount: number;
  readonly integrationAssertionCount: 8;
  readonly criteria: readonly Dx1CriterionResult[];
  readonly streams: Readonly<Dx1IntegratedScenarioInput>;
  readonly auditEvents: readonly Dx1AuditEvent[];
  readonly boundary: Readonly<Dx1PrototypeBoundary>;
}

/**
 * Combines the three disjoint verification streams and rejects incomplete,
 * duplicated, or live-system evidence before it can be called an enterprise
 * demonstration result.
 */
export function assembleDx1IntegratedScenario(
  input: Dx1IntegratedScenarioInput,
): Readonly<Dx1IntegratedScenarioResult> {
  const streams = [input.experience, input.intelligence, input.pilot] as const;
  assertDx1(
    sameIds(
      streams.map((stream) => stream.streamId),
      Object.keys(EXPECTED_STREAM_CRITERIA),
    ),
    "DX1_STREAM_INVENTORY_MISMATCH",
  );

  for (const stream of streams) {
    assertZeroLiveBoundary(stream.boundary);
    assertDx1(
      sameIds(
        stream.criteria.map((criterion) => criterion.criterionId),
        EXPECTED_STREAM_CRITERIA[stream.streamId],
      ),
      `DX1_STREAM_CRITERIA_MISMATCH:${stream.streamId}`,
    );
    assertDx1(stream.assertionCount > 0, `DX1_STREAM_ASSERTIONS_REQUIRED:${stream.streamId}`);
  }

  const criteria = streams
    .flatMap((stream) => [...stream.criteria])
    .sort((left, right) => left.criterionId.localeCompare(right.criterionId));
  assertDx1(
    sameIds(
      criteria.map((criterion) => criterion.criterionId),
      DX1_CRITERION_IDS,
    ),
    "DX1_CRITERION_INVENTORY_MISMATCH",
  );
  assertDx1(
    new Set(criteria.map((criterion) => criterion.criterionId)).size ===
      DX1_CRITERION_IDS.length,
    "DX1_DUPLICATE_CRITERION_RESULT",
  );

  const auditEvents = streams.flatMap((stream) => [...stream.auditEvents]);
  assertDx1(auditEvents.length > 0, "DX1_AUDIT_HISTORY_REQUIRED");
  assertDx1(
    new Set(auditEvents.map((event) => event.eventId)).size === auditEvents.length,
    "DX1_DUPLICATE_AUDIT_EVENT",
  );
  assertDx1(
    auditEvents.every(
      (event) => event.scenarioId === DX1_SCENARIO_ID && event.synthetic,
    ),
    "DX1_AUDIT_SCENARIO_BOUNDARY_MISMATCH",
  );

  const accepted =
    streams.every((stream) => stream.passed) &&
    criteria.every(
      (criterion) =>
        criterion.status === "Complete" &&
        criterion.assertionIds.length > 0 &&
        criterion.evidenceIds.length > 0,
    );
  const integrationAssertionCount = 8 as const;
  const result: Dx1IntegratedScenarioResult = {
    schemaVersion: "1.0",
    milestone: DX1_MILESTONE,
    scenarioId: DX1_SCENARIO_ID,
    evaluatedAt: DX1_EVALUATED_AT,
    acceptance: accepted ? "ACCEPTED" : "NOT_ACCEPTED",
    accepted,
    passed: accepted,
    assertionCount:
      streams.reduce((total, stream) => total + stream.assertionCount, 0) +
      integrationAssertionCount,
    integrationAssertionCount,
    criteria: Object.freeze(criteria),
    streams: Object.freeze({ ...input }),
    auditEvents: Object.freeze(auditEvents),
    boundary: createDx1PrototypeBoundary(),
  };
  return Object.freeze(result);
}

/** Executes the complete deterministic DX.1 synthetic enterprise evaluation. */
export function runDx1IntegratedScenario(): Readonly<Dx1IntegratedScenarioResult> {
  return assembleDx1IntegratedScenario({
    experience: runDx1ExperienceGovernanceStream(),
    intelligence: runDx1IntelligencePlatformStream(),
    pilot: runDx1SecurityPilotStream(),
  });
}
