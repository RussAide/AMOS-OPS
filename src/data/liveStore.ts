// ═══════════════════════════════════════════════════════════════════
// AMOS-OPS Live Data Store — Full CRUD for All Modules
// ═══════════════════════════════════════════════════════════════════

import { SEED_YOUTH, SEED_MEDICATIONS, SEED_SHIFTS, SEED_BEHAVIORAL_OBS, SEED_FAMILY_CONTACTS, generateBeds } from "./residentialSeedData";

function deepClone<T>(obj: T): T { return JSON.parse(JSON.stringify(obj)); }

export type DemoRecord = Record<string, unknown>;

function readString(data: DemoRecord, key: string, fallback = ""): string {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

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
  { id: "inc1", title: "Peer Altercation — Synthetic Youth 002", severity: "moderate", status: "resolved", reportedBy: "Synthetic Staff 02", date: "2026-07-03", category: "behavioral", youthInvolved: "Synthetic Youth 002", description: "Verbal altercation at lunch over seating. Staff intervened within 30 seconds.", location: "Dining Hall", time: "12:15", staffResponse: "Verbal de-escalation, separation, offered quiet space", outcome: "De-escalated after 10 min. Accepted quiet time.", followUp: "Behavior plan review scheduled" },
  { id: "inc2", title: "Self-Injury — Synthetic Youth 013", severity: "severe", status: "under_review", reportedBy: "Synthetic Staff 03", date: "2026-07-03", category: "safety", youthInvolved: "Synthetic Youth 013", description: "Scratched forearm after receiving upsetting letter from guardian.", location: "Room 112-A", time: "14:30", staffResponse: "Safety check, 1:1 supervision, crisis assessment, PRN", outcome: "Calmed after PRN. Safety plan reviewed.", followUp: "Clinician session 7/4, guardian notified" },
  { id: "inc3", title: "Elopement Attempt — Synthetic Youth 001", severity: "mild", status: "resolved", reportedBy: "Synthetic Staff 01", date: "2026-07-03", category: "safety", youthInvolved: "Synthetic Youth 001", description: "Attempted to exit building during chore time. Returned within 2 minutes.", location: "Main Entrance", time: "09:15", staffResponse: "Blocking technique, verbal redirection", outcome: "Returned voluntarily. Processing completed.", followUp: "Monitor for pattern" },
  { id: "inc4", title: "Property Damage — Synthetic Youth 016", severity: "moderate", status: "resolved", reportedBy: "Synthetic Staff 02", date: "2026-07-03", category: "property", youthInvolved: "Synthetic Youth 016", description: "Punched wall in recreation room after losing game.", location: "Recreation Room", time: "15:45", staffResponse: "Time-out, processing, restitution plan", outcome: "Completed restitution. Coping skills discussed.", followUp: "Social skills group referral" },
  { id: "inc5", title: "Medication Refusal — Synthetic Youth 001", severity: "mild", status: "resolved", reportedBy: "Synthetic Nurse 01", date: "2026-07-03", category: "medical", youthInvolved: "Synthetic Youth 001", description: "Refused multivitamin during AM med pass.", location: "Med Room", time: "08:00", staffResponse: "Documented refusal, re-offered at lunch", outcome: "Took medication at lunch without issue.", followUp: "None" },
];
const _audits = [
  { id: "qa1", title: "Q2 2026 Internal Audit", status: "in_progress", type: "internal", lead: "Demo Clinical Director", dueDate: "2026-07-15", findings: 3, completed: 1 },
  { id: "qa2", title: "HHSC Licensing Review", status: "scheduled", type: "licensing", lead: "Demo Executive", dueDate: "2026-08-01", findings: 0, completed: 0 },
  { id: "qa3", title: "Medication Administration Audit", status: "completed", type: "clinical", lead: "Synthetic Nurse 01", dueDate: "2026-06-15", findings: 2, completed: 2 },
  { id: "qa4", title: "Incident Documentation Review", status: "in_progress", type: "compliance", lead: "Demo Clinical Lead", dueDate: "2026-07-20", findings: 5, completed: 3 },
  { id: "qa5", title: "CAP Tracking Review", status: "open", type: "corrective", lead: "Demo Clinical Director", dueDate: "2026-07-30", findings: 4, completed: 1 },
];
const _workOrders = [
  { id: "wo1", wo_number: "WO-2026-001", title: "HVAC Repair — Wing B", description: "AC unit not cooling. Temp reached 82F.", work_type: "hvac", priority: "high", status: "in_progress", facility_id: "f1", assigned_to: "J. Rodriguez", due_date: "2026-07-05", completed_at: null, created_at: "2026-06-25T10:00:00Z" },
  { id: "wo2", wo_number: "WO-2026-002", title: "Replace Fire Extinguisher — Hall B", description: "Expired per safety audit. Replace with 10lb ABC.", work_type: "safety", priority: "urgent", status: "completed", facility_id: "f1", assigned_to: "M. Chen", due_date: "2026-06-20", completed_at: "2026-06-19T14:00:00Z", created_at: "2026-06-18T09:00:00Z" },
  { id: "wo3", wo_number: "WO-2026-003", title: "Plumbing Leak — Kitchen Sink", description: "Slow drain and minor leak under kitchen sink.", work_type: "plumbing", priority: "medium", status: "open", facility_id: "f1", assigned_to: "Unassigned", due_date: "2026-07-08", completed_at: null, created_at: "2026-06-27T08:00:00Z" },
  { id: "wo4", wo_number: "WO-2026-004", title: "Security Camera Upgrade", description: "Replace 4 analog cameras with IP cameras.", work_type: "security", priority: "medium", status: "pending_parts", facility_id: "f1", assigned_to: "K. Brooks", due_date: "2026-07-15", completed_at: null, created_at: "2026-06-20T11:00:00Z" },
];
const _tasks = [
  { id: "t1", title: "Complete AM med pass", category: "medication", priority: "urgent", dueTime: "09:00", status: "completed", assignee: "Synthetic Nurse 01", notes: "All meds administered except multivitamin refusal", completedAt: "2026-07-03T08:15:00Z" },
  { id: "t2", title: "Log behavioral observation — Synthetic Youth 002", category: "documentation", priority: "urgent", dueTime: "14:00", status: "completed", assignee: "Synthetic Staff 02", notes: "Peer altercation at lunch documented", completedAt: "2026-07-03T12:30:00Z" },
  { id: "t3", title: "Family contact — Synthetic Youth 013 guardian", category: "family_contact", priority: "urgent", dueTime: "16:00", status: "in_progress", assignee: "Synthetic Staff 03", notes: "Guardian notified of self-injury incident" },
  { id: "t4", title: "Update safety plan — Synthetic Youth 002", category: "documentation", priority: "high", dueTime: "17:00", status: "pending", assignee: "Demo Clinical Lead", notes: "Post-incident safety plan revision required" },
  { id: "t5", title: "Shift handoff note — Day to Evening", category: "shift", priority: "high", dueTime: "15:00", status: "pending", assignee: "Synthetic Staff 01", notes: "Include Synthetic-Person-002 incident and Synthetic-Person-001 elopement attempt" },
  { id: "t6", title: "Restitution plan — Synthetic Youth 016", category: "documentation", priority: "medium", dueTime: "End of shift", status: "pending", assignee: "Synthetic Staff 02", notes: "Wall damage in rec room — discuss with facilities" },
  { id: "t7", title: "Weekly case staffing prep", category: "meeting", priority: "medium", dueTime: "13:00", status: "pending", assignee: "Demo Clinical Director", notes: "Prepare progress notes for all assigned youth" },
  { id: "t8", title: "Controlled substance count", category: "medication", priority: "high", dueTime: "15:00", status: "completed", assignee: "Synthetic Nurse 01", notes: "Counts verified, signatures on file", completedAt: "2026-07-03T14:30:00Z" },
  { id: "t9", title: "Evening med pass", category: "medication", priority: "high", dueTime: "21:00", status: "pending", assignee: "Synthetic Nurse 02", notes: "Includes BID risperidone and PRN availability" },
  { id: "t10", title: "New admission intake — Synthetic Youth 015", category: "intake", priority: "urgent", dueTime: "18:00", status: "in_progress", assignee: "Demo Clinical Lead", notes: "Crisis admission from hotline. Safety plan needed." },
  { id: "t11", title: "Log daily observation — Synthetic Youth 018", category: "documentation", priority: "medium", dueTime: "16:00", status: "pending", assignee: "Synthetic Staff 05", notes: "6-domain observation due for evening shift" },
  { id: "t12", title: "Review PRN effectiveness — Synthetic Youth 002", category: "medication", priority: "medium", dueTime: "14:00", status: "completed", assignee: "Synthetic Nurse 02", notes: "Hydroxyzine effective. Documented in MAR.", completedAt: "2026-07-03T11:30:00Z" },
  { id: "t13", title: "Facility walkthrough — safety check", category: "shift", priority: "high", dueTime: "10:00", status: "completed", assignee: "Synthetic Staff 01", notes: "All rooms checked, no safety concerns", completedAt: "2026-07-03T09:45:00Z" },
  { id: "t14", title: "Submit incident report — Synthetic Youth 016", category: "documentation", priority: "high", dueTime: "16:00", status: "pending", assignee: "Synthetic Staff 02", notes: "Property damage incident needs formal documentation" },
  { id: "t15", title: "Guardian phone call — Synthetic Youth 021 mother", category: "family_contact", priority: "medium", dueTime: "15:00", status: "pending", assignee: "Synthetic Staff 03", notes: "Weekly update call scheduled" },
];
const _sessions = [
  { id: "ses1", youthName: "Synthetic Youth 001", mrn: "SYNTH-BHC-001", sessionType: "individual", clinician: "Demo Clinical Director", scheduledDate: "2026-07-03", startTime: "10:00", duration: 50, status: "completed", notes: "CBT session focused on cognitive restructuring. Good engagement." },
  { id: "ses2", youthName: "Synthetic Youth 005", mrn: "SYNTH-BHC-002", sessionType: "group", clinician: "Demo Clinical Lead", scheduledDate: "2026-07-03", startTime: "14:00", duration: 60, status: "completed", notes: "Social skills group. Led discussion on peer relationships." },
  { id: "ses3", youthName: "Synthetic Youth 002", mrn: "SYNTH-BHC-004", sessionType: "individual", clinician: "Demo Clinical Director", scheduledDate: "2026-07-04", startTime: "09:00", duration: 50, status: "scheduled", notes: "Post-incident processing session." },
  { id: "ses4", youthName: "Synthetic Youth 007", mrn: "SYNTH-BHC-003", sessionType: "intake_assessment", clinician: "Demo Clinical Lead", scheduledDate: "2026-07-04", startTime: "11:00", duration: 90, status: "scheduled", notes: "Initial clinical assessment with guardian." },
  { id: "ses5", youthName: "Synthetic Youth 010", mrn: "SYNTH-BHC-005", sessionType: "family", clinician: "Demo Clinical Director", scheduledDate: "2026-07-05", startTime: "16:00", duration: 60, status: "scheduled", notes: "Family therapy with mother." },
];
const _referrals = [
  { id: "ref1", youthName: "Synthetic Youth 007", mrn: "SYNTH-BHC-003", referralSource: "DCF Caseworker", dateReceived: "2026-06-28", status: "in_progress", urgency: "high", assignedTo: "Demo Clinical Lead" },
  { id: "ref2", youthName: "Synthetic Youth 017", mrn: "SYNTH-BHC-017", referralSource: "HISD Counselor", dateReceived: "2026-06-27", status: "in_progress", urgency: "medium", assignedTo: "Demo Clinical Director" },
  { id: "ref3", youthName: "Synthetic Youth 038", mrn: "SYNTH-BHC-018", referralSource: "Juvenile Court", dateReceived: "2026-06-25", status: "pending_screening", urgency: "high", assignedTo: "Unassigned" },
  { id: "ref4", youthName: "Synthetic Youth 037", mrn: "SYNTH-BHC-019", referralSource: "Private Psychiatrist", dateReceived: "2026-06-24", status: "accepted", urgency: "medium", assignedTo: "Demo Clinical Lead" },
  { id: "ref5", youthName: "Synthetic Youth 015", mrn: "SYNTH-BHC-016", referralSource: "Crisis Hotline", dateReceived: "2026-06-28", status: "admitted", urgency: "urgent", assignedTo: "Demo Clinical Director" },
];
const _workflows = [
  { id: "wi1", name: "New Hire Onboarding — Synthetic Staff 05", type: "onboarding", status: "active", startedAt: "2026-06-28", currentStep: "Background Check", assignee: "HR Director", progress: 60 },
  { id: "wi2", name: "CAP Closure — MAR Documentation", type: "cap", status: "active", startedAt: "2026-06-15", currentStep: "Manager Review", assignee: "Synthetic Nurse 01", progress: 80 },
  { id: "wi3", name: "Incident Review — Synthetic Youth 013", type: "incident_review", status: "active", startedAt: "2026-07-02", currentStep: "Clinical Director Sign-off", assignee: "Demo Clinical Director", progress: 40 },
  { id: "wi4", name: "Authorization Renewal — Synthetic Youth 001", type: "authorization", status: "pending", startedAt: "2026-06-20", currentStep: "Payer Submission", assignee: "Demo Clinical Lead", progress: 25 },
];
const _approvals = [
  { id: "pa1", title: "Night Lead Transition — Tanya Reyes", requestor: "Tanya Reyes", approver: "Demo Executive", submittedAt: "2026-07-01", status: "pending", priority: "medium" },
  { id: "pa2", title: "Weekend Overtime — 3 Staff", requestor: "Synthetic Staff 01", approver: "Demo Executive", submittedAt: "2026-07-02", status: "pending", priority: "high" },
];
const _employees = [
  { id: "e1", firstName: "Sarah", lastName: "Johnson", email: "sarah.j@example.invalid", role: "rcs-lead", department: "GRO", status: "active", hireDate: "2024-03-15", credentials: [{ type: "RCP", status: "current", expiry: "2027-03-15" }, { type: "CPR", status: "current", expiry: "2026-09-15" }] },
  { id: "e2", firstName: "Mike", lastName: "Torres", email: "mike.t@example.invalid", role: "rcs-day", department: "GRO", status: "active", hireDate: "2024-06-01", credentials: [{ type: "RCP", status: "current", expiry: "2027-06-01" }, { type: "CPR", status: "current", expiry: "2026-08-01" }] },
  { id: "e3", firstName: "Lisa", lastName: "Chen", email: "lisa.c@example.invalid", role: "rcs-day", department: "GRO", status: "active", hireDate: "2025-01-10", credentials: [{ type: "RCP", status: "current", expiry: "2028-01-10" }] },
  { id: "e4", firstName: "David", lastName: "Park", email: "david.p@example.invalid", role: "rcs-lead", department: "GRO", status: "active", hireDate: "2024-01-20", credentials: [{ type: "RCP", status: "current", expiry: "2027-01-20" }, { type: "CPR", status: "current", expiry: "2026-07-20" }] },
  { id: "e5", firstName: "Amy", lastName: "Wilson", email: "amy.w@example.invalid", role: "rcs-day", department: "GRO", status: "active", hireDate: "2025-03-01", credentials: [{ type: "RCP", status: "pending", expiry: null }] },
  { id: "e6", firstName: "James", lastName: "Wright", email: "james.w@example.invalid", role: "rcs-lead", department: "GRO", status: "active", hireDate: "2023-11-15", credentials: [{ type: "RCP", status: "current", expiry: "2026-11-15" }, { type: "CPR", status: "expired", expiry: "2026-05-15" }] },
  { id: "e7", firstName: "Tanya", lastName: "Reyes", email: "tanya.r@example.invalid", role: "rcs-day", department: "GRO", status: "active", hireDate: "2024-08-01", credentials: [{ type: "RCP", status: "current", expiry: "2027-08-01" }] },
  { id: "e8", firstName: "Kevin", lastName: "Brooks", email: "kevin.b@example.invalid", role: "rcs-day", department: "GRO", status: "active", hireDate: "2025-02-15", credentials: [{ type: "RCP", status: "current", expiry: "2028-02-15" }, { type: "CPR", status: "current", expiry: "2027-02-15" }] },
  { id: "e9", firstName: "Robert", lastName: "Hayes", email: "robert.h@example.invalid", role: "rcs-day", department: "GRO", status: "active", hireDate: "2025-04-01", credentials: [{ type: "RCP", status: "pending", expiry: null }] },
  { id: "e10", firstName: "RN", lastName: "Martinez", email: "rn.martinez@example.invalid", role: "nurse", department: "Clinical", status: "active", hireDate: "2023-06-01", credentials: [{ type: "RN License", status: "current", expiry: "2026-12-01" }, { type: "CPR", status: "current", expiry: "2027-01-01" }] },
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
export function createTask(data: DemoRecord) {
  const t = { id: nextId("t"), title: readString(data, "title", "Untitled task"), category: readString(data, "category", "general"), priority: readString(data, "priority", "medium"), dueTime: readString(data, "dueTime"), status: "pending", assignee: readString(data, "assignee", "Current User"), notes: readString(data, "notes"), completedAt: undefined as string | undefined };
  store.tasks.unshift(t);
  return t;
}
export function updateTask(taskId: string, updates: DemoRecord) {
  const t = store.tasks.find(x => x.id === taskId);
  if (!t) return null;
  Object.assign(t, updates);
  if (readString(updates, "status") === "completed" && !t.completedAt) t.completedAt = new Date().toISOString();
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
  store.medications.push(m as (typeof store.medications)[number]);
  return m;
}

// ─── Behavioral Observations ────────────────────────────────────
export function createBehavioralObs(data: DemoRecord) {
  const obs = { id: nextId("bo"), ...data, observation_date: readString(data, "observation_date", new Date().toISOString().split("T")[0]) };
  store.behavioralObs.unshift(obs as (typeof store.behavioralObs)[number]);
  return obs;
}

// ─── Family Contacts ────────────────────────────────────────────
export function createFamilyContact(data: DemoRecord) {
  const fc = { id: nextId("fc"), ...data, contact_date: readString(data, "contact_date", new Date().toISOString().split("T")[0]) };
  store.familyContacts.unshift(fc as (typeof store.familyContacts)[number]);
  return fc;
}

// ─── Incidents ──────────────────────────────────────────────────
export function createIncident(data: DemoRecord) {
  const inc = { id: nextId("inc"), ...data, date: readString(data, "date", new Date().toISOString().split("T")[0]), status: "open" };
  store.incidents.unshift(inc as (typeof store.incidents)[number]);
  return inc;
}
export function updateIncident(incId: string, updates: DemoRecord) {
  const inc = store.incidents.find(x => x.id === incId);
  if (inc) Object.assign(inc, updates);
  return inc;
}

// ─── Shifts / Handoffs ──────────────────────────────────────────
export function updateShift(shiftId: string, updates: DemoRecord) {
  const s = store.shifts.find(x => x.id === shiftId);
  if (s) Object.assign(s, updates);
  return s;
}

// ─── Audits ─────────────────────────────────────────────────────
export function createAudit(data: DemoRecord) {
  const a = { id: nextId("qa"), ...data, findings: 0, completed: 0 };
  store.audits.unshift(a as (typeof store.audits)[number]);
  return a;
}

// ─── Work Orders ────────────────────────────────────────────────
export function createWorkOrder(data: DemoRecord) {
  const wo = { id: nextId("wo"), wo_number: `WO-2026-${_id}`, ...data, created_at: new Date().toISOString(), completed_at: null };
  store.workOrders.unshift(wo as (typeof store.workOrders)[number]);
  return wo;
}
export function updateWorkOrder(woId: string, updates: DemoRecord) {
  const wo = store.workOrders.find(x => x.id === woId);
  if (wo) Object.assign(wo, updates);
  return wo;
}

// ─── Sessions ───────────────────────────────────────────────────
export function createSession(data: DemoRecord) {
  const s = { id: nextId("ses"), ...data };
  store.sessions.unshift(s as (typeof store.sessions)[number]);
  return s;
}

// ─── Referrals ──────────────────────────────────────────────────
export function createReferral(data: DemoRecord) {
  const r = { id: nextId("ref"), ...data, dateReceived: readString(data, "dateReceived", new Date().toISOString().split("T")[0]) };
  store.referrals.unshift(r as (typeof store.referrals)[number]);
  return r;
}
export function updateReferral(refId: string, updates: DemoRecord) {
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
export function createEmployee(data: DemoRecord) {
  const e = { id: nextId("e"), ...data, status: "active" };
  store.employees.unshift(e as (typeof store.employees)[number]);
  return e;
}
export function updateEmployee(empId: string, updates: DemoRecord) {
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
  return { totalBeds: 48, occupiedBeds: occ, availableBeds: 48 - occ, occupancyRate: Math.round(occ / 48 * 100), todaysShifts: store.shifts.filter(s => s.shift_date === "2026-07-03").length, pendingHandoffs: store.shifts.filter(s => s.status !== "completed").length, todaysBehavioral: store.behavioralObs.filter(o => o.observation_date === "2026-07-03").length, openFamilyContacts: store.familyContacts.filter(f => f.follow_up_needed === 1).length, pendingDebriefs: 0 };
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
  if (youth) { youth.bed_assignment = ""; youth.status = "discharged"; }
  bed.is_occupied = 0; bed.youth_id = null; bed.youth_name = null; bed.mrn = null; bed.assigned_date = null;
  return bed;
}
export function createShift(data: DemoRecord) {
  const s = { id: nextId("s"), shift_date: readString(data, "shift_date", "2026-07-03"), shift_type: readString(data, "shift_type", "day"), start_time: readString(data, "start_time", "07:00"), end_time: readString(data, "end_time", "15:00"), rcs_lead_name: readString(data, "rcs_lead_name", "Unassigned"), rcs_staff_ids_json: readString(data, "rcs_staff_ids_json", "[]"), nurse_name: readString(data, "nurse_name", "TBD"), clinician_on_call: readString(data, "clinician_on_call", "On-call"), status: "scheduled", coverage_status: readString(data, "coverage_status", "full") };
  store.shifts.push(s as (typeof store.shifts)[number]);
  return s;
}
export function createMeeting(data: DemoRecord) {
  const m = { id: nextId("m15"), ...data, scheduledDate: readString(data, "scheduledDate", new Date().toISOString().split("T")[0]), status: "scheduled" };
  return m;
}
export function createEscalation(data: DemoRecord) {
  const e = { id: nextId("esc"), ...data, date: readString(data, "date", new Date().toISOString().split("T")[0]), status: "active" };
  return e;
}
