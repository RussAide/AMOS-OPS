import type {
  Phase3AuditEvent,
  Phase3CriterionResult,
  Phase3EvidenceClass,
  Phase3ModuleResult,
} from "./shared";
import type { UserRole } from "@/constants/roles";

export const M34_CRITERIA = [
  "M3.4-01",
  "M3.4-02",
  "M3.4-03",
  "M3.4-04",
  "M3.4-05",
  "M3.4-06",
  "M3.4-07",
  "M3.4-08",
] as const;
export type M34Criterion = (typeof M34_CRITERIA)[number];

export const M34_FIXED_NOW = "2026-07-14T13:00:00.000Z";

export type M34CampusStatus =
  "operational" | "licensing_in_progress" | "capital_planning";

export interface M34CampusStage {
  id: string;
  canonicalStageId: "campus-stage-1" | "campus-stage-2" | "campus-stage-3";
  stageNumber: 1 | 2 | 3;
  name:
    | "Stage 1 — Main Residential Unit"
    | "Stage 2 — Emergency Care Services"
    | "Stage 3 — Cypress Campus";
  facilityId: "fac-001" | "fac-003" | "fac-004";
  status: M34CampusStatus;
  evidenceClass: "synthetic_demo";
}

export interface M34Site {
  id: string;
  stageId: string;
  name: string;
  addressLabel: string;
  evidenceClass: "synthetic_demo";
}

export interface M34Space {
  id: string;
  siteId: string;
  stageId: string;
  label: string;
  use: "residential" | "emergency_care" | "corporate_support";
  status: "available" | "restricted" | "planned";
  evidenceClass: "synthetic_demo";
}

export interface M34Asset {
  id: string;
  stageId: string;
  spaceId: string;
  tag: string;
  name: string;
  category: "life_safety" | "building_system" | "vehicle_support";
  warrantyEndsAt: string;
  qualifiedVendorId: string;
  status: "in_service" | "commissioning" | "planned";
  evidenceClass: "synthetic_demo";
}

export type M34WorkOrderState =
  | "requested"
  | "triaged"
  | "assigned"
  | "in_progress"
  | "awaiting_inspection"
  | "completed"
  | "verified"
  | "reopened";

export interface M34WorkOrderEvent {
  id: string;
  workOrderId: string;
  fromState: M34WorkOrderState | null;
  toState: M34WorkOrderState;
  actorId: string;
  actorRole: UserRole;
  reason: string;
  occurredAt: string;
  evidenceIds: readonly string[];
  evidenceClass: "synthetic_demo";
}

export interface M34LaborEntry {
  id: string;
  workOrderId: string;
  technicianId: string;
  hours: number;
  performedAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M34MaterialEntry {
  id: string;
  workOrderId: string;
  inventoryItemId: string;
  quantity: number;
  issuedAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M34WorkOrder {
  id: string;
  stageId: string;
  assetId: string;
  requestType: "corrective" | "preventive" | "inspection";
  priority: "routine" | "urgent" | "critical";
  assignedVendorId: string;
  serviceLevelDueAt: string;
  finalState: "verified";
  reopenedCount: number;
  eventIds: readonly string[];
  laborEntryIds: readonly string[];
  materialEntryIds: readonly string[];
  inspectionEvidenceId: string;
  verificationEvidenceId: string;
  evidenceClass: "synthetic_demo";
}

export interface M34PreventiveMaintenancePlan {
  id: string;
  assetId: string;
  frequency: "monthly" | "quarterly" | "annual";
  qualifiedVendorId: string;
  warrantyVerified: true;
  lastCompletedAt: string;
  nextDueAt: string;
  generatedWorkOrderId: string;
  recurringInspectionId: string;
  evidenceClass: "synthetic_demo";
}

export interface M34AssetHistoryEvent {
  id: string;
  assetId: string;
  type: "commissioned" | "vendor_service" | "inspection" | "warranty_verified";
  sourceId: string;
  occurredAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M34Vendor {
  id: string;
  name: string;
  qualificationStatus: "qualified";
  insuranceExpiresAt: string;
  exclusionCheckedAt: string;
  approvedCategories: readonly string[];
  evidenceIds: readonly string[];
  evidenceClass: "synthetic_demo";
}

export type M34ProcurementState =
  | "requisitioned"
  | "approved"
  | "purchase_order_issued"
  | "received"
  | "invoice_received"
  | "matched"
  | "exception_opened"
  | "exception_resolved"
  | "payment_handoff";

export interface M34ProcurementEvent {
  id: string;
  procurementId: string;
  state: M34ProcurementState;
  actorId: string;
  actorRole: UserRole;
  amountCents: number;
  evidenceIds: readonly string[];
  occurredAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M34ProcurementCycle {
  id: string;
  vendorId: string;
  requisitionId: string;
  purchaseOrderId: string;
  receiptId: string;
  invoiceId: string;
  orderedAmountCents: number;
  receivedAmountCents: number;
  invoicedAmountCents: number;
  matchOutcome: "matched" | "exception_resolved";
  paymentHandoffId: string;
  eventIds: readonly string[];
  segregationOfDutiesPassed: true;
  evidenceClass: "synthetic_demo";
}

export interface M34InventoryItem {
  id: string;
  name: string;
  controlled: boolean;
  reorderThreshold: number;
  quantityOnHand: number;
  belowThreshold: boolean;
  custodianRole: UserRole;
  evidenceClass: "synthetic_demo";
}

export interface M34InventoryTransaction {
  id: string;
  itemId: string;
  type: "issue" | "return" | "cycle_count" | "variance_adjustment";
  quantity: number;
  expectedQuantity?: number;
  actualQuantity?: number;
  variance?: number;
  actorId: string;
  evidenceId: string;
  occurredAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M34SafetyDrill {
  id: string;
  stageId: string;
  type: "fire" | "severe_weather" | "medical_emergency";
  scheduledAt: string;
  completedAt: string;
  participantCount: number;
  evacuationMinutes: number;
  emergencyEquipmentIds: readonly string[];
  inspectionId: string;
  correctiveActionId: string;
  correctiveActionStatus: "verified_closed";
  evidenceIds: readonly string[];
  evidenceRetentionYears: 7;
  evidenceClass: "synthetic_demo";
}

export interface M34EmergencyEquipment {
  id: string;
  stageId: string;
  type: "fire_extinguisher" | "aed" | "emergency_generator";
  inspectionFrequency: "monthly" | "quarterly";
  lastInspectedAt: string;
  nextInspectionAt: string;
  status: "ready";
  evidenceId: string;
  evidenceClass: "synthetic_demo";
}

export interface M34Driver {
  id: string;
  licenseExpiresAt: string;
  backgroundStatus: "current";
  trainingStatus: "current";
  approved: true;
  evidenceClass: "synthetic_demo";
}

export interface M34Vehicle {
  id: string;
  fleetNumber: string;
  capacity: number;
  inspectionExpiresAt: string;
  insuranceExpiresAt: string;
  maintenanceDueAt: string;
  maintenanceStatus: "current";
  evidenceClass: "synthetic_demo";
}

export interface M34TransportTrip {
  id: string;
  requestId: string;
  driverId: string;
  vehicleId: string;
  stageId: string;
  scheduledDepartureAt: string;
  departedAt: string;
  returnedAt: string;
  status: "completed";
  incidentId: string | null;
  preTripEvidenceId: string;
  postTripEvidenceId: string;
  evidenceClass: "synthetic_demo";
}

export interface M34TransportIncident {
  id: string;
  tripId: string;
  severity: "minor";
  description: string;
  correctiveActionId: string;
  status: "closed";
  evidenceClass: "synthetic_demo";
}

export interface M34OutageEvent {
  id: string;
  stageId: string;
  sourceSystem: "synthetic_facility_monitor";
  classification: "unplanned" | "planned_excluded";
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  impactsAvailability: boolean;
  evidenceClass: "synthetic_demo";
}

export interface M34AvailabilityScheduleWindow {
  id: string;
  startedAt: string;
  endedAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M34UptimeBaseline {
  id: string;
  stageId: string;
  baselineStartAt: string;
  baselineEndAt: string;
  scheduleWindows: readonly M34AvailabilityScheduleWindow[];
  evidenceClass: "synthetic_demo";
}

export interface M34UptimeMeasurement {
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
  passed: true;
  formula: "((scheduled_service_minutes - qualifying_unplanned_downtime_minutes) / scheduled_service_minutes) * 100";
  scheduleWindowIds: readonly string[];
  sourceEventIds: readonly string[];
  excludedEventIds: readonly string[];
}

export interface M34WriteBoundary {
  mode: "evaluation_only";
  productionWritesBlocked: true;
  liveConnectorMutationsBlocked: true;
  allowedEvidenceClass: "synthetic_demo";
  blockedActionTypes: readonly string[];
}

export interface M34Snapshot {
  readonly [key: string]: unknown;
  generatedAt: typeof M34_FIXED_NOW;
  campusStages: readonly M34CampusStage[];
  sites: readonly M34Site[];
  spaces: readonly M34Space[];
  assets: readonly M34Asset[];
  workOrders: readonly M34WorkOrder[];
  workOrderEvents: readonly M34WorkOrderEvent[];
  laborEntries: readonly M34LaborEntry[];
  materialEntries: readonly M34MaterialEntry[];
  preventiveMaintenancePlans: readonly M34PreventiveMaintenancePlan[];
  assetHistory: readonly M34AssetHistoryEvent[];
  vendors: readonly M34Vendor[];
  procurementCycles: readonly M34ProcurementCycle[];
  procurementEvents: readonly M34ProcurementEvent[];
  inventoryItems: readonly M34InventoryItem[];
  inventoryTransactions: readonly M34InventoryTransaction[];
  safetyDrills: readonly M34SafetyDrill[];
  emergencyEquipment: readonly M34EmergencyEquipment[];
  drivers: readonly M34Driver[];
  vehicles: readonly M34Vehicle[];
  transportTrips: readonly M34TransportTrip[];
  transportIncidents: readonly M34TransportIncident[];
  uptimeBaseline: M34UptimeBaseline;
  outageEvents: readonly M34OutageEvent[];
  uptime: M34UptimeMeasurement;
  writeBoundary: M34WriteBoundary;
}

export interface M34ModuleResult extends Omit<
  Phase3ModuleResult,
  "milestone" | "domain" | "criteria" | "snapshot" | "auditEvents"
> {
  milestone: "M3.4";
  domain: "GAD";
  criteria: readonly Phase3CriterionResult[];
  snapshot: M34Snapshot;
  auditEvents: readonly Phase3AuditEvent[];
}

export interface M34WriteCandidate {
  id: string;
  evidenceClass: Phase3EvidenceClass;
}

/** Production-class and non-synthetic records fail closed in evaluation mode. */
export function assertM34SyntheticWrite(
  candidate: M34WriteCandidate,
): asserts candidate is M34WriteCandidate & {
  evidenceClass: "synthetic_demo";
} {
  if (candidate.evidenceClass !== "synthetic_demo") {
    throw new Error("M34_PRODUCTION_WRITE_BLOCKED");
  }
  if (!candidate.id.startsWith("SYNTH-")) {
    throw new Error("M34_NON_SYNTHETIC_ID_BLOCKED");
  }
}
