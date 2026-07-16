import { describe, expect, it } from "vitest";
import {
  assertM34SyntheticWrite,
  type M34OutageEvent,
  type M34UptimeBaseline,
  type M34WorkOrderEvent,
} from "../../contracts/phase3/m34";
import {
  assertM34CanonicalHumanRole,
  calculateM34Uptime,
  isM34WorkOrderLifecycleValid,
  runM34SyntheticSuite,
} from "../services/m34";

const BASELINE_START = "2026-01-01T00:00:00.000Z";

function instantAtMinute(minute: number): string {
  return new Date(
    new Date(BASELINE_START).getTime() + minute * 60_000,
  ).toISOString();
}

function baseline(
  totalMinutes: number,
  scheduleWindows: readonly [number, number][] = [[0, totalMinutes]],
): M34UptimeBaseline {
  return {
    id: "SYNTH-M34-BOUNDARY-BASELINE",
    stageId: "SYNTH-M34-STAGE-1",
    baselineStartAt: BASELINE_START,
    baselineEndAt: instantAtMinute(totalMinutes),
    scheduleWindows: scheduleWindows.map(([start, end], index) => ({
      id: `SYNTH-M34-BOUNDARY-SCHEDULE-${index + 1}`,
      startedAt: instantAtMinute(start),
      endedAt: instantAtMinute(end),
      evidenceClass: "synthetic_demo",
    })),
    evidenceClass: "synthetic_demo",
  };
}

function outage(
  durationMinutes: number,
  classification: M34OutageEvent["classification"] = "unplanned",
  startMinute = 0,
): M34OutageEvent {
  return {
    id: `SYNTH-M34-BOUNDARY-OUTAGE-${durationMinutes}-${classification}`,
    stageId: "SYNTH-M34-STAGE-1",
    sourceSystem: "synthetic_facility_monitor",
    classification,
    startedAt: instantAtMinute(startMinute),
    endedAt: instantAtMinute(startMinute + durationMinutes),
    durationMinutes,
    impactsAvailability: classification === "unplanned",
    evidenceClass: "synthetic_demo",
  };
}

describe("M3.4 deterministic and production-write boundaries", () => {
  it("is byte-for-byte deterministic across fresh runs", () => {
    expect(runM34SyntheticSuite()).toEqual(runM34SyntheticSuite());
  });

  it("blocks every production-class or non-synthetic write", () => {
    expect(() =>
      assertM34SyntheticWrite({
        id: "SYNTH-M34-LIVE-ATTEMPT",
        evidenceClass: "production",
      }),
    ).toThrowError("M34_PRODUCTION_WRITE_BLOCKED");
    expect(() =>
      assertM34SyntheticWrite({
        id: "WORK-ORDER-001",
        evidenceClass: "synthetic_demo",
      }),
    ).toThrowError("M34_NON_SYNTHETIC_ID_BLOCKED");
    expect(() =>
      assertM34SyntheticWrite({
        id: "SYNTH-M34-ALLOWED",
        evidenceClass: "synthetic_demo",
      }),
    ).not.toThrow();

    expect(runM34SyntheticSuite().snapshot.writeBoundary).toMatchObject({
      mode: "evaluation_only",
      productionWritesBlocked: true,
      liveConnectorMutationsBlocked: true,
      allowedEvidenceClass: "synthetic_demo",
    });
  });

  it("rejects noncanonical human role labels", () => {
    expect(() =>
      assertM34CanonicalHumanRole("facilities-manager"),
    ).not.toThrow();
    expect(() =>
      assertM34CanonicalHumanRole("facilities-technician"),
    ).toThrowError("M34_NONCANONICAL_ROLE:facilities-technician");
  });

  it("fails closed on skipped, disconnected, or incomplete work-order transitions", () => {
    const { snapshot } = runM34SyntheticSuite();
    const valid = snapshot.workOrderEvents.filter(
      (event) => event.workOrderId === "SYNTH-M34-WO-2",
    );
    const skippedTriage: M34WorkOrderEvent[] = [valid[0], ...valid.slice(2)];
    const disconnected: M34WorkOrderEvent[] = valid.map((event, index) =>
      index === 1 ? { ...event, fromState: "assigned" } : event,
    );

    expect(isM34WorkOrderLifecycleValid(valid)).toBe(true);
    expect(isM34WorkOrderLifecycleValid(valid.slice(1))).toBe(false);
    expect(isM34WorkOrderLifecycleValid(valid.slice(0, -1))).toBe(false);
    expect(isM34WorkOrderLifecycleValid(skippedTriage)).toBe(false);
    expect(isM34WorkOrderLifecycleValid(disconnected)).toBe(false);
  });

  it("uses a strict greater-than-99 uptime threshold", () => {
    expect(calculateM34Uptime(baseline(10_000), [outage(101)])).toMatchObject({
      uptimePercent: 98.99,
      passed: false,
    });
    expect(calculateM34Uptime(baseline(10_000), [outage(100)])).toMatchObject({
      uptimePercent: 99,
      passed: false,
    });
    expect(calculateM34Uptime(baseline(10_000), [outage(99)])).toMatchObject({
      uptimePercent: 99.01,
      passed: true,
    });
  });

  it("excludes planned out-of-schedule time from numerator and denominator", () => {
    const result = calculateM34Uptime(baseline(10_000, [[500, 10_000]]), [
      outage(500, "planned_excluded"),
    ]);

    expect(result).toMatchObject({
      baselineMinutes: 10_000,
      scheduledMinutes: 9_500,
      plannedExcludedMinutes: 500,
      qualifyingDowntimeMinutes: 0,
      availableMinutes: 9_500,
      uptimePercent: 100,
      passed: true,
      excludedEventIds: ["SYNTH-M34-BOUNDARY-OUTAGE-500-planned_excluded"],
    });
    expect(calculateM34Uptime(baseline(10_000), [outage(500)])).toMatchObject({
      scheduledMinutes: 10_000,
      qualifyingDowntimeMinutes: 500,
      availableMinutes: 9_500,
      uptimePercent: 95,
      passed: false,
    });
  });

  it("rejects overlapping outage rows and excludes out-of-scope stages", () => {
    expect(() =>
      calculateM34Uptime(baseline(1_000), [
        outage(60, "unplanned", 0),
        { ...outage(60, "unplanned", 30), id: "SYNTH-M34-OVERLAP-02" },
      ]),
    ).toThrowError("M34_OVERLAPPING_OUTAGE_EVENTS");

    expect(() =>
      calculateM34Uptime(baseline(1_000, [[100, 1_000]]), [
        outage(60, "planned_excluded", 0),
        {
          ...outage(60, "planned_excluded", 40),
          id: "SYNTH-M34-PLANNED-OVERLAP-02",
        },
      ]),
    ).toThrowError("M34_OVERLAPPING_OUTAGE_EVENTS");

    expect(
      calculateM34Uptime(baseline(1_000), [
        {
          ...outage(60),
          id: "SYNTH-M34-OUT-OF-SCOPE",
          stageId: "SYNTH-M34-STAGE-2",
        },
      ]),
    ).toMatchObject({
      scopeStageId: "SYNTH-M34-STAGE-1",
      qualifyingDowntimeMinutes: 0,
      uptimePercent: 100,
      sourceEventIds: [],
      excludedEventIds: ["SYNTH-M34-OUT-OF-SCOPE"],
    });
  });

  it("rejects invalid baselines, schedule spans, and event spans", () => {
    expect(() =>
      calculateM34Uptime(
        {
          ...baseline(100),
          baselineEndAt: BASELINE_START,
        },
        [],
      ),
    ).toThrowError("M34_INVALID_BASELINE");
    expect(() =>
      calculateM34Uptime(
        baseline(100, [
          [0, 60],
          [50, 100],
        ]),
        [],
      ),
    ).toThrowError("M34_OVERLAPPING_SCHEDULE_WINDOWS");
    expect(() =>
      calculateM34Uptime(baseline(100), [
        { ...outage(10), endedAt: BASELINE_START },
      ]),
    ).toThrowError("M34_INVALID_EVENT_SPAN");
    expect(() =>
      calculateM34Uptime(baseline(100), [
        { ...outage(10), durationMinutes: 9 },
      ]),
    ).toThrowError("M34_EVENT_DURATION_MISMATCH");
    expect(() =>
      calculateM34Uptime(baseline(100), [outage(10, "planned_excluded")]),
    ).toThrowError("M34_PLANNED_OUTAGE_INSIDE_SCHEDULE");
  });
});
