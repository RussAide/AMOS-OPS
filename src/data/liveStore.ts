// ═══════════════════════════════════════════════════════════════════
// AMOS-OPS Live Data Store — Full CRUD for All Modules
// ═══════════════════════════════════════════════════════════════════

import { SEED_YOUTH, SEED_MEDICATIONS, SEED_SHIFTS, SEED_BEHAVIORAL_OBS, SEED_FAMILY_CONTACTS, generateBeds } from "./residentialSeedData";

function deepClone<T>(obj: T): T { return JSON.parse(JSON.stringify(obj)); }

let _id = 9000;
export const nextId = (p: string) => `${p}${++_id}`;

// ═══════════════════════════════════════════════════════════════
// INITIAL DATA
// ═══════════════════════════════════════════════════════════════

const _youth = deepClone(SEED_YOUTH);
const _meds = deepClone(SEED_MEDICATIONS);
const _shifts = deepClone(SEED_SHIFTS);
const _behavioralObs = deepClone(SEED_BEHAVIORAL_OBS);
const _familyContacts = deepClone(SEED_FAMILY_CONTACTS);
const _beds = generateBeds();
const _incidents = [
  { id: "inc1", title: "Peer Altercation — Jada Thompson", severity: "moderate", status: "resolved", reportedBy: "Mike Torres", date: "2026-07-03", category: "behavioral", youthInvolved: "Jada Thompson", description: "Verbal altercation at lunch over seating. Staff intervened within 30 seconds.", location: "Dining Hall", time: "12:15", staffResponse: "Verbal de-escalation, separation, offered quiet space", outcome: "De-escalated after 10 min. Accepted quiet time.", followUp: "Behavior plan review scheduled" },
  { id: "inc2", title: "Self-Injury — Sierra Harris", severity: "severe", status: "under_review", reportedBy: "Lisa Chen", date: "2026-07-03", category: "safety", youthInvolved: "Sierra Harris", description: "Scratched forearm after receiving upsetting letter from guardian.", location: "Room 112-A", time: "14:30", staffResponse: "Safety check, 1:1 supervision, crisis assessment, PRN", outcome: "Calmed after PRN. Safety plan reviewed.", followUp: "Clinician session 7/4, guardian notified" },
  { id: "inc3", title: "Elopement Attempt — Marcus Johnson", severity: "mild", status: "resolved", reportedBy: "Sarah Johnson", date: "2026-07-03", category: "safety", youthInvolved: "Marcus Johnson", description: "Attempted to exit building during chore time. Returned within 2 minutes.", location: "Main Entrance", time: "09:15", staffResponse: "Blocking technique, verbal redirection", outcome: "Returned voluntarily. Processing completed.", followUp: "Monitor for pattern" },
  { id: "inc4", title: "Property Damage — Elijah Davis", severity: "moderate", status: "resolved", reportedBy: "Mike Torres", date: "2026-07-03", category: "property", youthInvolved: "Elijah Davis", description: "Punched wall in recreation room after losing game.", location: "Recreation Room", time: "15:45", staffResponse: "Time-out, processing, restitution plan", outcome: "Completed restitution. Coping skills discussed.", followUp: "Social skills group referral" },
  { id: "inc5", title: "Medication Refusal — Marcus Johnson", severity: "mild", status: "resolved", reportedBy: "RN Martinez", date: "2026-07-03", category: "medical", youthInvolved: "Marcus Johnson", description: "Refused multivitamin during AM med pass.", location: "Med Room", time: "08:00", staffResponse: "Documented refusal, re-offered at lunch", outcome: "Took medication at lunch without issue.", followUp: "None" },
];
const _audits = [
  { id: "qa1", title: "Q2 2026 Internal Audit", status: "in_progress", type: "internal", lead: "Dr. Hall", dueDate: "2026-07-15", findings: 3, completed: 1 },
  { id: "qa2", title: "HHSC Licensing Review", status: "scheduled", type: "licensing", lead: "E. Russ Aideyan", dueDate: "2026-08-01", findings: 0, completed: 0 },
  { id: "qa3", title: "Medication Administration Audit", status: "completed", type: "clinical", lead: "RN Martinez", dueDate: "2026-06-15", findings: 2, completed: 2 },
  { id: "qa4", title: "Incident Documentation Review", status: "in_progress", type: "compliance", lead: "Lilian Ike", dueDate: "2026-07-20", findings: 5, completed: 3 },
  { id: "qa5", title: "CAP Tracking Review", status: "open", type: "corrective", lead: "Dr. Hall", dueDate: "2026-07-30", findings: 4, completed: 1 },
];
const _workOrders = [
  { id: "wo1", wo_number: "WO-2026-001", title: "HVAC Repair — Wing B", description: "AC unit not cooling. Temp reached 82F.", work_type: "hvac", priority: "high", status: "in_progress", facility_id: "f1", assigned_to: "J. Rodriguez", due_date: "2026-07-05", completed_at: null, created_at: "2026-06-25T10:00:00Z" },
  { id: "wo2", wo_number: "WO-2026-002", title: "Replace Fire Extinguisher — Hall B", description: "Expired per safety audit. Replace with 10lb ABC.", work_type: "safety", priority: "urgent", status: "completed", facility_id: "f1", assigned_to: "M. Chen", due_date: "2026-06-20", completed_at: "2026-06-19T14:00:00Z", created_at: "2026-06-18T09:00:00Z" },
  { id: "wo3", wo_number: "WO-2026-003", title: "Plumbing Leak — Kitchen Sink", description: "Slow drain and minor leak under kitchen sink.", work_type: "plumbing", priority: "medium", status: "open", facility_id: "f1", assigned_to: "Unassigned", due_date: "2026-07-08", completed_at: null, created_at: "2026-06-27T08:00:00Z" },
  { id: "wo4", wo_number: "WO-2026-004", title: "Security Camera Upgrade", description: "Replace 4 analog cameras with IP cameras.", work_type: "security", priority: "medium", status: "pending_parts", facility_id: "f1", assigned_to: "K. Brooks", due_date: "2026-07-15", completed_at: null, created_at: "2026-06-20T11:00:00Z" },
];
const _tasks = [
  { id: "t1", title: "Complete AM med pass", category: "medication", priority: "urgent", dueTime: "09:00", status: "completed", assignee: "RN Martinez", notes: "All meds administered except multivitamin refusal", completedAt: "2026-07-03T08:15:00Z" },
  { id: "t2", title: "Log behavioral observation — Jada Thompson", category: "documentation", priority: "urgent", dueTime: "14:00", status: "completed", assignee: "Mike Torres", notes: "Peer altercation at lunch documented", completedAt: "2026-07-03T12:30:00Z" },
  { id: "t3", title: "Family contact — Sierra Harris guardian", category: "family_contact", priority: "urgent", dueTime: "16:00", status: "in_progress", assignee: "Lisa Chen", notes: "Guardian notified of self-injury incident" },
  { id: "t4", title: "Update safety plan — Jada Thompson", category: "documentation", priority: "high", dueTime: "17:00", status: "pending", assignee: "Lilian Ike", notes: "Post-incident safety plan revision required" },
  { id: "t5", title: "Shift handoff note — Day to Evening", category: "shift", priority: "high", dueTime: "15:00", status: "pending", assignee: "Sarah Johnson", notes: "Include Jada incident and Marcus elopement attempt" },
  { id: "t6", title: "Restitution plan — Elijah Davis", category: "documentation", priority: "medium", dueTime: "End of shift", status: "pending", assignee: "Mike Torres", notes: "Wall damage in rec room — discuss with facilities" },
  { id: "t7", title: "Weekly case staffing prep", category: "meeting", priority: "medium", dueTime: "13:00", status: "pending", assignee: "Dr. Hall", notes: "Prepare progress notes for all assigned youth" },
  { id: "t8", title: "Controlled substance count", category: "medication", priority: "high", dueTime: "15:00", status: "completed", assignee: "RN Martinez", notes: "Counts verified, signatures on file", completedAt: "2026-07-03T14:30:00Z" },
  { id: "t9", title: "Evening med pass", category: "medication", priority: "high", dueTime: "21:00", status: "pending", assignee: "RN Thompson", notes: "Includes BID risperidone and PRN availability" },
  { id: "t10", title: "New admission intake — Nia Robinson", category: "intake", priority: "urgent", dueTime: "18:00", status: "in_progress", assignee: "Lilian Ike", notes: "Crisis admission from hotline. Safety plan needed." },
  { id: "t11", title: "Log daily observation — Makayla Wilson", category: "documentation", priority: "medium", dueTime: "16:00", status: "pending", assignee: "Amy Wilson", notes: "6-domain observation due for evening shift" },
  { id: "t12", title: "Review PRN effectiveness — Jada Thompson", category: "medication", priority: "medium", dueTime: "14:00", status: "completed", assignee: "RN Thompson", notes: "Hydroxyzine effective. Documented in MAR.", completedAt: "2026-07-03T11:30:00Z" },
  { id: "t13", title: "Facility walkthrough — safety check", category: "shift", priority: "high", dueTime: "10:00", status: "completed", assignee: "Sarah Johnson", notes: "All rooms checked, no safety concerns", completedAt: "2026-07-03T09:45:00Z" },
  { id: "t14", title: "Submit incident report — Elijah Davis", category: "documentation", priority: "high", dueTime: "16:00", status: "pending", assignee: "Mike Torres", notes: "Property damage incident needs formal documentation" },
  { id: "t15", title: "Guardian phone call — Destiny Brown mother", category: "family_contact", priority: "medium", dueTime: "15:00", status: "pending", assignee: "Lisa Chen", notes: "Weekly update call scheduled" },
];
const _sessions = [
  { id: "ses1", youthName: "Marcus Johnson", mrn: "BHC-2026-001", sessionType: "individual", clinician: "Dr. Hall", scheduledDate: "2026-07-03", startTime: "10:00", duration: 50, status: "completed", notes: "CBT session focused on cognitive restructuring. Good engagement." },
  { id: "ses2", youthName: "Aaliyah Williams", mrn: "BHC-2026-002", sessionType: "group", clinician: "Lilian Ike", scheduledDate: "2026-07-03", startTime: "14:00", duration: 60, status: "completed", notes: "Social skills group. Led discussion on peer relationships." },
  { id: "ses3", youthName: "Jada Thompson", mrn: "BHC-2026-004", sessionType: "individual", clinician: "Dr. Hall", scheduledDate: "2026-07-04", startTime: "09:00", duration: 50, status: "scheduled", notes: "Post-incident processing session." },
  { id: "ses4", youthName: "Carlos Martinez", mrn: "BHC-2026-003", sessionType: "intake_assessment", clinician: "Lilian Ike", scheduledDate: "2026-07-04", startTime: "11:00", duration: 90, status: "scheduled", notes: "Initial clinical assessment with guardian." },
  { id: "ses5", youthName: "Tyrell Jackson", mrn: "BHC-2026-005", sessionType: "family", clinician: "Dr. Hall", scheduledDate: "2026-07-05", startTime: "16:00", duration: 60, status: "scheduled", notes: "Family therapy with mother." },
];
const _referrals = [
  { id: "ref1", youthName: "Carlos Martinez", mrn: "BHC-2026-003", referralSource: "DCF Caseworker", dateReceived: "2026-06-28", status: "in_progress", urgency: "high", assignedTo: "Lilian Ike" },
  { id: "ref2", youthName: "Sophia Chen", mrn: "BHC-2026-017", referralSource: "HISD Counselor", dateReceived: "2026-06-27", status: "in_progress", urgency: "medium", assignedTo: "Dr. Hall" },
  { id: "ref3", youthName: "Darius Moore", mrn: "BHC-2026-018", referralSource: "Juvenile Court", dateReceived: "2026-06-25", status: "pending_screening", urgency: "high", assignedTo: "Unassigned" },
  { id: "ref4", youthName: "Emily Park", mrn: "BHC-2026-019", referralSource: "Private Psychiatrist", dateReceived: "2026-06-24", status: "accepted", urgency: "medium", assignedTo: "Lilian Ike" },
  { id: "ref5", youthName: "Nia Robinson", mrn: "BHC-2026-016", referralSource: "Crisis Hotline", dateReceived: "2026-06-28", status: "admitted", urgency: "urgent", assignedTo: "Dr. Hall" },
];
const _workflows = [
  { id: "wi1", name: "New Hire Onboarding — Amy Wilson", type: "onboarding", status: "active", startedAt: "2026-06-28", currentStep: "Background Check", assignee: "HR Director", progress: 60 },
  { id: "wi2", name: "CAP Closure — MAR Documentation", type: "cap", status: "active", startedAt: "2026-06-15", currentStep: "Manager Review", assignee: "RN Martinez", progress: 80 },
  { id: "wi3", name: "Incident Review — Sierra Harris", type: "incident_review", status: "active", startedAt: "2026-07-02", currentStep: "Clinical Director Sign-off", assignee: "Dr. Hall", progress: 40 },
  { id: "wi4", name: "Authorization Renewal — Marcus Johnson", type: "authorization", status: "pending", startedAt: "2026-06-20", currentStep: "Payer Submission", assignee: "Lilian Ike", progress: 25 },
];
const _approvals = [
  { id: "pa1", title: "Night Lead Transition — Tanya Reyes", requestor: "Tanya Reyes", approver: "E. Russ Aideyan", submittedAt: "2026-07-01", status: "pending", priority: "medium" },
  { id: "pa2", title: "Weekend Overtime — 3 Staff", requestor: "Sarah Johnson", approver: "E. Russ Aideyan", submittedAt: "2026-07-02", status: "pending", priority: "high" },
];
const _employees = [
  { id: "e1", firstName: "Sarah", lastName: "Johnson", email: "sarah.j@adolbi.care", role: "rcs-lead", department: "GRO", status: "active", hireDate: "2024-03-15", credentials: [{ type: "RCP", status: "current", expiry: "2027-03-15" }, { type: "CPR", status: "current", expiry: "2026-09-15" }] },
  { id: "e2", firstName: "Mike", lastName: "Torres", email: "mike.t@adolbi.care", role: "rcs-day", department: "GRO", status: "active", hireDate: "2024-06-01", credentials: [{ type: "RCP", status: "current", expiry: "2027-06-01" }, { type: "CPR", status: "current", expiry: "2026-08-01" }] },
  { id: "e3", firstName: "Lisa", lastName: "Chen", email: "lisa.c@adolbi.care", role: "rcs-day", department: "GRO", status: "active", hireDate: "2025-01-10", credentials: [{ type: "RCP", status: "current", expiry: "2028-01-10" }] },
  { id: "e4", firstName: "David", lastName: "Park", email: "david.p@adolbi.care", role: "rcs-lead", department: "GRO", status: "active", hireDate: "2024-01-20", credentials: [{ type: "RCP", status: "current", expiry: "2027-01-20" }, { type: "CPR", status: "current", expiry: "2026-07-20" }] },
  { id: "e5", firstName: "Amy", lastName: "Wilson", email: "amy.w@adolbi.care", role: "rcs-day", department: "GRO", status: "active", hireDate: "2025-03-01", credentials: [{ type: "RCP", status: "pending", expiry: null }] },
  { id: "e6", firstName: "James", lastName: "Wright", email: "james.w@adolbi.care", role: "rcs-lead", department: "GRO", status: "active", hireDate: "2023-11-15", credentials: [{ type: "RCP", status: "current", expiry: "2026-11-15" }, { type: "CPR", status: "expired", expiry: "2026-05-15" }] },
  { id: "e7", firstName: "Tanya", lastName: "Reyes", email: "tanya.r@adolbi.care", role: "rcs-day", department: "GRO", status: "active", hireDate: "2024-08-01", credentials: [{ type: "RCP", status: "current", expiry: "2027-08-01" }] },
  { id: "e8", firstName: "Kevin", lastName: "Brooks", email: "kevin.b@adolbi.care", role: "rcs-day", department: "GRO", status: "active", hireDate: "2025-02-15", credentials: [{ type: "RCP", status: "current", expiry: "2028-02-15" }, { type: "CPR", status: "current", expiry: "2027-02-15" }] },
  { id: "e9", firstName: "Robert", lastName: "Hayes", email: "robert.h@adolbi.care", role: "rcs-day", department: "GRO", status: "active", hireDate: "2025-04-01", credentials: [{ type: "RCP", status: "pending", expiry: null }] },
  { id: "e10", firstName: "RN", lastName: "Martinez", email: "rn.martinez@adolbi.care", role: "nurse", department: "Clinical", status: "active", hireDate: "2023-06-01", credentials: [{ type: "RN License", status: "current", expiry: "2026-12-01" }, { type: "CPR", status: "current", expiry: "2027-01-01" }] },
];

// ═══════════════════════════════════════════════════════════════
// EXPORT STORE
// ═══════════════════════════════════════════════════════════════

export const store = {
  youth: _youth, medications: _meds, shifts: _shifts,
  behavioralObs: _behavioralObs, familyContacts: _familyContacts,
  beds: _beds, incidents: _incidents, audits: _audits,
  workOrders: _workOrders, tasks: _tasks, sessions: _sessions,
  referrals: _referrals, workflows: _workflows, approvals: _approvals,
  employees: _employees,
};

// ═══════════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════

// ─── Tasks ──────────────────────────────────────────────────────
export function createTask(data: any) {
  const t = { id: nextId("t"), title: data.title, category: data.category || "general", priority: data.priority || "medium", dueTime: data.dueTime || "", status: "pending", assignee: data.assignee || "Current User", notes: data.notes || "", completedAt: undefined as string | undefined };
  store.tasks.unshift(t);
  return t;
}
export function updateTask(taskId: string, updates: any) {
  const t = store.tasks.find(x => x.id === taskId);
  if (!t) return null;
  Object.assign(t, updates);
  if (updates.status === "completed" && !t.completedAt) t.completedAt = new Date().toISOString();
  return t;
}
export function deleteTask(taskId: string) {
  store.tasks = store.tasks.filter(x => x.id !== taskId);
  return { success: true };
}

// ─── Medications ────────────────────────────────────────────────
export function administerMed(medId: string, by: string, time: string, notes: string) {
  const m = store.medications.find(x => x.id === medId);
  if (!m) return null;
  m.status = "administered"; m.admin_time = time; m.administered_by = by;
  if (notes) m.notes = notes;
  return m;
}
export function refuseMed(medId: string, reason: string) {
  const m = store.medications.find(x => x.id === medId);
  if (!m) return null;
  m.status = "refused"; m.refusal_reason = reason;
  return m;
}
export function holdMed(medId: string, reason: string) {
  const m = store.medications.find(x => x.id === medId);
  if (!m) return null;
  m.status = "held"; m.notes = `Held: ${reason}`;
  return m;
}
export function recordPrn(medId: string, by: string, time: string, reason: string, effectiveness: string, notes: string) {
  const orig = store.medications.find(x => x.id === medId);
  const m = { ...(orig || {}), id: nextId("med"), status: "administered", admin_time: time, administered_by: by, prn_reason: reason, prn_effectiveness: effectiveness, notes: notes || "" };
  store.medications.push(m as any);
  return m;
}

// ─── Behavioral Observations ────────────────────────────────────
export function createBehavioralObs(data: any) {
  const obs = { id: nextId("bo"), ...data, observation_date: data.observation_date || new Date().toISOString().split("T")[0] };
  store.behavioralObs.unshift(obs);
  return obs;
}

// ─── Family Contacts ────────────────────────────────────────────
export function createFamilyContact(data: any) {
  const fc = { id: nextId("fc"), ...data, contact_date: data.contact_date || new Date().toISOString().split("T")[0] };
  store.familyContacts.unshift(fc);
  return fc;
}

// ─── Incidents ──────────────────────────────────────────────────
export function createIncident(data: any) {
  const inc = { id: nextId("inc"), ...data, date: data.date || new Date().toISOString().split("T")[0], status: "open" };
  store.incidents.unshift(inc);
  return inc;
}
export function updateIncident(incId: string, updates: any) {
  const inc = store.incidents.find(x => x.id === incId);
  if (inc) Object.assign(inc, updates);
  return inc;
}

// ─── Shifts / Handoffs ──────────────────────────────────────────
export function updateShift(shiftId: string, updates: any) {
  const s = store.shifts.find(x => x.id === shiftId);
  if (s) Object.assign(s, updates);
  return s;
}

// ─── Audits ─────────────────────────────────────────────────────
export function createAudit(data: any) {
  const a = { id: nextId("qa"), ...data, findings: 0, completed: 0 };
  store.audits.unshift(a);
  return a;
}

// ─── Work Orders ────────────────────────────────────────────────
export function createWorkOrder(data: any) {
  const wo = { id: nextId("wo"), wo_number: `WO-2026-${_id}`, ...data, created_at: new Date().toISOString(), completed_at: null };
  store.workOrders.unshift(wo);
  return wo;
}
export function updateWorkOrder(woId: string, updates: any) {
  const wo = store.workOrders.find(x => x.id === woId);
  if (wo) Object.assign(wo, updates);
  return wo;
}

// ─── Sessions ───────────────────────────────────────────────────
export function createSession(data: any) {
  const s = { id: nextId("ses"), ...data };
  store.sessions.unshift(s);
  return s;
}

// ─── Referrals ──────────────────────────────────────────────────
export function createReferral(data: any) {
  const r = { id: nextId("ref"), ...data, dateReceived: data.dateReceived || new Date().toISOString().split("T")[0] };
  store.referrals.unshift(r);
  return r;
}
export function updateReferral(refId: string, updates: any) {
  const r = store.referrals.find(x => x.id === refId);
  if (r) Object.assign(r, updates);
  return r;
}

// ─── Workflows / Approvals ──────────────────────────────────────
export function respondToApproval(appId: string, decision: string) {
  const a = store.approvals.find(x => x.id === appId);
  if (a) a.status = decision === "approved" ? "approved" : "rejected";
  return a;
}

// ─── Employees ──────────────────────────────────────────────────
export function createEmployee(data: any) {
  const e = { id: nextId("e"), ...data, status: "active" };
  store.employees.unshift(e);
  return e;
}
export function updateEmployee(empId: string, updates: any) {
  const e = store.employees.find(x => x.id === empId);
  if (e) Object.assign(e, updates);
  return e;
}

// ═══════════════════════════════════════════════════════════════
// COMPUTED SUMMARIES
// ═══════════════════════════════════════════════════════════════

export function getMedSummary() {
  return {
    scheduled: store.medications.filter(m => m.status === "scheduled").length,
    administered: store.medications.filter(m => m.status === "administered").length,
    refused: store.medications.filter(m => m.status === "refused").length,
    missed: store.medications.filter(m => m.status === "missed").length,
    prnGiven: store.medications.filter(m => m.is_prn === 1 && m.status === "administered").length,
    controlledPending: store.medications.filter(m => m.is_controlled === 1 && m.status === "scheduled").length,
  };
}
export function getResidentialSummary() {
  const occ = store.youth.filter(y => y.status === "active").length;
  return { totalBeds: 48, occupiedBeds: occ, availableBeds: 48 - occ, occupancyRate: Math.round(occ / 48 * 100), todaysShifts: store.shifts.filter(s => s.shift_date === "2026-07-03").length, pendingHandoffs: store.shifts.filter(s => !s.handoffNote).length, todaysBehavioral: store.behavioralObs.filter(o => o.observation_date === "2026-07-03").length, openFamilyContacts: store.familyContacts.filter(f => f.follow_up_needed === 1).length, pendingDebriefs: 0 };
}
export function getDashboardKPIs() {
  return { censusTotal: store.youth.filter(y => y.status === "active").length, crisisHolds: store.youth.filter(y => y.level_of_care === "crisis_stabilization").length, openIncidents: store.incidents.filter(i => i.status === "open" || i.status === "under_review").length, todaysMedications: store.medications.filter(m => m.status === "scheduled").length, pendingObservations: 3, openFamilyContacts: store.familyContacts.filter(f => f.follow_up_needed === 1).length };
}

// ═══════════════════════════════════════════════════════════════
// SUPERVISOR CRUD
// ═══════════════════════════════════════════════════════════════

export function assignBed(bedId: string, youthId: string) {
  const bed = store.beds.find(b => b.id === bedId);
  const youth = store.youth.find(y => y.id === youthId);
  if (!bed || !youth) return null;
  bed.is_occupied = 1; bed.youth_id = youthId; bed.youth_name = youth.first_name + " " + youth.last_name;
  bed.mrn = youth.mrn; bed.assigned_date = new Date().toISOString().split("T")[0];
  youth.bed_assignment = bed.bed_name; youth.status = "active";
  return bed;
}
export function vacateBed(bedId: string) {
  const bed = store.beds.find(b => b.id === bedId);
  if (!bed) return null;
  const youth = store.youth.find(y => y.id === bed.youth_id);
  if (youth) { youth.bed_assignment = null; youth.status = "discharged"; }
  bed.is_occupied = 0; bed.youth_id = null; bed.youth_name = null; bed.mrn = null; bed.assigned_date = null;
  return bed;
}
export function createShift(data: any) {
  const s = { id: nextId("s"), shift_date: data.shift_date || "2026-07-03", shift_type: data.shift_type || "day", start_time: data.start_time || "07:00", end_time: data.end_time || "15:00", rcs_lead_name: data.rcs_lead_name || "Unassigned", rcs_staff_ids_json: data.rcs_staff_ids_json || "[]", nurse_name: data.nurse_name || "TBD", clinician_on_call: data.clinician_on_call || "On-call", status: "scheduled", coverage_status: data.coverage_status || "full" };
  store.shifts.push(s);
  return s;
}
export function createMeeting(data: any) {
  const m = { id: nextId("m15"), ...data, scheduledDate: data.scheduledDate || new Date().toISOString().split("T")[0], status: "scheduled" };
  return m;
}
export function createEscalation(data: any) {
  const e = { id: nextId("esc"), ...data, date: data.date || new Date().toISOString().split("T")[0], status: "active" };
  return e;
}
