import { describe, expect, it } from "vitest";
import { M34_CRITERIA } from "../../contracts/phase3/m34";
import {
  isM34WorkOrderLifecycleValid,
  runM34SyntheticSuite,
} from "../services/m34";
import { ROLE_TIER_BY_ROLE } from "@/constants/access-control";
import { ALL_ROLES, type UserRole } from "@/constants/roles";

describe("M3.4 deterministic GAD acceptance suite", () => {
  it("passes every exact criterion with linked synthetic audit evidence", () => {
    const result = runM34SyntheticSuite();

    expect(result).toMatchObject({
      milestone: "M3.4",
      domain: "GAD",
      evidenceClass: "synthetic_demo",
      passed: true,
    });
    expect(result.criteria.map((criterion) => criterion.criterionId)).toEqual(
      M34_CRITERIA,
    );
    expect(result.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(
      result.auditEvents.every(
        (event) =>
          event.id.startsWith("SYNTH-") &&
          event.evidenceClass === "synthetic_demo" &&
          event.domain === "GAD" &&
          event.correlationId === "SYNTH-M34-CORRELATION-001",
      ),
    ).toBe(true);

    for (const criterion of result.criteria) {
      const auditEventIds = criterion.evidence
        .auditEventIds as readonly string[];
      expect(auditEventIds.length).toBeGreaterThan(0);
      expect(
        auditEventIds.every((id) =>
          result.auditEvents.some((event) => event.id === id),
        ),
      ).toBe(true);
    }
  });

  it("preserves all three canonical campus identities and readiness distinctions", () => {
    const { snapshot } = runM34SyntheticSuite();

    expect(snapshot.campusStages).toEqual([
      expect.objectContaining({
        canonicalStageId: "campus-stage-1",
        stageNumber: 1,
        name: "Stage 1 — Main Residential Unit",
        facilityId: "fac-001",
        status: "operational",
      }),
      expect.objectContaining({
        canonicalStageId: "campus-stage-2",
        stageNumber: 2,
        name: "Stage 2 — Emergency Care Services",
        facilityId: "fac-003",
        status: "licensing_in_progress",
      }),
      expect.objectContaining({
        canonicalStageId: "campus-stage-3",
        stageNumber: 3,
        name: "Stage 3 — Cypress Campus",
        facilityId: "fac-004",
        status: "capital_planning",
      }),
    ]);
    expect(
      snapshot.campusStages.every(
        (stage) =>
          snapshot.sites.some((site) => site.stageId === stage.id) &&
          snapshot.spaces.some((space) => space.stageId === stage.id) &&
          snapshot.assets.some((asset) => asset.stageId === stage.id) &&
          snapshot.workOrders.some(
            (workOrder) => workOrder.stageId === stage.id,
          ),
      ),
    ).toBe(true);
  });

  it("runs full work-order lifecycles with labor, material, inspection, verification, and reopen", () => {
    const { snapshot } = runM34SyntheticSuite();

    expect(
      snapshot.workOrders.map((workOrder) => workOrder.requestType),
    ).toEqual(["corrective", "preventive", "inspection"]);
    for (const workOrder of snapshot.workOrders) {
      const events = snapshot.workOrderEvents.filter(
        (event) => event.workOrderId === workOrder.id,
      );
      expect(isM34WorkOrderLifecycleValid(events)).toBe(true);
      expect(events[events.length - 1]?.toState).toBe("verified");
      expect(
        snapshot.laborEntries.some((entry) =>
          workOrder.laborEntryIds.includes(entry.id),
        ),
      ).toBe(true);
      expect(
        snapshot.materialEntries.some((entry) =>
          workOrder.materialEntryIds.includes(entry.id),
        ),
      ).toBe(true);
      expect(workOrder.inspectionEvidenceId).toMatch(/^SYNTH-/);
      expect(workOrder.verificationEvidenceId).toMatch(/^SYNTH-/);
    }
    expect(
      snapshot.workOrders.find((workOrder) => workOrder.id === "SYNTH-M34-WO-1")
        ?.reopenedCount,
    ).toBe(1);
    expect(
      snapshot.workOrderEvents
        .filter((event) => event.workOrderId === "SYNTH-M34-WO-1")
        .map((event) => event.toState),
    ).toEqual([
      "requested",
      "triaged",
      "assigned",
      "in_progress",
      "awaiting_inspection",
      "completed",
      "verified",
      "reopened",
      "in_progress",
      "awaiting_inspection",
      "completed",
      "verified",
    ]);
  });

  it("controls preventive maintenance, recurring inspection, vendor qualification, warranty, and history", () => {
    const { snapshot } = runM34SyntheticSuite();

    expect(snapshot.preventiveMaintenancePlans).toEqual([
      expect.objectContaining({
        frequency: "monthly",
        qualifiedVendorId: "SYNTH-M34-VENDOR-01",
        warrantyVerified: true,
        generatedWorkOrderId: "SYNTH-M34-WO-2",
        recurringInspectionId: "SYNTH-M34-RECURRING-INSPECTION-01",
      }),
    ]);
    expect(snapshot.assetHistory.map((event) => event.type)).toEqual([
      "commissioned",
      "warranty_verified",
      "vendor_service",
      "inspection",
    ]);
    expect(
      snapshot.vendors.every(
        (vendor) =>
          vendor.qualificationStatus === "qualified" &&
          vendor.evidenceIds.length > 0,
      ),
    ).toBe(true);
  });

  it("completes matched and exception purchase-order-to-payment cycles with segregation of duties", () => {
    const { snapshot } = runM34SyntheticSuite();

    expect(
      snapshot.procurementCycles.map((cycle) => cycle.matchOutcome),
    ).toEqual(["matched", "exception_resolved"]);
    for (const cycle of snapshot.procurementCycles) {
      const events = snapshot.procurementEvents.filter(
        (event) => event.procurementId === cycle.id,
      );
      expect(events[0].state).toBe("requisitioned");
      expect(events[events.length - 1]?.state).toBe("payment_handoff");
      expect(cycle.segregationOfDutiesPassed).toBe(true);
      expect(
        new Set(events.slice(0, 5).map((event) => event.actorId)).size,
      ).toBe(5);
      expect(cycle.purchaseOrderId).toMatch(/^SYNTH-/);
      expect(cycle.receiptId).toMatch(/^SYNTH-/);
      expect(cycle.invoiceId).toMatch(/^SYNTH-/);
      expect(cycle.paymentHandoffId).toMatch(/^SYNTH-/);
    }
    expect(
      snapshot.procurementEvents
        .filter(
          (event) => event.procurementId === "SYNTH-M34-PROCUREMENT-EXCEPTION",
        )
        .map((event) => event.state),
    ).toEqual([
      "requisitioned",
      "approved",
      "purchase_order_issued",
      "received",
      "invoice_received",
      "exception_opened",
      "exception_resolved",
      "payment_handoff",
    ]);
  });

  it("uses canonical T1 through T4 roles for human operations actors", () => {
    const { snapshot, auditEvents } = runM34SyntheticSuite();
    const canonical = new Set(ALL_ROLES);
    const humanRoles = [
      ...snapshot.workOrderEvents.map((event) => event.actorRole),
      ...snapshot.procurementEvents.map((event) => event.actorRole),
      ...snapshot.inventoryItems.map((item) => item.custodianRole),
      ...auditEvents
        .filter((event) => event.actorRole !== "system")
        .map((event) => event.actorRole),
    ];

    expect(humanRoles.every((role) => canonical.has(role as UserRole))).toBe(
      true,
    );
    expect(
      new Set(
        snapshot.procurementEvents.map(
          (event) => ROLE_TIER_BY_ROLE[event.actorRole],
        ),
      ),
    ).toEqual(new Set(["T1", "T2", "T3", "T4"]));
  });

  it("controls inventory, drills, emergency equipment, transportation, and incidents", () => {
    const { snapshot } = runM34SyntheticSuite();

    expect(snapshot.inventoryItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlled: true,
          belowThreshold: true,
          reorderThreshold: 5,
          quantityOnHand: 4,
        }),
      ]),
    );
    expect(
      snapshot.inventoryTransactions.map((transaction) => transaction.type),
    ).toEqual(["issue", "return", "cycle_count", "variance_adjustment"]);
    expect(snapshot.safetyDrills).toHaveLength(3);
    expect(
      snapshot.safetyDrills.every(
        (drill) =>
          drill.correctiveActionStatus === "verified_closed" &&
          drill.evidenceRetentionYears === 7 &&
          drill.evidenceIds.length >= 2,
      ),
    ).toBe(true);
    expect(
      snapshot.emergencyEquipment.every(
        (equipment) => equipment.status === "ready",
      ),
    ).toBe(true);
    expect(snapshot.drivers).toEqual([
      expect.objectContaining({
        approved: true,
        backgroundStatus: "current",
        trainingStatus: "current",
      }),
    ]);
    expect(snapshot.vehicles).toEqual([
      expect.objectContaining({ maintenanceStatus: "current" }),
    ]);
    expect(
      snapshot.transportTrips.every((trip) => trip.status === "completed"),
    ).toBe(true);
    expect(snapshot.transportIncidents).toEqual([
      expect.objectContaining({ status: "closed" }),
    ]);
  });

  it("exceeds 99 percent uptime using only declared qualifying source events", () => {
    const { snapshot } = runM34SyntheticSuite();

    expect(snapshot.uptime).toEqual({
      baselineId: "SYNTH-M34-UPTIME-BASELINE-JULY",
      scopeStageId: "SYNTH-M34-STAGE-1",
      baselineStartAt: "2026-07-01T00:00:00.000Z",
      baselineEndAt: "2026-07-31T00:00:00.000Z",
      baselineMinutes: 43_200,
      scheduledMinutes: 43_020,
      plannedExcludedMinutes: 180,
      qualifyingDowntimeMinutes: 240,
      availableMinutes: 42_780,
      uptimePercent: 99.4421,
      targetPercent: 99,
      passed: true,
      formula:
        "((scheduled_service_minutes - qualifying_unplanned_downtime_minutes) / scheduled_service_minutes) * 100",
      scheduleWindowIds: [
        "SYNTH-M34-SCHEDULE-JULY-A",
        "SYNTH-M34-SCHEDULE-JULY-B",
      ],
      sourceEventIds: [
        "SYNTH-M34-OUTAGE-01",
        "SYNTH-M34-OUTAGE-02",
        "SYNTH-M34-OUTAGE-03",
      ],
      excludedEventIds: ["SYNTH-M34-OUTAGE-EXCLUDED"],
    });
    expect(snapshot.uptimeBaseline.scheduleWindows).toHaveLength(2);
    expect(snapshot.uptimeBaseline.stageId).toBe("SYNTH-M34-STAGE-1");
    expect(
      snapshot.outageEvents
        .filter((event) => snapshot.uptime.sourceEventIds.includes(event.id))
        .every((event) => event.stageId === snapshot.uptime.scopeStageId),
    ).toBe(true);
    expect(
      snapshot.outageEvents.every(
        (event) =>
          event.durationMinutes ===
          (new Date(event.endedAt).getTime() -
            new Date(event.startedAt).getTime()) /
            60_000,
      ),
    ).toBe(true);
  });
});
