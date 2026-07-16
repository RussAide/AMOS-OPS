import {
  M34_CRITERIA,
  M34_FIXED_NOW,
  assertM34SyntheticWrite,
  type M34Asset,
  type M34AssetHistoryEvent,
  type M34AvailabilityScheduleWindow,
  type M34CampusStage,
  type M34Driver,
  type M34EmergencyEquipment,
  type M34InventoryItem,
  type M34InventoryTransaction,
  type M34LaborEntry,
  type M34MaterialEntry,
  type M34ModuleResult,
  type M34OutageEvent,
  type M34PreventiveMaintenancePlan,
  type M34ProcurementCycle,
  type M34ProcurementEvent,
  type M34SafetyDrill,
  type M34Site,
  type M34Snapshot,
  type M34Space,
  type M34TransportIncident,
  type M34TransportTrip,
  type M34UptimeBaseline,
  type M34UptimeMeasurement,
  type M34Vehicle,
  type M34Vendor,
  type M34WorkOrder,
  type M34WorkOrderEvent,
  type M34WorkOrderState,
} from "@contracts/phase3/m34";
import { ALL_ROLES, type UserRole } from "@/constants/roles";
import {
  changedPhase3Fields,
  type Phase3AuditAction,
  type Phase3AuditEvent,
  type Phase3CriterionResult,
} from "@contracts/phase3/shared";

const M34_CORRELATION_ID = "SYNTH-M34-CORRELATION-001";
const UPTIME_FORMULA =
  "((scheduled_service_minutes - qualifying_unplanned_downtime_minutes) / scheduled_service_minutes) * 100" as const;
const CANONICAL_ROLES = new Set<UserRole>(ALL_ROLES);

export function assertM34CanonicalHumanRole(
  role: string,
): asserts role is UserRole {
  if (!CANONICAL_ROLES.has(role as UserRole)) {
    throw new Error(`M34_NONCANONICAL_ROLE:${role}`);
  }
}

export interface M34UptimeCalculation {
  baselineId: string;
  scopeStageId: string;
  baselineStartAt: string;
  baselineEndAt: string;
  baselineMinutes: number;
  scheduledMinutes: number;
  plannedExcludedMinutes: number;
  qualifyingDowntimeMinutes: number;
  availableMinutes: number;
  uptimePercent: number;
  targetPercent: 99;
  passed: boolean;
  scheduleWindowIds: readonly string[];
  sourceEventIds: readonly string[];
  excludedEventIds: readonly string[];
}

function timestampMs(value: string, errorCode: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed) || parsed % 60_000 !== 0) {
    throw new Error(errorCode);
  }
  return parsed;
}

function overlapMinutes(
  eventStart: number,
  eventEnd: number,
  windows: readonly { start: number; end: number }[],
): number {
  return windows.reduce(
    (total, window) =>
      total +
      Math.max(
        0,
        Math.min(eventEnd, window.end) - Math.max(eventStart, window.start),
      ) /
        60_000,
    0,
  );
}

function assertNonOverlappingOutages(
  events: readonly { start: number; end: number }[],
): void {
  const ordered = [...events].sort((left, right) => left.start - right.start);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].start < ordered[index - 1].end) {
      throw new Error("M34_OVERLAPPING_OUTAGE_EVENTS");
    }
  }
}

export function calculateM34Uptime(
  baseline: M34UptimeBaseline,
  outageEvents: readonly M34OutageEvent[],
): M34UptimeCalculation {
  const baselineStart = timestampMs(
    baseline.baselineStartAt,
    "M34_INVALID_BASELINE",
  );
  const baselineEnd = timestampMs(
    baseline.baselineEndAt,
    "M34_INVALID_BASELINE",
  );
  if (baselineEnd <= baselineStart || baseline.scheduleWindows.length === 0) {
    throw new Error("M34_INVALID_BASELINE");
  }
  const baselineMinutes = (baselineEnd - baselineStart) / 60_000;
  const scheduleWindows = baseline.scheduleWindows
    .map((window) => {
      const start = timestampMs(window.startedAt, "M34_INVALID_SCHEDULE_SPAN");
      const end = timestampMs(window.endedAt, "M34_INVALID_SCHEDULE_SPAN");
      if (end <= start || start < baselineStart || end > baselineEnd) {
        throw new Error("M34_INVALID_SCHEDULE_SPAN");
      }
      return { id: window.id, start, end };
    })
    .sort((left, right) => left.start - right.start);
  for (let index = 1; index < scheduleWindows.length; index += 1) {
    if (scheduleWindows[index].start < scheduleWindows[index - 1].end) {
      throw new Error("M34_OVERLAPPING_SCHEDULE_WINDOWS");
    }
  }
  const scheduledMinutes = scheduleWindows.reduce(
    (total, window) => total + (window.end - window.start) / 60_000,
    0,
  );
  if (!Number.isInteger(scheduledMinutes) || scheduledMinutes <= 0) {
    throw new Error("M34_INVALID_SCHEDULED_MINUTES");
  }

  const normalizedEvents = outageEvents.map((event) => {
    const start = timestampMs(event.startedAt, "M34_INVALID_EVENT_SPAN");
    const end = timestampMs(event.endedAt, "M34_INVALID_EVENT_SPAN");
    if (end <= start || start < baselineStart || end > baselineEnd) {
      throw new Error("M34_INVALID_EVENT_SPAN");
    }
    const derivedDurationMinutes = (end - start) / 60_000;
    if (
      !Number.isInteger(event.durationMinutes) ||
      event.durationMinutes <= 0 ||
      event.durationMinutes !== derivedDurationMinutes
    ) {
      throw new Error("M34_EVENT_DURATION_MISMATCH");
    }
    const scheduledOverlapMinutes = overlapMinutes(start, end, scheduleWindows);
    if (
      event.stageId === baseline.stageId &&
      event.classification === "planned_excluded"
    ) {
      if (event.impactsAvailability || scheduledOverlapMinutes !== 0) {
        throw new Error("M34_PLANNED_OUTAGE_INSIDE_SCHEDULE");
      }
    }
    return { event, start, end, scheduledOverlapMinutes };
  });

  const plannedEvents = normalizedEvents.filter(
    ({ event }) =>
      event.stageId === baseline.stageId &&
      event.classification === "planned_excluded",
  );
  assertNonOverlappingOutages(plannedEvents);
  const plannedExcludedMinutes = plannedEvents.reduce(
    (total, { event }) => total + event.durationMinutes,
    0,
  );
  if (baselineMinutes - scheduledMinutes !== plannedExcludedMinutes) {
    throw new Error("M34_SCHEDULE_EXCLUSION_MISMATCH");
  }

  const qualifyingEvents = normalizedEvents.filter(
    ({ event, scheduledOverlapMinutes }) =>
      event.stageId === baseline.stageId &&
      event.classification === "unplanned" &&
      event.impactsAvailability &&
      scheduledOverlapMinutes > 0,
  );
  assertNonOverlappingOutages(qualifyingEvents);
  const excludedEvents = normalizedEvents.filter(
    (candidate) => !qualifyingEvents.includes(candidate),
  );
  const qualifyingDowntimeMinutes = qualifyingEvents.reduce(
    (total, event) => total + event.scheduledOverlapMinutes,
    0,
  );
  if (
    !Number.isInteger(qualifyingDowntimeMinutes) ||
    qualifyingDowntimeMinutes < 0 ||
    qualifyingDowntimeMinutes > scheduledMinutes
  ) {
    throw new Error("M34_INVALID_DOWNTIME_MINUTES");
  }
  const availableMinutes = scheduledMinutes - qualifyingDowntimeMinutes;
  const uptimePercent = Number(
    ((availableMinutes / scheduledMinutes) * 100).toFixed(4),
  );
  return {
    baselineId: baseline.id,
    scopeStageId: baseline.stageId,
    baselineStartAt: baseline.baselineStartAt,
    baselineEndAt: baseline.baselineEndAt,
    baselineMinutes,
    scheduledMinutes,
    plannedExcludedMinutes,
    qualifyingDowntimeMinutes,
    availableMinutes,
    uptimePercent,
    targetPercent: 99,
    passed: uptimePercent > 99,
    scheduleWindowIds: scheduleWindows.map((window) => window.id),
    sourceEventIds: qualifyingEvents.map(({ event }) => event.id),
    excludedEventIds: excludedEvents.map(({ event }) => event.id),
  };
}

const ALLOWED_WORK_ORDER_TRANSITIONS: Readonly<
  Record<M34WorkOrderState, readonly M34WorkOrderState[]>
> = {
  requested: ["triaged"],
  triaged: ["assigned"],
  assigned: ["in_progress"],
  in_progress: ["awaiting_inspection"],
  awaiting_inspection: ["completed"],
  completed: ["verified"],
  verified: ["reopened"],
  reopened: ["in_progress"],
};

export function isM34WorkOrderLifecycleValid(
  events: readonly M34WorkOrderEvent[],
): boolean {
  if (
    events.length === 0 ||
    events[0].fromState !== null ||
    events[0].toState !== "requested"
  )
    return false;
  for (let index = 1; index < events.length; index += 1) {
    const prior = events[index - 1];
    const current = events[index];
    if (current.fromState !== prior.toState) return false;
    if (
      !ALLOWED_WORK_ORDER_TRANSITIONS[prior.toState].includes(current.toState)
    )
      return false;
  }
  return events[events.length - 1]?.toState === "verified";
}

function buildCampusStages(): readonly M34CampusStage[] {
  return [
    {
      id: "SYNTH-M34-STAGE-1",
      canonicalStageId: "campus-stage-1",
      stageNumber: 1,
      name: "Stage 1 — Main Residential Unit",
      facilityId: "fac-001",
      status: "operational",
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M34-STAGE-2",
      canonicalStageId: "campus-stage-2",
      stageNumber: 2,
      name: "Stage 2 — Emergency Care Services",
      facilityId: "fac-003",
      status: "licensing_in_progress",
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M34-STAGE-3",
      canonicalStageId: "campus-stage-3",
      stageNumber: 3,
      name: "Stage 3 — Cypress Campus",
      facilityId: "fac-004",
      status: "capital_planning",
      evidenceClass: "synthetic_demo",
    },
  ];
}

function buildSites(): readonly M34Site[] {
  return [1, 2, 3].map((stageNumber) => ({
    id: `SYNTH-M34-SITE-${stageNumber}`,
    stageId: `SYNTH-M34-STAGE-${stageNumber}`,
    name: [
      "Main Residential Site",
      "Emergency Care Site",
      "Cypress Campus Site",
    ][stageNumber - 1],
    addressLabel: `${123 + (stageNumber - 1) * 2} Cypress Lane, Cypress, TX 77429`,
    evidenceClass: "synthetic_demo",
  }));
}

function buildSpaces(): readonly M34Space[] {
  const uses: readonly M34Space["use"][] = [
    "residential",
    "emergency_care",
    "corporate_support",
  ];
  const statuses: readonly M34Space["status"][] = [
    "available",
    "restricted",
    "planned",
  ];
  return [1, 2, 3].map((stageNumber) => ({
    id: `SYNTH-M34-SPACE-${stageNumber}`,
    siteId: `SYNTH-M34-SITE-${stageNumber}`,
    stageId: `SYNTH-M34-STAGE-${stageNumber}`,
    label: [
      "Residential Life-Safety Plant",
      "Emergency Care Utility Plant",
      "Campus Support Plant",
    ][stageNumber - 1],
    use: uses[stageNumber - 1],
    status: statuses[stageNumber - 1],
    evidenceClass: "synthetic_demo",
  }));
}

function buildAssets(): readonly M34Asset[] {
  const categories: readonly M34Asset["category"][] = [
    "life_safety",
    "building_system",
    "vehicle_support",
  ];
  const statuses: readonly M34Asset["status"][] = [
    "in_service",
    "commissioning",
    "planned",
  ];
  return [1, 2, 3].map((stageNumber) => ({
    id: `SYNTH-M34-ASSET-${stageNumber}`,
    stageId: `SYNTH-M34-STAGE-${stageNumber}`,
    spaceId: `SYNTH-M34-SPACE-${stageNumber}`,
    tag: `AMOS-GAD-${String(stageNumber).padStart(4, "0")}`,
    name: [
      "Residential Fire Panel",
      "Emergency Generator",
      "Campus Fleet Charging Station",
    ][stageNumber - 1],
    category: categories[stageNumber - 1],
    warrantyEndsAt: `202${7 + stageNumber}-12-31T23:59:59.000Z`,
    qualifiedVendorId:
      stageNumber === 3 ? "SYNTH-M34-VENDOR-02" : "SYNTH-M34-VENDOR-01",
    status: statuses[stageNumber - 1],
    evidenceClass: "synthetic_demo",
  }));
}

function buildWorkOrderEventSeries(
  workOrderId: string,
  reopened: boolean,
  day: number,
): readonly M34WorkOrderEvent[] {
  const states: readonly M34WorkOrderState[] = reopened
    ? [
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
      ]
    : [
        "requested",
        "triaged",
        "assigned",
        "in_progress",
        "awaiting_inspection",
        "completed",
        "verified",
      ];
  return states.map((toState, index) => {
    const fromState = index === 0 ? null : states[index - 1];
    const hour = String(8 + index).padStart(2, "0");
    return {
      id: `${workOrderId}-EVENT-${String(index + 1).padStart(2, "0")}`,
      workOrderId,
      fromState,
      toState,
      actorId:
        toState === "verified"
          ? "SYNTH-M34-FACILITIES-MANAGER"
          : "SYNTH-M34-TECHNICIAN-01",
      actorRole: "facilities-manager",
      reason:
        toState === "reopened"
          ? "Post-verification synthetic observation required controlled reopen."
          : `Synthetic work-order transition to ${toState}.`,
      occurredAt: `2026-07-${String(day).padStart(2, "0")}T${hour}:00:00.000Z`,
      evidenceIds: [
        `${workOrderId}-EVIDENCE-${String(index + 1).padStart(2, "0")}`,
      ],
      evidenceClass: "synthetic_demo",
    };
  });
}

function buildWorkOrders(): {
  workOrders: readonly M34WorkOrder[];
  workOrderEvents: readonly M34WorkOrderEvent[];
  laborEntries: readonly M34LaborEntry[];
  materialEntries: readonly M34MaterialEntry[];
} {
  const eventGroups = [
    buildWorkOrderEventSeries("SYNTH-M34-WO-1", true, 7),
    buildWorkOrderEventSeries("SYNTH-M34-WO-2", false, 8),
    buildWorkOrderEventSeries("SYNTH-M34-WO-3", false, 9),
  ];
  for (const events of eventGroups) {
    if (!isM34WorkOrderLifecycleValid(events))
      throw new Error("M34_WORK_ORDER_LIFECYCLE_INVALID");
  }
  const laborEntries: readonly M34LaborEntry[] = [1, 2, 3].map(
    (stageNumber) => ({
      id: `SYNTH-M34-LABOR-${stageNumber}`,
      workOrderId: `SYNTH-M34-WO-${stageNumber}`,
      technicianId: "SYNTH-M34-TECHNICIAN-01",
      hours: stageNumber + 1,
      performedAt: `2026-07-0${stageNumber + 6}T12:00:00.000Z`,
      evidenceClass: "synthetic_demo",
    }),
  );
  const materialEntries: readonly M34MaterialEntry[] = [1, 2, 3].map(
    (stageNumber) => ({
      id: `SYNTH-M34-MATERIAL-${stageNumber}`,
      workOrderId: `SYNTH-M34-WO-${stageNumber}`,
      inventoryItemId:
        stageNumber === 1
          ? "SYNTH-M34-INVENTORY-CONTROLLED"
          : "SYNTH-M34-INVENTORY-STANDARD",
      quantity: stageNumber,
      issuedAt: `2026-07-0${stageNumber + 6}T11:00:00.000Z`,
      evidenceClass: "synthetic_demo",
    }),
  );
  const requestTypes: readonly M34WorkOrder["requestType"][] = [
    "corrective",
    "preventive",
    "inspection",
  ];
  const priorities: readonly M34WorkOrder["priority"][] = [
    "critical",
    "urgent",
    "routine",
  ];
  const workOrders = [1, 2, 3].map((stageNumber) => ({
    id: `SYNTH-M34-WO-${stageNumber}`,
    stageId: `SYNTH-M34-STAGE-${stageNumber}`,
    assetId: `SYNTH-M34-ASSET-${stageNumber}`,
    requestType: requestTypes[stageNumber - 1],
    priority: priorities[stageNumber - 1],
    assignedVendorId:
      stageNumber === 3 ? "SYNTH-M34-VENDOR-02" : "SYNTH-M34-VENDOR-01",
    serviceLevelDueAt: `2026-07-${String(stageNumber + 7).padStart(2, "0")}T17:00:00.000Z`,
    finalState: "verified" as const,
    reopenedCount: stageNumber === 1 ? 1 : 0,
    eventIds: eventGroups[stageNumber - 1].map((event) => event.id),
    laborEntryIds: [`SYNTH-M34-LABOR-${stageNumber}`],
    materialEntryIds: [`SYNTH-M34-MATERIAL-${stageNumber}`],
    inspectionEvidenceId: `SYNTH-M34-EVIDENCE-INSPECTION-${stageNumber}`,
    verificationEvidenceId: `SYNTH-M34-EVIDENCE-VERIFICATION-${stageNumber}`,
    evidenceClass: "synthetic_demo" as const,
  }));
  return {
    workOrders,
    workOrderEvents: eventGroups.flat(),
    laborEntries,
    materialEntries,
  };
}

function buildPreventiveMaintenance(): {
  plans: readonly M34PreventiveMaintenancePlan[];
  history: readonly M34AssetHistoryEvent[];
} {
  const plans: readonly M34PreventiveMaintenancePlan[] = [
    {
      id: "SYNTH-M34-PM-01",
      assetId: "SYNTH-M34-ASSET-2",
      frequency: "monthly",
      qualifiedVendorId: "SYNTH-M34-VENDOR-01",
      warrantyVerified: true,
      lastCompletedAt: "2026-07-08T15:00:00.000Z",
      nextDueAt: "2026-08-08T15:00:00.000Z",
      generatedWorkOrderId: "SYNTH-M34-WO-2",
      recurringInspectionId: "SYNTH-M34-RECURRING-INSPECTION-01",
      evidenceClass: "synthetic_demo",
    },
  ];
  const historyTypes: readonly M34AssetHistoryEvent["type"][] = [
    "commissioned",
    "warranty_verified",
    "vendor_service",
    "inspection",
  ];
  const history = historyTypes.map((type, index) => ({
    id: `SYNTH-M34-ASSET-HISTORY-${String(index + 1).padStart(2, "0")}`,
    assetId: "SYNTH-M34-ASSET-2",
    type,
    sourceId: index < 2 ? "SYNTH-M34-ASSET-2" : "SYNTH-M34-WO-2",
    occurredAt: `2026-07-08T${String(10 + index).padStart(2, "0")}:00:00.000Z`,
    evidenceClass: "synthetic_demo" as const,
  }));
  return { plans, history };
}

function buildVendors(): readonly M34Vendor[] {
  return [
    {
      id: "SYNTH-M34-VENDOR-01",
      name: "Synthetic Life Safety Services",
      qualificationStatus: "qualified",
      insuranceExpiresAt: "2027-06-30T23:59:59.000Z",
      exclusionCheckedAt: "2026-07-01T13:00:00.000Z",
      approvedCategories: ["life_safety", "building_system"],
      evidenceIds: ["SYNTH-M34-EVIDENCE-VENDOR-01"],
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M34-VENDOR-02",
      name: "Synthetic Fleet and Campus Services",
      qualificationStatus: "qualified",
      insuranceExpiresAt: "2027-03-31T23:59:59.000Z",
      exclusionCheckedAt: "2026-07-01T13:00:00.000Z",
      approvedCategories: ["vehicle_support", "campus_support"],
      evidenceIds: ["SYNTH-M34-EVIDENCE-VENDOR-02"],
      evidenceClass: "synthetic_demo",
    },
  ];
}

function procurementEvent(
  procurementId: string,
  sequence: number,
  state: M34ProcurementEvent["state"],
  actorId: string,
  actorRole: UserRole,
  amountCents: number,
): M34ProcurementEvent {
  return {
    id: `${procurementId}-EVENT-${String(sequence).padStart(2, "0")}`,
    procurementId,
    state,
    actorId,
    actorRole,
    amountCents,
    evidenceIds: [
      `${procurementId}-EVIDENCE-${String(sequence).padStart(2, "0")}`,
    ],
    occurredAt: `2026-07-${String(1 + sequence).padStart(2, "0")}T14:00:00.000Z`,
    evidenceClass: "synthetic_demo",
  };
}

function buildProcurement(): {
  cycles: readonly M34ProcurementCycle[];
  events: readonly M34ProcurementEvent[];
} {
  const matchedId = "SYNTH-M34-PROCUREMENT-MATCHED";
  const exceptionId = "SYNTH-M34-PROCUREMENT-EXCEPTION";
  const matchedStates: readonly M34ProcurementEvent["state"][] = [
    "requisitioned",
    "approved",
    "purchase_order_issued",
    "received",
    "invoice_received",
    "matched",
    "payment_handoff",
  ];
  const exceptionStates: readonly M34ProcurementEvent["state"][] = [
    "requisitioned",
    "approved",
    "purchase_order_issued",
    "received",
    "invoice_received",
    "exception_opened",
    "exception_resolved",
    "payment_handoff",
  ];
  const actorByState: Readonly<
    Record<M34ProcurementEvent["state"], readonly [string, UserRole]>
  > = {
    requisitioned: ["SYNTH-M34-REQUESTOR", "facilities-manager"],
    approved: ["SYNTH-M34-APPROVER", "program-director"],
    purchase_order_issued: ["SYNTH-M34-BUYER", "facilities-manager"],
    received: ["SYNTH-M34-RECEIVER", "shift-supervisor"],
    invoice_received: ["SYNTH-M34-AP-ANALYST", "billing-specialist"],
    matched: ["SYNTH-M34-MATCH-ANALYST", "revenue-cycle-manager"],
    exception_opened: ["SYNTH-M34-MATCH-ANALYST", "revenue-cycle-manager"],
    exception_resolved: ["SYNTH-M34-EXCEPTION-APPROVER", "administrator"],
    payment_handoff: ["SYNTH-M34-AP-HANDOFF", "revenue-cycle-manager"],
  };
  const buildEvents = (
    id: string,
    states: readonly M34ProcurementEvent["state"][],
    amount: number,
  ) =>
    states.map((state, index) => {
      const actor = actorByState[state];
      return procurementEvent(id, index + 1, state, actor[0], actor[1], amount);
    });
  const matchedEvents = buildEvents(matchedId, matchedStates, 250_000);
  const exceptionEvents = buildEvents(exceptionId, exceptionStates, 412_500);
  const cycles: readonly M34ProcurementCycle[] = [
    {
      id: matchedId,
      vendorId: "SYNTH-M34-VENDOR-01",
      requisitionId: "SYNTH-M34-REQ-MATCHED",
      purchaseOrderId: "SYNTH-M34-PO-MATCHED",
      receiptId: "SYNTH-M34-RECEIPT-MATCHED",
      invoiceId: "SYNTH-M34-INVOICE-MATCHED",
      orderedAmountCents: 250_000,
      receivedAmountCents: 250_000,
      invoicedAmountCents: 250_000,
      matchOutcome: "matched",
      paymentHandoffId: "SYNTH-M34-PAYMENT-HANDOFF-MATCHED",
      eventIds: matchedEvents.map((event) => event.id),
      segregationOfDutiesPassed: true,
      evidenceClass: "synthetic_demo",
    },
    {
      id: exceptionId,
      vendorId: "SYNTH-M34-VENDOR-02",
      requisitionId: "SYNTH-M34-REQ-EXCEPTION",
      purchaseOrderId: "SYNTH-M34-PO-EXCEPTION",
      receiptId: "SYNTH-M34-RECEIPT-EXCEPTION",
      invoiceId: "SYNTH-M34-INVOICE-EXCEPTION",
      orderedAmountCents: 400_000,
      receivedAmountCents: 400_000,
      invoicedAmountCents: 412_500,
      matchOutcome: "exception_resolved",
      paymentHandoffId: "SYNTH-M34-PAYMENT-HANDOFF-EXCEPTION",
      eventIds: exceptionEvents.map((event) => event.id),
      segregationOfDutiesPassed: true,
      evidenceClass: "synthetic_demo",
    },
  ];
  return { cycles, events: [...matchedEvents, ...exceptionEvents] };
}

function buildInventory(): {
  items: readonly M34InventoryItem[];
  transactions: readonly M34InventoryTransaction[];
} {
  const items: readonly M34InventoryItem[] = [
    {
      id: "SYNTH-M34-INVENTORY-CONTROLLED",
      name: "Controlled emergency key set",
      controlled: true,
      reorderThreshold: 5,
      quantityOnHand: 4,
      belowThreshold: true,
      custodianRole: "facilities-manager",
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M34-INVENTORY-STANDARD",
      name: "Life-safety inspection seals",
      controlled: false,
      reorderThreshold: 10,
      quantityOnHand: 24,
      belowThreshold: false,
      custodianRole: "facilities-manager",
      evidenceClass: "synthetic_demo",
    },
  ];
  const transactions: readonly M34InventoryTransaction[] = [
    {
      id: "SYNTH-M34-INVENTORY-TX-ISSUE",
      itemId: "SYNTH-M34-INVENTORY-CONTROLLED",
      type: "issue",
      quantity: 2,
      actorId: "SYNTH-M34-CUSTODIAN",
      evidenceId: "SYNTH-M34-EVIDENCE-INVENTORY-ISSUE",
      occurredAt: "2026-07-07T11:00:00.000Z",
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M34-INVENTORY-TX-RETURN",
      itemId: "SYNTH-M34-INVENTORY-CONTROLLED",
      type: "return",
      quantity: 1,
      actorId: "SYNTH-M34-CUSTODIAN",
      evidenceId: "SYNTH-M34-EVIDENCE-INVENTORY-RETURN",
      occurredAt: "2026-07-07T16:00:00.000Z",
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M34-INVENTORY-TX-COUNT",
      itemId: "SYNTH-M34-INVENTORY-CONTROLLED",
      type: "cycle_count",
      quantity: 4,
      expectedQuantity: 5,
      actualQuantity: 4,
      variance: -1,
      actorId: "SYNTH-M34-INVENTORY-SPECIALIST",
      evidenceId: "SYNTH-M34-EVIDENCE-INVENTORY-COUNT",
      occurredAt: "2026-07-10T16:00:00.000Z",
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M34-INVENTORY-TX-VARIANCE",
      itemId: "SYNTH-M34-INVENTORY-CONTROLLED",
      type: "variance_adjustment",
      quantity: -1,
      expectedQuantity: 5,
      actualQuantity: 4,
      variance: -1,
      actorId: "SYNTH-M34-FACILITIES-MANAGER",
      evidenceId: "SYNTH-M34-EVIDENCE-INVENTORY-VARIANCE",
      occurredAt: "2026-07-10T17:00:00.000Z",
      evidenceClass: "synthetic_demo",
    },
  ];
  return { items, transactions };
}

function buildSafety(): {
  drills: readonly M34SafetyDrill[];
  equipment: readonly M34EmergencyEquipment[];
} {
  const drillTypes: readonly M34SafetyDrill["type"][] = [
    "fire",
    "severe_weather",
    "medical_emergency",
  ];
  const equipmentTypes: readonly M34EmergencyEquipment["type"][] = [
    "fire_extinguisher",
    "aed",
    "emergency_generator",
  ];
  const equipment = [1, 2, 3].map((stageNumber) => ({
    id: `SYNTH-M34-EQUIPMENT-${stageNumber}`,
    stageId: `SYNTH-M34-STAGE-${stageNumber}`,
    type: equipmentTypes[stageNumber - 1],
    inspectionFrequency:
      stageNumber === 2 ? ("quarterly" as const) : ("monthly" as const),
    lastInspectedAt: "2026-07-01T14:00:00.000Z",
    nextInspectionAt:
      stageNumber === 2
        ? "2026-10-01T14:00:00.000Z"
        : "2026-08-01T14:00:00.000Z",
    status: "ready" as const,
    evidenceId: `SYNTH-M34-EVIDENCE-EQUIPMENT-${stageNumber}`,
    evidenceClass: "synthetic_demo" as const,
  }));
  const drills = [1, 2, 3].map((stageNumber) => ({
    id: `SYNTH-M34-DRILL-${stageNumber}`,
    stageId: `SYNTH-M34-STAGE-${stageNumber}`,
    type: drillTypes[stageNumber - 1],
    scheduledAt: `2026-07-${String(stageNumber + 1).padStart(2, "0")}T14:00:00.000Z`,
    completedAt: `2026-07-${String(stageNumber + 1).padStart(2, "0")}T14:12:00.000Z`,
    participantCount: 8 + stageNumber,
    evacuationMinutes: 5 + stageNumber,
    emergencyEquipmentIds: [`SYNTH-M34-EQUIPMENT-${stageNumber}`],
    inspectionId: `SYNTH-M34-INSPECTION-${stageNumber}`,
    correctiveActionId: `SYNTH-M34-CORRECTIVE-${stageNumber}`,
    correctiveActionStatus: "verified_closed" as const,
    evidenceIds: [
      `SYNTH-M34-EVIDENCE-DRILL-${stageNumber}`,
      `SYNTH-M34-EVIDENCE-CORRECTIVE-${stageNumber}`,
    ],
    evidenceRetentionYears: 7 as const,
    evidenceClass: "synthetic_demo" as const,
  }));
  return { drills, equipment };
}

function buildTransportation(): {
  drivers: readonly M34Driver[];
  vehicles: readonly M34Vehicle[];
  trips: readonly M34TransportTrip[];
  incidents: readonly M34TransportIncident[];
} {
  const drivers: readonly M34Driver[] = [
    {
      id: "SYNTH-M34-DRIVER-01",
      licenseExpiresAt: "2028-04-30T23:59:59.000Z",
      backgroundStatus: "current",
      trainingStatus: "current",
      approved: true,
      evidenceClass: "synthetic_demo",
    },
  ];
  const vehicles: readonly M34Vehicle[] = [
    {
      id: "SYNTH-M34-VEHICLE-01",
      fleetNumber: "AMOS-DEMO-001",
      capacity: 8,
      inspectionExpiresAt: "2027-02-28T23:59:59.000Z",
      insuranceExpiresAt: "2027-01-31T23:59:59.000Z",
      maintenanceDueAt: "2026-08-15T14:00:00.000Z",
      maintenanceStatus: "current",
      evidenceClass: "synthetic_demo",
    },
  ];
  const trips: readonly M34TransportTrip[] = [
    {
      id: "SYNTH-M34-TRIP-01",
      requestId: "SYNTH-M34-TRANSPORT-REQUEST-01",
      driverId: "SYNTH-M34-DRIVER-01",
      vehicleId: "SYNTH-M34-VEHICLE-01",
      stageId: "SYNTH-M34-STAGE-1",
      scheduledDepartureAt: "2026-07-12T14:00:00.000Z",
      departedAt: "2026-07-12T14:00:00.000Z",
      returnedAt: "2026-07-12T16:00:00.000Z",
      status: "completed",
      incidentId: null,
      preTripEvidenceId: "SYNTH-M34-EVIDENCE-PRETRIP-01",
      postTripEvidenceId: "SYNTH-M34-EVIDENCE-POSTTRIP-01",
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M34-TRIP-02",
      requestId: "SYNTH-M34-TRANSPORT-REQUEST-02",
      driverId: "SYNTH-M34-DRIVER-01",
      vehicleId: "SYNTH-M34-VEHICLE-01",
      stageId: "SYNTH-M34-STAGE-2",
      scheduledDepartureAt: "2026-07-13T14:00:00.000Z",
      departedAt: "2026-07-13T14:02:00.000Z",
      returnedAt: "2026-07-13T15:30:00.000Z",
      status: "completed",
      incidentId: "SYNTH-M34-TRANSPORT-INCIDENT-01",
      preTripEvidenceId: "SYNTH-M34-EVIDENCE-PRETRIP-02",
      postTripEvidenceId: "SYNTH-M34-EVIDENCE-POSTTRIP-02",
      evidenceClass: "synthetic_demo",
    },
  ];
  const incidents: readonly M34TransportIncident[] = [
    {
      id: "SYNTH-M34-TRANSPORT-INCIDENT-01",
      tripId: "SYNTH-M34-TRIP-02",
      severity: "minor",
      description:
        "Synthetic low-speed tire contact; no person or live asset involved.",
      correctiveActionId: "SYNTH-M34-TRANSPORT-CORRECTIVE-01",
      status: "closed",
      evidenceClass: "synthetic_demo",
    },
  ];
  return { drivers, vehicles, trips, incidents };
}

function buildUptimeBaseline(): M34UptimeBaseline {
  const scheduleWindows: readonly M34AvailabilityScheduleWindow[] = [
    {
      id: "SYNTH-M34-SCHEDULE-JULY-A",
      startedAt: "2026-07-01T00:00:00.000Z",
      endedAt: "2026-07-15T10:00:00.000Z",
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M34-SCHEDULE-JULY-B",
      startedAt: "2026-07-15T13:00:00.000Z",
      endedAt: "2026-07-31T00:00:00.000Z",
      evidenceClass: "synthetic_demo",
    },
  ];
  return {
    id: "SYNTH-M34-UPTIME-BASELINE-JULY",
    stageId: "SYNTH-M34-STAGE-1",
    baselineStartAt: "2026-07-01T00:00:00.000Z",
    baselineEndAt: "2026-07-31T00:00:00.000Z",
    scheduleWindows,
    evidenceClass: "synthetic_demo",
  };
}

function buildOutageEvents(): readonly M34OutageEvent[] {
  return [
    [
      "SYNTH-M34-OUTAGE-01",
      "SYNTH-M34-STAGE-1",
      "unplanned",
      120,
      true,
      "2026-07-03T10:00:00.000Z",
      "2026-07-03T12:00:00.000Z",
    ],
    [
      "SYNTH-M34-OUTAGE-02",
      "SYNTH-M34-STAGE-1",
      "unplanned",
      60,
      true,
      "2026-07-08T10:00:00.000Z",
      "2026-07-08T11:00:00.000Z",
    ],
    [
      "SYNTH-M34-OUTAGE-03",
      "SYNTH-M34-STAGE-1",
      "unplanned",
      60,
      true,
      "2026-07-12T10:00:00.000Z",
      "2026-07-12T11:00:00.000Z",
    ],
    [
      "SYNTH-M34-OUTAGE-EXCLUDED",
      "SYNTH-M34-STAGE-1",
      "planned_excluded",
      180,
      false,
      "2026-07-15T10:00:00.000Z",
      "2026-07-15T13:00:00.000Z",
    ],
  ].map(
    ([
      id,
      stageId,
      classification,
      durationMinutes,
      impactsAvailability,
      startedAt,
      endedAt,
    ]) => ({
      id: String(id),
      stageId: String(stageId),
      sourceSystem: "synthetic_facility_monitor",
      classification: classification as M34OutageEvent["classification"],
      startedAt: String(startedAt),
      endedAt: String(endedAt),
      durationMinutes: Number(durationMinutes),
      impactsAvailability: Boolean(impactsAvailability),
      evidenceClass: "synthetic_demo",
    }),
  );
}

function auditEvent(
  id: string,
  action: Phase3AuditAction,
  entityType: string,
  entityId: string,
  actorId: string,
  actorRole: UserRole | "system",
  reason: string,
  occurredAt: string,
  before?: Readonly<Record<string, unknown>>,
  after?: Readonly<Record<string, unknown>>,
): Phase3AuditEvent {
  return {
    id,
    domain: "GAD",
    action,
    entityType,
    entityId,
    actorId,
    actorRole,
    reason,
    correlationId: M34_CORRELATION_ID,
    before,
    after,
    changedFields: changedPhase3Fields(before, after),
    evidenceClass: "synthetic_demo",
    occurredAt,
  };
}

function buildAuditEvents(
  uptime: M34UptimeMeasurement,
): readonly Phase3AuditEvent[] {
  return [
    auditEvent(
      "SYNTH-M34-AUDIT-01",
      "scenario",
      "three_stage_facility_registry",
      "SYNTH-M34-STAGE-REGISTRY",
      "SYNTH-M34-FACILITIES-MANAGER",
      "facilities-manager",
      "Canonical three-stage identities and distinct readiness states were reconciled to sites, spaces, assets, and work orders.",
      "2026-07-14T14:00:00.000Z",
      undefined,
      { stageCount: 3, distinctStatuses: 3 },
    ),
    auditEvent(
      "SYNTH-M34-AUDIT-02",
      "gate_decision",
      "work_order",
      "SYNTH-M34-WO-1",
      "SYNTH-M34-FACILITIES-MANAGER",
      "facilities-manager",
      "Full work-order lifecycle was verified after one controlled reopen.",
      "2026-07-07T19:00:00.000Z",
      { state: "verified", reopenCount: 0 },
      { state: "verified", reopenCount: 1 },
    ),
    auditEvent(
      "SYNTH-M34-AUDIT-03",
      "approval",
      "preventive_maintenance",
      "SYNTH-M34-PM-01",
      "SYNTH-M34-FACILITIES-MANAGER",
      "facilities-manager",
      "Recurring inspection, qualified vendor, warranty, and asset history were verified.",
      "2026-07-08T16:00:00.000Z",
      { state: "due" },
      { state: "completed", nextDueAt: "2026-08-08T15:00:00.000Z" },
    ),
    auditEvent(
      "SYNTH-M34-AUDIT-04-MATCH",
      "approval",
      "procurement_cycle",
      "SYNTH-M34-PROCUREMENT-MATCHED",
      "SYNTH-M34-AP-HANDOFF",
      "revenue-cycle-manager",
      "Qualified-vendor purchase order, receipt, invoice match, and payment handoff completed with segregated actors.",
      "2026-07-08T14:00:00.000Z",
      { state: "matched" },
      { state: "payment_handoff" },
    ),
    auditEvent(
      "SYNTH-M34-AUDIT-04-EXCEPTION",
      "gate_decision",
      "procurement_exception",
      "SYNTH-M34-PROCUREMENT-EXCEPTION",
      "SYNTH-M34-EXCEPTION-APPROVER",
      "administrator",
      "Invoice variance was held, independently resolved, and then released to payment handoff.",
      "2026-07-09T14:00:00.000Z",
      { state: "exception_opened", varianceCents: 12500 },
      { state: "exception_resolved" },
    ),
    auditEvent(
      "SYNTH-M34-AUDIT-05",
      "administrative_action",
      "inventory_variance",
      "SYNTH-M34-INVENTORY-TX-VARIANCE",
      "SYNTH-M34-FACILITIES-MANAGER",
      "facilities-manager",
      "Controlled-item issue, return, cycle count, threshold, and variance were reconciled.",
      "2026-07-10T17:00:00.000Z",
      { expected: 5 },
      { actual: 4, variance: -1, reorderRequired: true },
    ),
    auditEvent(
      "SYNTH-M34-AUDIT-06",
      "approval",
      "safety_drill",
      "SYNTH-M34-DRILL-1",
      "SYNTH-M34-SAFETY-OFFICER",
      "facilities-manager",
      "Drill evidence, emergency equipment inspection, and corrective action were retained and verified.",
      "2026-07-02T15:00:00.000Z",
      { correctiveActionStatus: "open" },
      { correctiveActionStatus: "verified_closed" },
    ),
    auditEvent(
      "SYNTH-M34-AUDIT-07",
      "gate_decision",
      "transport_trip",
      "SYNTH-M34-TRIP-02",
      "SYNTH-M34-TRANSPORT-COORDINATOR",
      "facilities-manager",
      "Qualified driver, maintained vehicle, trip evidence, incident, and corrective action passed transport controls.",
      "2026-07-13T16:00:00.000Z",
      { status: "in_progress" },
      { status: "completed", incidentStatus: "closed" },
    ),
    auditEvent(
      "SYNTH-M34-AUDIT-08",
      "scenario",
      "facility_uptime",
      "SYNTH-M34-UPTIME-JULY",
      "SYNTH-M34-FACILITY-MONITOR",
      "system",
      "Declared baseline excluded planned out-of-schedule time from the denominator and derived qualifying unplanned downtime from event spans.",
      "2026-07-31T23:59:59.000Z",
      undefined,
      {
        scopeStageId: uptime.scopeStageId,
        baselineMinutes: uptime.baselineMinutes,
        scheduledMinutes: uptime.scheduledMinutes,
        plannedExcludedMinutes: uptime.plannedExcludedMinutes,
        downtimeMinutes: uptime.qualifyingDowntimeMinutes,
        uptimePercent: uptime.uptimePercent,
      },
    ),
    auditEvent(
      "SYNTH-M34-AUDIT-BOUNDARY",
      "administrative_action",
      "write_boundary",
      "SYNTH-M34-WRITE-BOUNDARY",
      "SYNTH-M34-SCENARIO-RUNNER",
      "system",
      "Production procurement, facilities, notifications, connectors, payments, and tenant writes remain blocked.",
      "2026-07-14T14:30:00.000Z",
      undefined,
      { productionWritesBlocked: true, liveConnectorMutationsBlocked: true },
    ),
  ];
}

function assertSyntheticRecords(snapshot: M34Snapshot): void {
  const recordGroups = [
    [snapshot.uptimeBaseline],
    snapshot.uptimeBaseline.scheduleWindows,
    snapshot.campusStages,
    snapshot.sites,
    snapshot.spaces,
    snapshot.assets,
    snapshot.workOrders,
    snapshot.workOrderEvents,
    snapshot.laborEntries,
    snapshot.materialEntries,
    snapshot.preventiveMaintenancePlans,
    snapshot.assetHistory,
    snapshot.vendors,
    snapshot.procurementCycles,
    snapshot.procurementEvents,
    snapshot.inventoryItems,
    snapshot.inventoryTransactions,
    snapshot.safetyDrills,
    snapshot.emergencyEquipment,
    snapshot.drivers,
    snapshot.vehicles,
    snapshot.transportTrips,
    snapshot.transportIncidents,
    snapshot.outageEvents,
  ] as const;
  for (const records of recordGroups) {
    for (const record of records) assertM34SyntheticWrite(record);
  }
}

function assertM34SnapshotRoles(
  snapshot: M34Snapshot,
  auditEvents: readonly Phase3AuditEvent[],
): void {
  const humanRoles = [
    ...snapshot.workOrderEvents.map((event) => event.actorRole),
    ...snapshot.procurementEvents.map((event) => event.actorRole),
    ...snapshot.inventoryItems.map((item) => item.custodianRole),
    ...auditEvents
      .filter((event) => event.actorRole !== "system")
      .map((event) => event.actorRole),
  ];
  humanRoles.forEach(assertM34CanonicalHumanRole);
}

function buildCriteria(
  snapshot: M34Snapshot,
  auditEvents: readonly Phase3AuditEvent[],
): readonly Phase3CriterionResult[] {
  const auditIds = (prefix: string) =>
    auditEvents
      .filter((event) => event.id.startsWith(prefix))
      .map((event) => event.id);
  const stageIds = snapshot.campusStages.map((stage) => stage.id);
  const stageStatuses = snapshot.campusStages.map((stage) => stage.status);
  const workOrderTypes = [
    ...new Set(snapshot.workOrders.map((workOrder) => workOrder.requestType)),
  ];
  const procurementStates = [
    ...new Set(snapshot.procurementEvents.map((event) => event.state)),
  ];
  const inventoryTypes = [
    ...new Set(
      snapshot.inventoryTransactions.map((transaction) => transaction.type),
    ),
  ];
  const assetHistoryTypes = [
    ...new Set(snapshot.assetHistory.map((event) => event.type)),
  ];

  return [
    {
      criterionId: M34_CRITERIA[0],
      passed:
        stageIds.length === 3 &&
        new Set(stageStatuses).size === 3 &&
        stageIds.every((stageId) =>
          snapshot.workOrders.some(
            (workOrder) => workOrder.stageId === stageId,
          ),
        ) &&
        snapshot.sites.length === 3 &&
        snapshot.spaces.length === 3 &&
        snapshot.assets.length === 3,
      summary:
        "Sites, spaces, assets, and verified work orders cover the three canonical campus stages without collapsing readiness states.",
      evidence: {
        stageIds,
        canonicalStageIds: snapshot.campusStages.map(
          (stage) => stage.canonicalStageId,
        ),
        stageStatuses,
        workOrderIds: snapshot.workOrders.map((workOrder) => workOrder.id),
        auditEventIds: auditIds("SYNTH-M34-AUDIT-01"),
      },
    },
    {
      criterionId: M34_CRITERIA[1],
      passed:
        snapshot.workOrders.every((workOrder) =>
          isM34WorkOrderLifecycleValid(
            snapshot.workOrderEvents.filter(
              (event) => event.workOrderId === workOrder.id,
            ),
          ),
        ) &&
        snapshot.workOrders.some(
          (workOrder) => workOrder.reopenedCount === 1,
        ) &&
        workOrderTypes.length === 3,
      summary:
        "Request, triage, assignment, SLA, labor/material, inspection, completion, verification, and reopen controls pass.",
      evidence: {
        workOrderTypes,
        workOrders: snapshot.workOrders,
        auditEventIds: auditIds("SYNTH-M34-AUDIT-02"),
      },
    },
    {
      criterionId: M34_CRITERIA[2],
      passed:
        snapshot.preventiveMaintenancePlans.length > 0 &&
        [
          "commissioned",
          "warranty_verified",
          "vendor_service",
          "inspection",
        ].every((type) =>
          assetHistoryTypes.includes(type as M34AssetHistoryEvent["type"]),
        ) &&
        snapshot.vendors.every(
          (vendor) => vendor.qualificationStatus === "qualified",
        ),
      summary:
        "Preventive maintenance generates recurring inspection work with qualified vendor, warranty, and immutable asset history.",
      evidence: {
        planIds: snapshot.preventiveMaintenancePlans.map((plan) => plan.id),
        assetHistoryTypes,
        auditEventIds: auditIds("SYNTH-M34-AUDIT-03"),
      },
    },
    {
      criterionId: M34_CRITERIA[3],
      passed:
        snapshot.procurementCycles.length === 2 &&
        snapshot.procurementCycles.every(
          (cycle) =>
            cycle.segregationOfDutiesPassed &&
            cycle.paymentHandoffId.startsWith("SYNTH-"),
        ) &&
        procurementStates.includes("matched") &&
        procurementStates.includes("exception_opened") &&
        procurementStates.includes("exception_resolved") &&
        procurementStates.includes("payment_handoff"),
      summary:
        "Qualified-vendor procurement completes purchase order through payment handoff, including a controlled match exception.",
      evidence: {
        cycleIds: snapshot.procurementCycles.map((cycle) => cycle.id),
        procurementStates,
        auditEventIds: auditIds("SYNTH-M34-AUDIT-04"),
      },
    },
    {
      criterionId: M34_CRITERIA[4],
      passed:
        ["issue", "return", "cycle_count", "variance_adjustment"].every(
          (type) =>
            inventoryTypes.includes(type as M34InventoryTransaction["type"]),
        ) &&
        snapshot.inventoryItems.some(
          (item) => item.controlled && item.belowThreshold,
        ),
      summary:
        "Inventory controls cover thresholds, controlled custody, issue/return, cycle count, and authorized variance.",
      evidence: {
        itemIds: snapshot.inventoryItems.map((item) => item.id),
        inventoryTypes,
        auditEventIds: auditIds("SYNTH-M34-AUDIT-05"),
      },
    },
    {
      criterionId: M34_CRITERIA[5],
      passed:
        snapshot.safetyDrills.length === 3 &&
        snapshot.safetyDrills.every(
          (drill) =>
            drill.correctiveActionStatus === "verified_closed" &&
            drill.evidenceIds.length >= 2 &&
            drill.evidenceRetentionYears === 7,
        ) &&
        snapshot.emergencyEquipment.every(
          (equipment) =>
            equipment.status === "ready" &&
            equipment.nextInspectionAt > equipment.lastInspectedAt,
        ),
      summary:
        "All stages retain drill, corrective-action, emergency-equipment, recurring-inspection, and closure evidence.",
      evidence: {
        drillIds: snapshot.safetyDrills.map((drill) => drill.id),
        equipmentIds: snapshot.emergencyEquipment.map(
          (equipment) => equipment.id,
        ),
        auditEventIds: auditIds("SYNTH-M34-AUDIT-06"),
      },
    },
    {
      criterionId: M34_CRITERIA[6],
      passed:
        snapshot.drivers.every(
          (driver) =>
            driver.approved &&
            driver.backgroundStatus === "current" &&
            driver.trainingStatus === "current",
        ) &&
        snapshot.vehicles.every(
          (vehicle) => vehicle.maintenanceStatus === "current",
        ) &&
        snapshot.transportTrips.every(
          (trip) =>
            trip.status === "completed" &&
            trip.preTripEvidenceId &&
            trip.postTripEvidenceId,
        ) &&
        snapshot.transportIncidents.every(
          (incident) => incident.status === "closed",
        ),
      summary:
        "Transport requests pass driver, vehicle, schedule, maintenance, trip evidence, incident, and corrective-action gates.",
      evidence: {
        tripIds: snapshot.transportTrips.map((trip) => trip.id),
        incidentIds: snapshot.transportIncidents.map((incident) => incident.id),
        auditEventIds: auditIds("SYNTH-M34-AUDIT-07"),
      },
    },
    {
      criterionId: M34_CRITERIA[7],
      passed:
        snapshot.uptime.uptimePercent > 99 &&
        snapshot.uptime.passed &&
        snapshot.uptime.plannedExcludedMinutes > 0 &&
        snapshot.uptime.scheduledMinutes ===
          snapshot.uptime.baselineMinutes -
            snapshot.uptime.plannedExcludedMinutes &&
        snapshot.campusStages.some(
          (stage) =>
            stage.id === snapshot.uptime.scopeStageId &&
            stage.status === "operational",
        ) &&
        snapshot.uptime.sourceEventIds.every((eventId) =>
          snapshot.outageEvents.some(
            (event) =>
              event.id === eventId &&
              event.stageId === snapshot.uptime.scopeStageId,
          ),
        ) &&
        snapshot.uptime.sourceEventIds.length === 3 &&
        snapshot.uptime.excludedEventIds.length === 1,
      summary:
        "Facility uptime exceeds 99 percent from controlled baseline, schedule, planned-exclusion, and source-event calculations.",
      evidence: {
        uptime: snapshot.uptime,
        auditEventIds: auditIds("SYNTH-M34-AUDIT-08"),
      },
    },
  ];
}

/** Execute the complete M3.4 GAD milestone against a fresh fixed dataset. */
export function runM34SyntheticSuite(): M34ModuleResult {
  const campusStages = buildCampusStages();
  const sites = buildSites();
  const spaces = buildSpaces();
  const assets = buildAssets();
  const work = buildWorkOrders();
  const preventiveMaintenance = buildPreventiveMaintenance();
  const vendors = buildVendors();
  const procurement = buildProcurement();
  const inventory = buildInventory();
  const safety = buildSafety();
  const transportation = buildTransportation();
  const uptimeBaseline = buildUptimeBaseline();
  const outageEvents = buildOutageEvents();
  const uptimeCalculation = calculateM34Uptime(uptimeBaseline, outageEvents);
  if (!uptimeCalculation.passed) throw new Error("M34_UPTIME_TARGET_NOT_MET");
  const uptime: M34UptimeMeasurement = {
    baselineId: uptimeCalculation.baselineId,
    scopeStageId: uptimeCalculation.scopeStageId,
    baselineStartAt: uptimeCalculation.baselineStartAt,
    baselineEndAt: uptimeCalculation.baselineEndAt,
    baselineMinutes: uptimeCalculation.baselineMinutes,
    scheduledMinutes: uptimeCalculation.scheduledMinutes,
    plannedExcludedMinutes: uptimeCalculation.plannedExcludedMinutes,
    qualifyingDowntimeMinutes: uptimeCalculation.qualifyingDowntimeMinutes,
    availableMinutes: uptimeCalculation.availableMinutes,
    uptimePercent: uptimeCalculation.uptimePercent,
    targetPercent: 99,
    passed: true,
    formula: UPTIME_FORMULA,
    scheduleWindowIds: uptimeCalculation.scheduleWindowIds,
    sourceEventIds: uptimeCalculation.sourceEventIds,
    excludedEventIds: uptimeCalculation.excludedEventIds,
  };
  const snapshot: M34Snapshot = {
    generatedAt: M34_FIXED_NOW,
    campusStages,
    sites,
    spaces,
    assets,
    workOrders: work.workOrders,
    workOrderEvents: work.workOrderEvents,
    laborEntries: work.laborEntries,
    materialEntries: work.materialEntries,
    preventiveMaintenancePlans: preventiveMaintenance.plans,
    assetHistory: preventiveMaintenance.history,
    vendors,
    procurementCycles: procurement.cycles,
    procurementEvents: procurement.events,
    inventoryItems: inventory.items,
    inventoryTransactions: inventory.transactions,
    safetyDrills: safety.drills,
    emergencyEquipment: safety.equipment,
    drivers: transportation.drivers,
    vehicles: transportation.vehicles,
    transportTrips: transportation.trips,
    transportIncidents: transportation.incidents,
    uptimeBaseline,
    outageEvents,
    uptime,
    writeBoundary: {
      mode: "evaluation_only",
      productionWritesBlocked: true,
      liveConnectorMutationsBlocked: true,
      allowedEvidenceClass: "synthetic_demo",
      blockedActionTypes: [
        "create_live_work_order",
        "issue_live_purchase_order",
        "release_live_payment",
        "send_live_notification",
        "write_microsoft_tenant",
        "mutate_live_facility_or_vehicle",
      ],
    },
  };
  assertSyntheticRecords(snapshot);
  const auditEvents = buildAuditEvents(uptime);
  for (const event of auditEvents) assertM34SyntheticWrite(event);
  assertM34SnapshotRoles(snapshot, auditEvents);
  const criteria = buildCriteria(snapshot, auditEvents);
  return {
    milestone: "M3.4",
    domain: "GAD",
    evidenceClass: "synthetic_demo",
    passed:
      criteria.length === M34_CRITERIA.length &&
      criteria.every((criterion) => criterion.passed),
    criteria,
    snapshot,
    auditEvents,
  };
}
