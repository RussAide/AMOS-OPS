import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery, auditLog } from "../middleware";
import { randomUUID } from "crypto";

// ═══════════════════════════════════════════════════════════════
// M7: GAD — General Administration
// ═══════════════════════════════════════════════════════════════

// ─── Seed Data ─────────────────────────────────────────────

interface WorkOrderRecord extends Record<string, unknown> {
  id: string;
  facility_id: string | null;
  vendor_id: string | null;
  status: string;
  priority: string;
  completed_at: string | null;
  due_date: string | null;
  wo_number: string;
  actual_cost: number | null;
  assigned_to: string | null;
  completion_notes?: string;
  created_at: string;
  updated_at: string;
}

interface FacilityRecord extends Record<string, unknown> {
  id: string;
  facility_name: string;
  bedrooms: number;
  common_areas: number;
  status: string;
  manager_id: string | null;
  current_occupancy?: number;
  notes?: string;
  updated_at?: string;
}

interface VendorRecord extends Record<string, unknown> {
  id: string;
  vendor_name: string;
  vendor_type: string;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  tax_id: string | null;
  payment_terms: string | null;
  status: string;
  rating: number | null;
  notes: string | null;
  contract_expiry: string | null;
  created_at: string;
}

interface ProcurementRecord extends Record<string, unknown> {
  id: string;
  request_number: string;
  facility_id: string | null;
  vendor_id: string | null;
  status: string;
  priority: string;
  estimated_total_cost: number;
  received_at: string | null;
  received_by: string | null;
  po_number: string | null;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface SafetyInspectionRecord extends Record<string, unknown> {
  id: string;
  facility_id: string;
  inspection_number: string;
  inspection_type: string;
  inspection_date: string;
  next_due_date: string | null;
  status: string;
  score: number | null;
  findings: string | null;
  corrective_actions: string | null;
  corrective_actions_completed: boolean;
  corrective_actions_completed_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  updated_at: string;
}

interface VendorContractRecord extends Record<string, unknown> {
  id: string;
  vendor_id: string;
  contract_number: string;
  status: string;
  end_date: string;
  value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const workOrdersStore: WorkOrderRecord[] = [];
const facilitiesStore: FacilityRecord[] = [];
const vendorsStore: VendorRecord[] = [];
const procurementStore: ProcurementRecord[] = [];
const safetyInspectionsStore: SafetyInspectionRecord[] = [];
const vendorContractsStore: VendorContractRecord[] = [];

function seedGAD() {
  if (workOrdersStore.length === 0) {
    workOrdersStore.push(
      { id: "wo1", wo_number: "WO-2026-001", title: "HVAC Repair — Wing B", description: "Air conditioning unit in Wing B common area not cooling properly. Temperature reached 82F.", work_type: "hvac", priority: "high", status: "in_progress", facility_id: "f1", vendor_id: "v1", assigned_to: "gad.ops@amos-ops.invalid", estimated_cost: 85000, actual_cost: null, requested_by: "rcs-lead@amos-ops.invalid", approved_by: "Demo Executive", due_date: "2026-07-02", completed_at: null, created_at: "2026-06-25T10:00:00Z", updated_at: "2026-06-26T14:00:00Z" },
      { id: "wo2", wo_number: "WO-2026-002", title: "Replace fire extinguisher — Wing B", description: "Fire extinguisher expired per safety audit AUD-2026-003. Replace with new 10lb ABC unit.", work_type: "safety", priority: "urgent", status: "completed", facility_id: "f1", vendor_id: "v2", assigned_to: "gad.ops@amos-ops.invalid", estimated_cost: 15000, actual_cost: 12500, requested_by: "gro.admin@amos-ops.invalid", approved_by: "Demo Executive", due_date: "2026-06-20", completed_at: "2026-06-19T14:00:00Z", created_at: "2026-06-18T09:00:00Z", updated_at: "2026-06-19T14:00:00Z" },
      { id: "wo3", wo_number: "WO-2026-003", title: "Plumbing leak — Kitchen sink", description: "Slow drain and minor leak under kitchen sink. Water damage to cabinet base.", work_type: "plumbing", priority: "medium", status: "open", facility_id: "f1", vendor_id: "v3", assigned_to: "gad.ops@amos-ops.invalid", estimated_cost: 35000, actual_cost: null, requested_by: "rcs-day@amos-ops.invalid", approved_by: null, due_date: "2026-07-05", completed_at: null, created_at: "2026-06-27T08:00:00Z", updated_at: "2026-06-27T08:00:00Z" },
      { id: "wo4", wo_number: "WO-2026-004", title: "Security camera upgrade", description: "Replace 4 analog cameras with IP cameras. Add coverage to courtyard blind spot.", work_type: "security", priority: "medium", status: "pending_parts", facility_id: "f1", vendor_id: "v4", assigned_to: "gad.ops@amos-ops.invalid", estimated_cost: 450000, actual_cost: null, requested_by: "Demo Executive", approved_by: "Demo Executive", due_date: "2026-07-15", completed_at: null, created_at: "2026-06-20T11:00:00Z", updated_at: "2026-06-28T09:00:00Z" },
      { id: "wo5", wo_number: "WO-2026-005", title: "Landscaping — Front entrance", description: "Refresh mulch, trim hedges, replace damaged plants at main entrance.", work_type: "grounds", priority: "low", status: "open", facility_id: "f1", vendor_id: "v5", assigned_to: "gad.ops@amos-ops.invalid", estimated_cost: 22000, actual_cost: null, requested_by: "gro.admin@amos-ops.invalid", approved_by: null, due_date: "2026-07-10", completed_at: null, created_at: "2026-06-26T13:00:00Z", updated_at: "2026-06-26T13:00:00Z" },
      { id: "wo6", wo_number: "WO-2026-006", title: "Generator monthly test", description: "Monthly load bank test for backup generator. Log results per fire marshal requirements.", work_type: "electrical", priority: "high", status: "completed", facility_id: "f1", vendor_id: "v6", assigned_to: "gad.ops@amos-ops.invalid", estimated_cost: 8000, actual_cost: 8000, requested_by: "gad.ops@amos-ops.invalid", approved_by: null, due_date: "2026-06-30", completed_at: "2026-06-28T10:00:00Z", created_at: "2026-06-28T08:00:00Z", updated_at: "2026-06-28T10:00:00Z" },
      { id: "wo7", wo_number: "WO-2026-007", title: "Paint — Common room refresh", description: "Repaint youth common room. Repair drywall damage near south wall.", work_type: "maintenance", priority: "low", status: "in_progress", facility_id: "f1", vendor_id: "v7", assigned_to: "gad.ops@amos-ops.invalid", estimated_cost: 180000, actual_cost: null, requested_by: "rcs-lead@amos-ops.invalid", approved_by: "Demo Executive", due_date: "2026-07-08", completed_at: null, created_at: "2026-06-24T09:00:00Z", updated_at: "2026-06-27T15:00:00Z" },
      { id: "wo8", wo_number: "WO-2026-008", title: "IT Network switch replacement", description: "Replace aging 24-port switch in server closet. Intermittent connectivity issues reported.", work_type: "it", priority: "high", status: "open", facility_id: "f1", vendor_id: null, assigned_to: "gad.ops@amos-ops.invalid", estimated_cost: 65000, actual_cost: null, requested_by: "Demo Executive", approved_by: "Demo Executive", due_date: "2026-07-03", completed_at: null, created_at: "2026-06-28T16:00:00Z", updated_at: "2026-06-28T16:00:00Z" },
    );
  }
  if (facilitiesStore.length === 0) {
    facilitiesStore.push(
      { id: "f1", facility_name: "BHC at Cypress — Main Campus", facility_code: "BHC-CYP-01", address: "12457 Cypress Center Blvd, Cypress, TX 77429", facility_type: "residential", total_sqft: 18500, bedrooms: 12, common_areas: 4, status: "active", built_year: 2018, last_inspection_date: "2026-06-18", next_inspection_date: "2026-12-18", manager_id: "u6", created_at: "2026-01-01" },
      { id: "f2", facility_name: "BHC at Cypress — Administrative Annex", facility_code: "BHC-CYP-02", address: "12459 Cypress Center Blvd, Cypress, TX 77429", facility_type: "administrative", total_sqft: 3200, bedrooms: 0, common_areas: 2, status: "active", built_year: 2018, last_inspection_date: "2026-05-15", next_inspection_date: "2026-11-15", manager_id: "u1", created_at: "2026-01-01" },
    );
  }
  if (vendorsStore.length === 0) {
    vendorsStore.push(
      { id: "v1", vendor_name: "Cypress Mechanical Services", vendor_type: "hvac", contact_person: "Synthetic Staff 02", contact_phone: "(281) 555-1100", contact_email: "service@example.invalid", address: "890 Industrial Dr, Cypress, TX 77429", tax_id: "SYNTH-TAX-001", payment_terms: "Net 30", status: "active", rating: 5, notes: "Preferred HVAC vendor. 24/7 emergency service.", contract_expiry: "2026-12-31", created_at: "2026-01-01" },
      { id: "v2", vendor_name: "Houston Safety Supply", vendor_type: "safety_equipment", contact_person: "Lisa Park", contact_phone: "(713) 555-2200", contact_email: "orders@example.invalid", address: "2200 Safety Way, Houston, TX 77001", tax_id: "SYNTH-TAX-002", payment_terms: "Net 15", status: "active", rating: 4, notes: "Fire safety equipment and inspections.", contract_expiry: "2027-03-31", created_at: "2026-01-01" },
      { id: "v3", vendor_name: "Cypress Plumbing Co", vendor_type: "plumbing", contact_person: "Jake Rivera", contact_phone: "(281) 555-3300", contact_email: "jobs@example.invalid", address: "456 Pipe Lane, Cypress, TX 77429", tax_id: "SYNTH-TAX-003", payment_terms: "Net 30", status: "active", rating: 4, notes: "General plumbing. Good response time.", contract_expiry: "2026-09-30", created_at: "2026-01-01" },
      { id: "v4", vendor_name: "SecureView Systems", vendor_type: "security", contact_person: "David Chen", contact_phone: "(832) 555-4400", contact_email: "install@example.invalid", address: "1200 Tech Blvd, Houston, TX 77002", tax_id: "SYNTH-TAX-004", payment_terms: "50% upfront, 50% on completion", status: "active", rating: 5, notes: "IP camera systems and access control.", contract_expiry: "2027-06-30", created_at: "2026-01-01" },
      { id: "v5", vendor_name: "GreenScape Cypress", vendor_type: "landscaping", contact_person: "Maria Green", contact_phone: "(281) 555-5500", contact_email: "service@example.invalid", address: "77 Garden Rd, Cypress, TX 77429", tax_id: "SYNTH-TAX-005", payment_terms: "Net 30", status: "active", rating: 4, notes: "Monthly landscaping maintenance.", contract_expiry: "2026-12-31", created_at: "2026-01-01" },
      { id: "v6", vendor_name: "PowerGuard Generator Services", vendor_type: "electrical", contact_person: "Robert Watts", contact_phone: "(713) 555-6600", contact_email: "service@example.invalid", address: "300 Power Ave, Houston, TX 77003", tax_id: "SYNTH-TAX-006", payment_terms: "Net 15", status: "active", rating: 5, notes: "Generator maintenance and load bank testing.", contract_expiry: "2027-01-31", created_at: "2026-01-01" },
      { id: "v7", vendor_name: "Cypress Painting & Drywall", vendor_type: "general_contractor", contact_person: "Ana Lopez", contact_phone: "(281) 555-7700", contact_email: "estimates@example.invalid", address: "55 Brush St, Cypress, TX 77429", tax_id: "SYNTH-TAX-007", payment_terms: "Net 30", status: "active", rating: 4, notes: "Interior painting and minor repairs.", contract_expiry: "2026-08-31", created_at: "2026-01-01" },
    );
  }
  if (procurementStore.length === 0) {
    procurementStore.push(
      { id: "pr1", request_number: "PR-2026-001", title: "Youth program laptops", description: "5 Chromebooks for youth education program", category: "technology", quantity: 5, estimated_unit_cost: 29900, estimated_total_cost: 149500, vendor_id: null, vendor_name: "Best Buy Business", facility_id: "f1", facility_name: "BHC at Cypress — Main Campus", requested_by: "program.director@amos-ops.invalid", requested_by_id: "u8", approved_by: null, approved_at: null, status: "submitted", priority: "high", justification: "Current devices are 4 years old, batteries failing", rejection_reason: null, po_number: null, received_at: null, received_by: null, notes: "Need before school semester starts", created_at: "2026-06-20T10:00:00Z", updated_at: "2026-06-20T10:00:00Z" },
      { id: "pr2", request_number: "PR-2026-002", title: "Office supplies Q3", description: "Quarterly restock of paper, toner, pens, folders", category: "supplies", quantity: 1, estimated_unit_cost: 45000, estimated_total_cost: 45000, vendor_id: "v2", vendor_name: "Houston Safety Supply", facility_id: "f2", facility_name: "BHC at Cypress — Administrative Annex", requested_by: "admin@amos-ops.invalid", requested_by_id: "u1", approved_by: "Demo Executive", approved_at: "2026-06-22T14:00:00Z", status: "approved", priority: "medium", justification: "Quarterly office supply replenishment", rejection_reason: null, po_number: null, received_at: null, received_by: null, notes: "", created_at: "2026-06-22T09:00:00Z", updated_at: "2026-06-22T14:00:00Z" },
      { id: "pr3", request_number: "PR-2026-003", title: "Dining room chairs", description: "Replace 12 damaged chairs in youth dining room", category: "furniture", quantity: 12, estimated_unit_cost: 8500, estimated_total_cost: 102000, vendor_id: null, vendor_name: "Office Depot", facility_id: "f1", facility_name: "BHC at Cypress — Main Campus", requested_by: "rcs-lead@amos-ops.invalid", requested_by_id: "u5", approved_by: "Demo Executive", approved_at: "2026-06-25T11:00:00Z", status: "ordered", priority: "medium", justification: "Safety hazard - chairs have broken legs", rejection_reason: null, po_number: "PO-2026-089", received_at: null, received_by: null, notes: "Delivery expected July 5", created_at: "2026-06-24T13:00:00Z", updated_at: "2026-06-26T09:00:00Z" },
      { id: "pr4", request_number: "PR-2026-004", title: "Generator annual service contract", description: "Annual maintenance contract for backup generator", category: "services", quantity: 1, estimated_unit_cost: 240000, estimated_total_cost: 240000, vendor_id: "v6", vendor_name: "PowerGuard Generator Services", facility_id: "f1", facility_name: "BHC at Cypress — Main Campus", requested_by: "gad.ops@amos-ops.invalid", requested_by_id: "u7", approved_by: "Demo Executive", approved_at: "2026-06-28T10:00:00Z", status: "received", priority: "high", justification: "Required per fire marshal, annual inspection due", rejection_reason: null, po_number: "PO-2026-092", received_at: "2026-06-28T10:00:00Z", received_by: "gad.ops@amos-ops.invalid", notes: "Contract renewed through June 2027", created_at: "2026-06-15T08:00:00Z", updated_at: "2026-06-28T10:00:00Z" },
      { id: "pr5", request_number: "PR-2026-005", title: "Kitchen fire suppression inspection", description: "Semi-annual Ansul system inspection and certification", category: "safety", quantity: 1, estimated_unit_cost: 35000, estimated_total_cost: 35000, vendor_id: "v2", vendor_name: "Houston Safety Supply", facility_id: "f1", facility_name: "BHC at Cypress — Main Campus", requested_by: "gad.ops@amos-ops.invalid", requested_by_id: "u7", approved_by: null, approved_at: null, status: "draft", priority: "urgent", justification: "Health department requirement, expires July 15", rejection_reason: null, po_number: null, received_at: null, received_by: null, notes: "Schedule ASAP", created_at: "2026-06-29T09:00:00Z", updated_at: "2026-06-29T09:00:00Z" },
    );
  }
  if (safetyInspectionsStore.length === 0) {
    safetyInspectionsStore.push(
      { id: "si1", inspection_number: "SI-2026-001", facility_id: "f1", facility_name: "BHC at Cypress — Main Campus", inspection_type: "extinguisher", inspected_by: "Lisa Park", inspected_by_id: null, inspection_date: "2026-06-19", next_due_date: "2026-07-19", frequency_days: 30, status: "passed", score: 100, checklist_json: JSON.stringify([{ item: "All units charged", pass: true }, { item: "Tags current", pass: true }, { item: "Access clear", pass: true }, { item: "Mounts secure", pass: true }]), findings: "All 18 units passed inspection.", corrective_actions: null, corrective_actions_completed: true, corrective_actions_completed_at: "2026-06-19", photos_json: null, reviewed_by: "gad.ops@amos-ops.invalid", reviewed_at: "2026-06-20", notes: "No issues found", created_at: "2026-06-19T10:00:00Z", updated_at: "2026-06-20T10:00:00Z" },
      { id: "si2", inspection_number: "SI-2026-002", facility_id: "f1", facility_name: "BHC at Cypress — Main Campus", inspection_type: "generator", inspected_by: "Robert Watts", inspected_by_id: null, inspection_date: "2026-06-28", next_due_date: "2026-07-28", frequency_days: 30, status: "passed", score: 95, checklist_json: JSON.stringify([{ item: "Load bank test", pass: true }, { item: "Oil level", pass: true }, { item: "Coolant level", pass: true }, { item: "Battery voltage", pass: true }, { item: "Transfer switch", pass: true }, { item: "Run time 30min", pass: false }]), findings: "Generator started and carried load. Runtime test incomplete - reached 22 minutes before automatic shutdown.", corrective_actions: "Schedule extended runtime test. Check fuel filter.", corrective_actions_completed: false, corrective_actions_completed_at: null, photos_json: null, reviewed_by: null, reviewed_at: null, notes: "Minor runtime issue", created_at: "2026-06-28T10:00:00Z", updated_at: "2026-06-28T10:00:00Z" },
      { id: "si3", inspection_number: "SI-2026-003", facility_id: "f1", facility_name: "BHC at Cypress — Main Campus", inspection_type: "sprinkler", inspected_by: "Houston Fire Marshal", inspected_by_id: null, inspection_date: "2026-06-01", next_due_date: "2026-08-01", frequency_days: 60, status: "passed_with_notes", score: 88, checklist_json: JSON.stringify([{ item: "Water flow alarm", pass: true }, { item: "Valve tamper switches", pass: true }, { item: "Head condition", pass: true }, { item: "Pipe condition", pass: true }, { item: "Gauge readings", pass: false }, { item: "Drain test", pass: true }]), findings: "One pressure gauge reading 5 PSI below spec. All other components passed.", corrective_actions: "Replace pressure gauge on Zone 3 riser.", corrective_actions_completed: true, corrective_actions_completed_at: "2026-06-05", photos_json: null, reviewed_by: "gad.ops@amos-ops.invalid", reviewed_at: "2026-06-06", notes: "Gauge replaced, re-inspection passed", created_at: "2026-06-01T09:00:00Z", updated_at: "2026-06-06T10:00:00Z" },
      { id: "si4", inspection_number: "SI-2026-004", facility_id: "f1", facility_name: "BHC at Cypress — Main Campus", inspection_type: "emergency_lighting", inspected_by: "gad.ops@amos-ops.invalid", inspected_by_id: null, inspection_date: "2026-04-15", next_due_date: "2026-07-15", frequency_days: 90, status: "failed", score: 72, checklist_json: JSON.stringify([{ item: "90-minute test", pass: false }, { item: "Exit sign illumination", pass: true }, { item: "Battery backup", pass: false }, { item: "Bulb condition", pass: true }, { item: "Coverage adequacy", pass: true }]), findings: "3 of 12 units failed 90-minute runtime test. 2 units had weak battery backup.", corrective_actions: "Replace batteries in units EL-03, EL-07, EL-11. Replace full units EL-05, EL-09.", corrective_actions_completed: false, corrective_actions_completed_at: null, photos_json: null, reviewed_by: null, reviewed_at: null, notes: "Parts on order", created_at: "2026-04-15T14:00:00Z", updated_at: "2026-04-15T14:00:00Z" },
    );
  }
  if (vendorContractsStore.length === 0) {
    vendorContractsStore.push(
      { id: "vc1", vendor_id: "v1", contract_number: "VC-2026-001", contract_type: "service_agreement", start_date: "2026-01-01", end_date: "2026-12-31", value: 1200000, payment_terms: "Monthly, Net 15", auto_renew: true, renewal_terms: "Auto-renew for 1 year unless 60-day notice given", termination_notice_days: 60, status: "active", scope_of_work: "HVAC maintenance, repair, and emergency service for all campus buildings", documents_json: null, primary_contact_name: "Synthetic Staff 02", primary_contact_email: "service@example.invalid", primary_contact_phone: "(281) 555-1100", notes: "Includes 24/7 emergency service", created_at: "2026-01-01", updated_at: "2026-01-01" },
      { id: "vc2", vendor_id: "v6", contract_number: "VC-2026-002", contract_type: "maintenance", start_date: "2026-07-01", end_date: "2027-06-30", value: 240000, payment_terms: "Annual, Net 15", auto_renew: true, renewal_terms: "Auto-renew for 1 year unless 30-day notice given", termination_notice_days: 30, status: "active", scope_of_work: "Monthly generator load bank testing, quarterly maintenance, annual certification", documents_json: null, primary_contact_name: "Robert Watts", primary_contact_email: "service@example.invalid", primary_contact_phone: "(713) 555-6600", notes: "Just renewed via PR-2026-004", created_at: "2026-07-01", updated_at: "2026-07-01" },
      { id: "vc3", vendor_id: "v4", contract_number: "VC-2026-003", contract_type: "service_agreement", start_date: "2026-07-01", end_date: "2027-06-30", value: 1800000, payment_terms: "Quarterly, 50% upfront", auto_renew: false, renewal_terms: "Requires new quote for renewal", termination_notice_days: 90, status: "active", scope_of_work: "Security camera system: installation, monitoring, maintenance, cloud storage", documents_json: null, primary_contact_name: "David Chen", primary_contact_email: "install@example.invalid", primary_contact_phone: "(832) 555-4400", notes: "Phase 2 camera upgrade in progress", created_at: "2026-07-01", updated_at: "2026-07-01" },
    );
  }
}
seedGAD();

export const m7Router = createRouter({
  // ════════════════════════════════════════════════════════════
  // 1. FACILITY READINESS
  // ════════════════════════════════════════════════════════════

  listFacilities: publicQuery.query(() => {
    return [...facilitiesStore];
  }),

  getFacility: authedQuery
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const facility = facilitiesStore.find((f) => f.id === input.id);
      if (!facility) throw new Error("Facility not found");
      // Get work orders for this facility
      const facilityWorkOrders = workOrdersStore.filter((w) => w.facility_id === input.id);
      // Get safety inspections for this facility
      const facilityInspections = safetyInspectionsStore
        .filter((s) => s.facility_id === input.id)
        .sort((a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime());
      // Get procurement requests for this facility
      const facilityProcurement = procurementStore.filter((p) => p.facility_id === input.id);
      // Get upcoming inspections (next 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const upcomingInspections = facilityInspections.filter((s) => {
        if (!s.next_due_date) return false;
        const due = new Date(s.next_due_date);
        return due >= now && due <= thirtyDaysFromNow;
      });
      // Inspections by type
      const inspectionsByType = facilityInspections.reduce((acc: Record<string, SafetyInspectionRecord[]>, s) => {
        if (!acc[s.inspection_type]) acc[s.inspection_type] = [];
        acc[s.inspection_type].push(s);
        return acc;
      }, {});
      // Open work orders
      const openWO = facilityWorkOrders.filter((w) => w.status !== "completed" && w.status !== "cancelled");
      return {
        ...facility,
        workOrders: facilityWorkOrders,
        openWorkOrderCount: openWO.length,
        inspections: facilityInspections,
        upcomingInspections,
        inspectionsByType,
        procurementRequests: facilityProcurement,
        readinessScore: computeReadinessScore(facility, facilityInspections, openWO),
      };
    }),

  updateFacility: authedQuery
    .input(z.object({
      id: z.string(),
      status: z.string().optional(),
      currentOccupancy: z.number().optional(),
      notes: z.string().optional(),
      managerId: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const facility = facilitiesStore.find((f) => f.id === input.id);
      if (!facility) throw new Error("Facility not found");
      if (input.status !== undefined) facility.status = input.status;
      if (input.currentOccupancy !== undefined) facility.current_occupancy = input.currentOccupancy;
      if (input.notes !== undefined) facility.notes = input.notes;
      if (input.managerId !== undefined) facility.manager_id = input.managerId;
      facility.updated_at = new Date().toISOString();
      auditLog({ action: "m7:updateFacility", actor, resource: `facility:${input.id}` });
      return { success: true, facility };
    }),

  // ════════════════════════════════════════════════════════════
  // 2. MAINTENANCE TICKETING (Work Orders)
  // ════════════════════════════════════════════════════════════

  listWorkOrders: authedQuery
    .input(z.object({ status: z.string().optional(), priority: z.string().optional(), facilityId: z.string().optional() }).optional())
    .query(({ input }) => {
      let results = [...workOrdersStore];
      if (input?.status) results = results.filter((w) => w.status === input.status);
      if (input?.priority) results = results.filter((w) => w.priority === input.priority);
      if (input?.facilityId) results = results.filter((w) => w.facility_id === input.facilityId);
      return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }),

  getWorkOrder: authedQuery
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const wo = workOrdersStore.find((w) => w.id === input.id);
      if (!wo) throw new Error("Work order not found");
      // Get vendor info
      const vendor = vendorsStore.find((v) => v.id === wo.vendor_id);
      // Get facility info
      const facility = facilitiesStore.find((f) => f.id === wo.facility_id);
      return { ...wo, vendor: vendor ?? null, facility: facility ?? null };
    }),

  createWorkOrder: authedQuery
    .input(z.object({
      title: z.string().min(1), description: z.string().min(1),
      workType: z.string(), priority: z.enum(["low", "medium", "high", "urgent"]),
      facilityId: z.string().optional(), vendorId: z.string().optional(),
      assignedTo: z.string().optional(), estimatedCost: z.number().optional(),
      dueDate: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const woNumber = `WO-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900)).padStart(3, "0")}`;
      const now = new Date().toISOString();

      workOrdersStore.push({
        id, wo_number: woNumber, title: input.title, description: input.description,
        work_type: input.workType, priority: input.priority, status: "open",
        facility_id: input.facilityId ?? null, vendor_id: input.vendorId ?? null,
        assigned_to: input.assignedTo ?? null, estimated_cost: input.estimatedCost ?? null,
        actual_cost: null, requested_by: actor, approved_by: null,
        due_date: input.dueDate ?? null, completed_at: null,
        created_at: now, updated_at: now,
      });

      auditLog({ action: "m7:createWorkOrder", actor, resource: `wo:${woNumber}`, details: `Created: ${input.title}` });
      return { success: true, id, woNumber };
    }),

  updateWorkOrder: authedQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["open", "in_progress", "pending_parts", "completed", "cancelled"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      actualCost: z.number().optional(),
      assignedTo: z.string().optional(),
      completionNotes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const wo = workOrdersStore.find((w) => w.id === input.id);
      if (!wo) throw new Error("Work order not found");

      if (input.status !== undefined) {
        wo.status = input.status;
        if (input.status === "completed") wo.completed_at = new Date().toISOString();
      }
      if (input.priority !== undefined) wo.priority = input.priority;
      if (input.actualCost !== undefined) wo.actual_cost = input.actualCost;
      if (input.assignedTo !== undefined) wo.assigned_to = input.assignedTo;
      if (input.completionNotes !== undefined) wo.completion_notes = input.completionNotes;
      wo.updated_at = new Date().toISOString();

      auditLog({ action: "m7:updateWorkOrder", actor, resource: `wo:${wo.wo_number}` });
      return { success: true, workOrder: wo };
    }),

  deleteWorkOrder: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const idx = workOrdersStore.findIndex((w) => w.id === input.id);
      if (idx === -1) throw new Error("Work order not found");
      const wo = workOrdersStore[idx];
      workOrdersStore.splice(idx, 1);
      auditLog({ action: "m7:deleteWorkOrder", actor, resource: `wo:${wo.wo_number}` });
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // 3. PROCUREMENT LOGGING
  // ════════════════════════════════════════════════════════════

  listProcurement: authedQuery
    .input(z.object({ status: z.string().optional(), priority: z.string().optional(), facilityId: z.string().optional() }).optional())
    .query(({ input }) => {
      let results = [...procurementStore];
      if (input?.status) results = results.filter((p) => p.status === input.status);
      if (input?.priority) results = results.filter((p) => p.priority === input.priority);
      if (input?.facilityId) results = results.filter((p) => p.facility_id === input.facilityId);
      return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }),

  getProcurementRequest: authedQuery
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const pr = procurementStore.find((p) => p.id === input.id);
      if (!pr) throw new Error("Procurement request not found");
      const vendor = vendorsStore.find((v) => v.id === pr.vendor_id);
      const facility = facilitiesStore.find((f) => f.id === pr.facility_id);
      return { ...pr, vendor: vendor ?? null, facility: facility ?? null };
    }),

  createProcurementRequest: authedQuery
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.enum(["equipment", "supplies", "services", "furniture", "technology", "safety", "other"]).default("supplies"),
      quantity: z.number().min(1).default(1),
      estimatedUnitCost: z.number().optional(),
      vendorId: z.string().optional(),
      vendorName: z.string().optional(),
      facilityId: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      justification: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const prNumber = `PR-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900)).padStart(3, "0")}`;
      const now = new Date().toISOString();
      const facility = facilitiesStore.find((f) => f.id === input.facilityId);
      const vendor = vendorsStore.find((v) => v.id === input.vendorId);
      const estUnitCost = input.estimatedUnitCost ?? 0;
      const estTotal = estUnitCost * input.quantity;

      procurementStore.push({
        id, request_number: prNumber, title: input.title, description: input.description ?? null,
        category: input.category, quantity: input.quantity, estimated_unit_cost: estUnitCost,
        estimated_total_cost: estTotal, vendor_id: input.vendorId ?? null,
        vendor_name: input.vendorName ?? vendor?.vendor_name ?? null,
        facility_id: input.facilityId ?? null, facility_name: facility?.facility_name ?? null,
        requested_by: actor, requested_by_id: ctx.user?.id ?? null,
        approved_by: null, approved_at: null, status: "draft", priority: input.priority,
        justification: input.justification ?? null, rejection_reason: null,
        po_number: null, received_at: null, received_by: null, notes: input.notes ?? null,
        created_at: now, updated_at: now,
      });

      auditLog({ action: "m7:createProcurement", actor, resource: `pr:${prNumber}`, details: `Created: ${input.title}` });
      return { success: true, id, prNumber };
    }),

  updateProcurementRequest: authedQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["draft", "submitted", "under_review", "approved", "rejected", "ordered", "received", "cancelled"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      poNumber: z.string().optional(),
      approved: z.boolean().optional(),
      rejectionReason: z.string().optional(),
      notes: z.string().optional(),
      actualCost: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const pr = procurementStore.find((p) => p.id === input.id);
      if (!pr) throw new Error("Procurement request not found");

      if (input.status !== undefined) {
        pr.status = input.status;
        if (input.status === "received") {
          pr.received_at = new Date().toISOString();
          pr.received_by = actor;
        }
      }
      if (input.priority !== undefined) pr.priority = input.priority;
      if (input.poNumber !== undefined) pr.po_number = input.poNumber;
      if (input.notes !== undefined) pr.notes = input.notes;
      if (input.actualCost !== undefined) pr.estimated_total_cost = input.actualCost;
      if (input.approved !== undefined) {
        if (input.approved) {
          pr.approved_by = actor;
          pr.approved_at = new Date().toISOString();
          pr.status = "approved";
        } else {
          pr.status = "rejected";
          if (input.rejectionReason) pr.rejection_reason = input.rejectionReason;
        }
      }
      pr.updated_at = new Date().toISOString();

      auditLog({ action: "m7:updateProcurement", actor, resource: `pr:${pr.request_number}` });
      return { success: true, procurement: pr };
    }),

  deleteProcurementRequest: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const idx = procurementStore.findIndex((p) => p.id === input.id);
      if (idx === -1) throw new Error("Procurement request not found");
      const pr = procurementStore[idx];
      procurementStore.splice(idx, 1);
      auditLog({ action: "m7:deleteProcurement", actor, resource: `pr:${pr.request_number}` });
      return { success: true };
    }),

  // ════════════════════════════════════════════════════════════
  // 4. VENDOR TRACKING
  // ════════════════════════════════════════════════════════════

  listVendors: authedQuery
    .input(z.object({ status: z.string().optional(), type: z.string().optional() }).optional())
    .query(({ input }) => {
      let results = [...vendorsStore];
      if (input?.status) results = results.filter((v) => v.status === input.status);
      if (input?.type) results = results.filter((v) => v.vendor_type === input.type);
      return results;
    }),

  getVendor: authedQuery
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const vendor = vendorsStore.find((v) => v.id === input.id);
      if (!vendor) throw new Error("Vendor not found");
      // Get vendor contracts
      const contracts = vendorContractsStore.filter((c) => c.vendor_id === input.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      // Get work orders linked to this vendor
      const vendorWorkOrders = workOrdersStore.filter((w) => w.vendor_id === input.id);
      // Get procurement requests linked to this vendor
      const vendorProcurement = procurementStore.filter((p) => p.vendor_id === input.id);
      return {
        ...vendor,
        contracts,
        contractCount: contracts.length,
        workOrders: vendorWorkOrders,
        procurementRequests: vendorProcurement,
      };
    }),

  createVendor: authedQuery
    .input(z.object({
      vendorName: z.string().min(1),
      vendorType: z.string(),
      contactPerson: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      address: z.string().optional(),
      taxId: z.string().optional(),
      paymentTerms: z.string().optional(),
      rating: z.number().min(1).max(5).optional(),
      notes: z.string().optional(),
      contractExpiry: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();

      vendorsStore.push({
        id, vendor_name: input.vendorName, vendor_type: input.vendorType,
        contact_person: input.contactPerson ?? null, contact_phone: input.contactPhone ?? null,
        contact_email: input.contactEmail ?? null, address: input.address ?? null,
        tax_id: input.taxId ?? null, payment_terms: input.paymentTerms ?? null,
        status: "active", rating: input.rating ?? null, notes: input.notes ?? null,
        contract_expiry: input.contractExpiry ?? null, created_at: now,
      });

      auditLog({ action: "m7:createVendor", actor, resource: `vendor:${input.vendorName}` });
      return { success: true, id };
    }),

  updateVendor: authedQuery
    .input(z.object({
      id: z.string(),
      vendorName: z.string().optional(),
      vendorType: z.string().optional(),
      contactPerson: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      address: z.string().optional(),
      taxId: z.string().optional(),
      paymentTerms: z.string().optional(),
      rating: z.number().min(1).max(5).optional(),
      notes: z.string().optional(),
      contractExpiry: z.string().optional(),
      status: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const vendor = vendorsStore.find((v) => v.id === input.id);
      if (!vendor) throw new Error("Vendor not found");

      if (input.vendorName !== undefined) vendor.vendor_name = input.vendorName;
      if (input.vendorType !== undefined) vendor.vendor_type = input.vendorType;
      if (input.contactPerson !== undefined) vendor.contact_person = input.contactPerson;
      if (input.contactPhone !== undefined) vendor.contact_phone = input.contactPhone;
      if (input.contactEmail !== undefined) vendor.contact_email = input.contactEmail;
      if (input.address !== undefined) vendor.address = input.address;
      if (input.taxId !== undefined) vendor.tax_id = input.taxId;
      if (input.paymentTerms !== undefined) vendor.payment_terms = input.paymentTerms;
      if (input.rating !== undefined) vendor.rating = input.rating;
      if (input.notes !== undefined) vendor.notes = input.notes;
      if (input.contractExpiry !== undefined) vendor.contract_expiry = input.contractExpiry;
      if (input.status !== undefined) vendor.status = input.status;

      auditLog({ action: "m7:updateVendor", actor, resource: `vendor:${vendor.vendor_name}` });
      return { success: true, vendor };
    }),

  // ─── Vendor Contracts ──────────────────────────────────────

  listVendorContracts: authedQuery
    .input(z.object({ vendorId: z.string().optional(), status: z.string().optional() }).optional())
    .query(({ input }) => {
      let results = [...vendorContractsStore];
      if (input?.vendorId) results = results.filter((c) => c.vendor_id === input.vendorId);
      if (input?.status) results = results.filter((c) => c.status === input.status);
      // Enrich with vendor names
      return results.map((c) => {
        const vendor = vendorsStore.find((v) => v.id === c.vendor_id);
        return { ...c, vendor_name: vendor?.vendor_name ?? "Unknown" };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }),

  createVendorContract: authedQuery
    .input(z.object({
      vendorId: z.string(),
      contractType: z.enum(["service_agreement", "purchase_order", "maintenance", "warranty", "insurance", "lease", "other"]).default("service_agreement"),
      startDate: z.string(),
      endDate: z.string(),
      value: z.number().optional(),
      paymentTerms: z.string().optional(),
      autoRenew: z.boolean().default(false),
      scopeOfWork: z.string().optional(),
      primaryContactName: z.string().optional(),
      primaryContactEmail: z.string().optional(),
      primaryContactPhone: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const contractNumber = `VC-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900)).padStart(3, "0")}`;
      const now = new Date().toISOString();

      vendorContractsStore.push({
        id, vendor_id: input.vendorId, contract_number: contractNumber,
        contract_type: input.contractType, start_date: input.startDate,
        end_date: input.endDate, value: input.value ?? null,
        payment_terms: input.paymentTerms ?? null, auto_renew: input.autoRenew ? 1 : 0,
        scope_of_work: input.scopeOfWork ?? null, status: "active",
        primary_contact_name: input.primaryContactName ?? null,
        primary_contact_email: input.primaryContactEmail ?? null,
        primary_contact_phone: input.primaryContactPhone ?? null,
        notes: input.notes ?? null, created_at: now, updated_at: now,
      });

      auditLog({ action: "m7:createVendorContract", actor, resource: `contract:${contractNumber}` });
      return { success: true, id, contractNumber };
    }),

  updateVendorContract: authedQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["draft", "active", "expiring", "expired", "terminated", "pending_renewal"]).optional(),
      endDate: z.string().optional(),
      value: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const contract = vendorContractsStore.find((c) => c.id === input.id);
      if (!contract) throw new Error("Contract not found");
      if (input.status !== undefined) contract.status = input.status;
      if (input.endDate !== undefined) contract.end_date = input.endDate;
      if (input.value !== undefined) contract.value = input.value;
      if (input.notes !== undefined) contract.notes = input.notes;
      contract.updated_at = new Date().toISOString();
      auditLog({ action: "m7:updateVendorContract", actor, resource: `contract:${contract.contract_number}` });
      return { success: true, contract };
    }),

  // ════════════════════════════════════════════════════════════
  // 5. SAFETY READINESS
  // ════════════════════════════════════════════════════════════

  listSafetyInspections: authedQuery
    .input(z.object({ facilityId: z.string().optional(), type: z.string().optional(), status: z.string().optional() }).optional())
    .query(({ input }) => {
      let results = [...safetyInspectionsStore];
      if (input?.facilityId) results = results.filter((s) => s.facility_id === input.facilityId);
      if (input?.type) results = results.filter((s) => s.inspection_type === input.type);
      if (input?.status) results = results.filter((s) => s.status === input.status);
      return results.sort((a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime());
    }),

  getSafetyInspection: authedQuery
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const inspection = safetyInspectionsStore.find((s) => s.id === input.id);
      if (!inspection) throw new Error("Safety inspection not found");
      const facility = facilitiesStore.find((f) => f.id === inspection.facility_id);
      return { ...inspection, facility: facility ?? null };
    }),

  createSafetyInspection: authedQuery
    .input(z.object({
      facilityId: z.string(),
      inspectionType: z.enum(["fire_safety", "sprinkler", "emergency_lighting", "generator", "extinguisher", "hvac", "electrical", "plumbing", "security", "grounds", "food_service", "general"]),
      inspectedBy: z.string().min(1),
      inspectionDate: z.string(),
      nextDueDate: z.string().optional(),
      frequencyDays: z.number().default(90),
      score: z.number().min(0).max(100).optional(),
      checklistJson: z.string().optional(),
      findings: z.string().optional(),
      correctiveActions: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const siNumber = `SI-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900)).padStart(3, "0")}`;
      const now = new Date().toISOString();
      const facility = facilitiesStore.find((f) => f.id === input.facilityId);

      safetyInspectionsStore.push({
        id, inspection_number: siNumber, facility_id: input.facilityId,
        facility_name: facility?.facility_name ?? "Unknown",
        inspection_type: input.inspectionType, inspected_by: input.inspectedBy,
        inspected_by_id: ctx.user?.id ?? null, inspection_date: input.inspectionDate,
        next_due_date: input.nextDueDate ?? null, frequency_days: input.frequencyDays,
        status: "pending", score: input.score ?? null,
        checklist_json: input.checklistJson ?? "[]",
        findings: input.findings ?? null, corrective_actions: input.correctiveActions ?? null,
        corrective_actions_completed: false, corrective_actions_completed_at: null,
        photos_json: null, reviewed_by: null, reviewed_at: null,
        notes: input.notes ?? null, created_at: now, updated_at: now,
      });

      auditLog({ action: "m7:createSafetyInspection", actor, resource: `si:${siNumber}` });
      return { success: true, id, siNumber };
    }),

  updateSafetyInspection: authedQuery
    .input(z.object({
      id: z.string(),
      status: z.enum(["passed", "passed_with_notes", "failed", "pending", "overdue"]).optional(),
      score: z.number().min(0).max(100).optional(),
      findings: z.string().optional(),
      correctiveActions: z.string().optional(),
      correctiveActionsCompleted: z.boolean().optional(),
      nextDueDate: z.string().optional(),
      notes: z.string().optional(),
      reviewed: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const inspection = safetyInspectionsStore.find((s) => s.id === input.id);
      if (!inspection) throw new Error("Safety inspection not found");

      if (input.status !== undefined) inspection.status = input.status;
      if (input.score !== undefined) inspection.score = input.score;
      if (input.findings !== undefined) inspection.findings = input.findings;
      if (input.correctiveActions !== undefined) inspection.corrective_actions = input.correctiveActions;
      if (input.correctiveActionsCompleted !== undefined) {
        inspection.corrective_actions_completed = input.correctiveActionsCompleted;
        if (input.correctiveActionsCompleted) {
          inspection.corrective_actions_completed_at = new Date().toISOString();
        }
      }
      if (input.nextDueDate !== undefined) inspection.next_due_date = input.nextDueDate;
      if (input.notes !== undefined) inspection.notes = input.notes;
      if (input.reviewed !== undefined && input.reviewed) {
        inspection.reviewed_by = actor;
        inspection.reviewed_at = new Date().toISOString();
      }
      inspection.updated_at = new Date().toISOString();

      auditLog({ action: "m7:updateSafetyInspection", actor, resource: `si:${inspection.inspection_number}` });
      return { success: true, inspection };
    }),

  deleteSafetyInspection: adminQuery
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const idx = safetyInspectionsStore.findIndex((s) => s.id === input.id);
      if (idx === -1) throw new Error("Safety inspection not found");
      const si = safetyInspectionsStore[idx];
      safetyInspectionsStore.splice(idx, 1);
      auditLog({ action: "m7:deleteSafetyInspection", actor, resource: `si:${si.inspection_number}` });
      return { success: true };
    }),

  // ─── Safety Dashboard KPIs ─────────────────────────────────

  safetyKPIs: authedQuery.query(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const totalInspections = safetyInspectionsStore.length;
    const passed = safetyInspectionsStore.filter((s) => s.status === "passed").length;
    const passedWithNotes = safetyInspectionsStore.filter((s) => s.status === "passed_with_notes").length;
    const failed = safetyInspectionsStore.filter((s) => s.status === "failed").length;
    const overdue = safetyInspectionsStore.filter((s) => {
      if (!s.next_due_date) return false;
      return new Date(s.next_due_date) < now && s.status !== "passed";
    }).length;
    const upcomingDue = safetyInspectionsStore.filter((s) => {
      if (!s.next_due_date) return false;
      const due = new Date(s.next_due_date);
      return due >= now && due <= thirtyDaysFromNow;
    }).length;
    const pendingCorrective = safetyInspectionsStore.filter(
      (s) => s.corrective_actions && !s.corrective_actions_completed
    ).length;
    const avgScore = totalInspections > 0
      ? Math.round(safetyInspectionsStore.reduce((sum, s) => sum + (s.score ?? 0), 0) / totalInspections)
      : 0;

    // By type
    const byType: Record<string, { total: number; passed: number; failed: number; overdue: number }> = {};
    for (const s of safetyInspectionsStore) {
      if (!byType[s.inspection_type]) byType[s.inspection_type] = { total: 0, passed: 0, failed: 0, overdue: 0 };
      byType[s.inspection_type].total++;
      if (s.status === "passed") byType[s.inspection_type].passed++;
      if (s.status === "failed") byType[s.inspection_type].failed++;
      if (s.next_due_date && new Date(s.next_due_date) < now) byType[s.inspection_type].overdue++;
    }

    return {
      totalInspections, passed, passedWithNotes, failed, overdue,
      upcomingDue, pendingCorrective, avgScore, byType,
    };
  }),

  // ════════════════════════════════════════════════════════════
  // DASHBOARD KPIs
  // ════════════════════════════════════════════════════════════

  dashboardKPIs: publicQuery.query(() => {
    const openWorkOrders = workOrdersStore.filter((w) => w.status === "open").length;
    const inProgressWorkOrders = workOrdersStore.filter((w) => w.status === "in_progress").length;
    const pendingPartsWorkOrders = workOrdersStore.filter((w) => w.status === "pending_parts").length;
    const completedThisMonth = workOrdersStore.filter((w) => {
      if (!w.completed_at) return false;
      const completed = new Date(w.completed_at);
      const now = new Date();
      return completed.getMonth() === now.getMonth() && completed.getFullYear() === now.getFullYear();
    }).length;
    const overdueWorkOrders = workOrdersStore.filter((w) => {
      if (w.status === "completed" || w.status === "cancelled") return false;
      if (!w.due_date) return false;
      return new Date(w.due_date) < new Date();
    }).length;
    const urgentHighCount = workOrdersStore.filter((w) => (w.priority === "urgent" || w.priority === "high") && w.status !== "completed" && w.status !== "cancelled").length;

    // Procurement KPIs
    const pendingProcurement = procurementStore.filter((p) => p.status === "submitted" || p.status === "under_review").length;
    const approvedProcurement = procurementStore.filter((p) => p.status === "approved").length;
    const totalProcurementValue = procurementStore.reduce((sum, p) => sum + (p.estimated_total_cost ?? 0), 0);

    // Safety KPIs
    const now = new Date();
    const safetyFailed = safetyInspectionsStore.filter((s) => s.status === "failed").length;
    const safetyOverdue = safetyInspectionsStore.filter((s) => {
      if (!s.next_due_date) return false;
      return new Date(s.next_due_date) < now;
    }).length;
    const pendingCorrective = safetyInspectionsStore.filter(
      (s) => s.corrective_actions && !s.corrective_actions_completed
    ).length;

    // Contract KPIs
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringContracts = vendorContractsStore.filter((c) => {
      if (!c.end_date) return false;
      const end = new Date(c.end_date);
      return end >= now && end <= thirtyDaysFromNow;
    }).length;

    return {
      facilityCount: facilitiesStore.length,
      vendorCount: vendorsStore.length,
      openWorkOrders, inProgressWorkOrders, pendingPartsWorkOrders,
      completedThisMonth, overdueWorkOrders, urgentHighCount,
      totalWorkOrders: workOrdersStore.length,
      // Procurement
      pendingProcurement,
      approvedProcurement,
      totalProcurementValue,
      procurementCount: procurementStore.length,
      // Safety
      safetyFailed,
      safetyOverdue,
      pendingCorrective,
      totalSafetyInspections: safetyInspectionsStore.length,
      // Contracts
      expiringContracts,
      totalContracts: vendorContractsStore.length,
    };
  }),
});

// ─── Helpers ─────────────────────────────────────────────────

function computeReadinessScore(
  facility: FacilityRecord,
  inspections: SafetyInspectionRecord[],
  openWorkOrders: WorkOrderRecord[],
): number {
  let score = 100;

  // Deduct for overdue inspections (max -30)
  const now = new Date();
  const overdueCount = inspections.filter((s) => {
    if (!s.next_due_date) return false;
    return new Date(s.next_due_date) < now;
  }).length;
  score -= Math.min(overdueCount * 10, 30);

  // Deduct for failed inspections (max -20)
  const failedCount = inspections.filter((s) => s.status === "failed").length;
  score -= Math.min(failedCount * 10, 20);

  // Deduct for open work orders (max -20)
  score -= Math.min(openWorkOrders.length * 5, 20);

  // Deduct for pending corrective actions (max -15)
  const pendingCorrective = inspections.filter(
    (s) => s.corrective_actions && !s.corrective_actions_completed
  ).length;
  score -= Math.min(pendingCorrective * 5, 15);

  // Boost for active status
  if (facility.status !== "active") score -= 15;

  return Math.max(0, Math.min(100, score));
}
