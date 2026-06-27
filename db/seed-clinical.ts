// Seed script for BHC Clinical, Revenue, and QA modules
// Run with: npx tsx db/seed-clinical.ts

import { sqlite } from "../api/queries/connection";
import { randomUUID } from "crypto";

const now = new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const futureDay = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

function q(s: string) {
  return s.replace(/'/g, "''");
}

// ─── Drop & Create Tables ────────────────────────────────────
console.log("[Seed] Setting up tables...");

const tables = [
  "insurance_plans", "patients", "treatment_plans", "clinical_sessions",
  "outcome_measures", "payers", "claims", "claim_line_items",
  "audits_qa", "incidents", "corrective_actions",
];

for (const t of tables) {
  try { sqlite.exec(`DROP TABLE IF EXISTS ${t}`); } catch { /* ignore */ }
}

// Ensure hr_people exists for clinician references
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS hr_people (
    id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
    employee_id TEXT, role TEXT NOT NULL, department TEXT NOT NULL,
    lane TEXT NOT NULL DEFAULT 'activation', is_active INTEGER NOT NULL DEFAULT 1,
    is_employee INTEGER NOT NULL DEFAULT 0, hire_date TEXT, supervisor TEXT, created_at TEXT
  )`);
} catch { /* ignore */ }

sqlite.exec(`
  CREATE TABLE insurance_plans (
    id TEXT PRIMARY KEY, payer_name TEXT NOT NULL, plan_name TEXT NOT NULL,
    policy_number_pattern TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT
  );
  CREATE TABLE patients (
    id TEXT PRIMARY KEY, mrn TEXT NOT NULL UNIQUE, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL, gender TEXT, phone TEXT, email TEXT, address TEXT,
    insurance_id TEXT, emergency_name TEXT, emergency_phone TEXT, referral_source TEXT,
    status TEXT NOT NULL DEFAULT 'intake', assigned_clinician_id TEXT, intake_date TEXT,
    discharge_date TEXT, discharge_reason TEXT, created_at TEXT, updated_at TEXT,
    created_by TEXT, updated_by TEXT
  );
  CREATE TABLE treatment_plans (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, plan_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', primary_diagnosis TEXT NOT NULL,
    secondary_diagnosis TEXT, presenting_problem TEXT NOT NULL, goals_json TEXT NOT NULL DEFAULT '[]',
    interventions_json TEXT NOT NULL DEFAULT '[]', estimated_duration_weeks INTEGER,
    start_date TEXT, review_date TEXT, end_date TEXT, assigned_clinician_id TEXT NOT NULL,
    supervisor_id TEXT, approved_by TEXT, approved_at TEXT, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE clinical_sessions (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, treatment_plan_id TEXT,
    clinician_id TEXT NOT NULL, session_date TEXT NOT NULL, session_type TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 60, chief_complaint TEXT, session_notes TEXT,
    interventions_used_json TEXT DEFAULT '[]', client_response TEXT, plan_modifications TEXT,
    risk_assessment_json TEXT, next_session_date TEXT, next_session_goals TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled', billing_code TEXT, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE outcome_measures (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, session_id TEXT,
    measure_type TEXT NOT NULL, score INTEGER NOT NULL, max_score INTEGER NOT NULL,
    severity_level TEXT, administered_by TEXT NOT NULL, administered_at TEXT, notes TEXT, created_at TEXT
  );
  CREATE TABLE payers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, payer_type TEXT NOT NULL DEFAULT 'insurance',
    contact_phone TEXT, contact_email TEXT, claims_address TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT
  );
  CREATE TABLE claims (
    id TEXT PRIMARY KEY, claim_number TEXT NOT NULL UNIQUE, patient_id TEXT NOT NULL,
    payer_id TEXT, clinician_id TEXT NOT NULL, service_date TEXT NOT NULL, submission_date TEXT,
    status TEXT NOT NULL DEFAULT 'draft', total_amount INTEGER NOT NULL, allowed_amount INTEGER,
    paid_amount INTEGER, patient_responsibility INTEGER, denial_reason TEXT, denial_code TEXT,
    appeal_date TEXT, appeal_status TEXT NOT NULL DEFAULT 'not_appealed', notes TEXT,
    created_at TEXT, updated_at TEXT
  );
  CREATE TABLE claim_line_items (
    id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, service_date TEXT NOT NULL,
    procedure_code TEXT NOT NULL, diagnosis_code TEXT, units INTEGER NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL, total_price INTEGER NOT NULL, description TEXT, created_at TEXT
  );
  CREATE TABLE audits_qa (
    id TEXT PRIMARY KEY, audit_number TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
    audit_type TEXT NOT NULL, scope TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planned',
    assigned_auditor_id TEXT, department TEXT, findings_json TEXT DEFAULT '[]', score INTEGER,
    started_at TEXT, completed_at TEXT, due_date TEXT, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE incidents (
    id TEXT PRIMARY KEY, incident_number TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
    description TEXT NOT NULL, incident_type TEXT NOT NULL, severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', patient_id TEXT, reported_by TEXT NOT NULL,
    assigned_to TEXT, occurred_at TEXT NOT NULL, resolved_at TEXT, resolution_notes TEXT,
    follow_up_required INTEGER NOT NULL DEFAULT 0, follow_up_date TEXT, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE corrective_actions (
    id TEXT PRIMARY KEY, action_number TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
    description TEXT NOT NULL, related_audit_id TEXT, related_incident_id TEXT,
    priority TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', assigned_to TEXT NOT NULL,
    due_date TEXT NOT NULL, completed_at TEXT, completion_notes TEXT, verified_by TEXT,
    verified_at TEXT, created_at TEXT, updated_at TEXT
  );
`);

console.log("[Seed] Tables ready.");

// ─── Insurance Plans ─────────────────────────────────────────
console.log("[Seed] Creating insurance plans...");

const insurancePlans = [
  { id: randomUUID(), name: "Aetna Better Health" },
  { id: randomUUID(), name: "Blue Cross Blue Shield TX" },
  { id: randomUUID(), name: "Texas Medicaid" },
  { id: randomUUID(), name: "Medicare Part B" },
  { id: randomUUID(), name: "Cigna Behavioral Health" },
  { id: randomUUID(), name: "Self Pay" },
];

for (const p of insurancePlans) {
  sqlite.exec(`INSERT INTO insurance_plans (id, payer_name, plan_name, is_active, created_at) VALUES ('${p.id}', '${q(p.name)}', '${q(p.name)}', 1, '${now}')`);
}

// ─── Payers ──────────────────────────────────────────────────
console.log("[Seed] Creating payers...");

const payerData = [
  { id: randomUUID(), name: "Aetna Better Health", type: "insurance", phone: "1-800-123-4567" },
  { id: randomUUID(), name: "Blue Cross Blue Shield TX", type: "insurance", phone: "1-800-521-2227" },
  { id: randomUUID(), name: "Texas Medicaid", type: "medicaid", phone: "1-877-541-7905" },
  { id: randomUUID(), name: "Medicare Part B", type: "medicare", phone: "1-800-633-4227" },
  { id: randomUUID(), name: "Cigna Behavioral Health", type: "insurance", phone: "1-800-244-6224" },
];

for (const p of payerData) {
  sqlite.exec(`INSERT INTO payers (id, name, payer_type, contact_phone, is_active, created_at) VALUES ('${p.id}', '${q(p.name)}', '${p.type}', '${p.phone}', 1, '${now}')`);
}

// ─── Clinicians ──────────────────────────────────────────────
console.log("[Seed] Creating clinicians...");

const clinicianIds: string[] = [];
for (let i = 0; i < 6; i++) clinicianIds.push(randomUUID());

const clinicians = [
  { id: clinicianIds[0], firstName: "Dr. Sarah", lastName: "Mitchell", role: "Clinical Psychologist" },
  { id: clinicianIds[1], firstName: "Dr. James", lastName: "Chen", role: "Psychiatrist" },
  { id: clinicianIds[2], firstName: "Maria", lastName: "Rodriguez", role: "LCSW" },
  { id: clinicianIds[3], firstName: "Dr. Robert", lastName: "Williams", role: "Clinical Psychologist" },
  { id: clinicianIds[4], firstName: "Jennifer", lastName: "Park", role: "LPC" },
  { id: clinicianIds[5], firstName: "Dr. Michael", lastName: "Thompson", role: "Psychiatrist" },
];

for (const c of clinicians) {
  sqlite.exec(`INSERT OR IGNORE INTO hr_people (id, first_name, last_name, role, department, lane, is_active, is_employee, created_at) VALUES ('${c.id}', '${q(c.firstName)}', '${q(c.lastName)}', '${q(c.role)}', 'Clinical', 'management', 1, 1, '${now}')`);
}

// ─── Patients ────────────────────────────────────────────────
console.log("[Seed] Creating patients...");

const patientData = [
  { first_name: "Alexandra", last_name: "Martinez", dob: "1992-03-15", gender: "female", phone: "(713) 555-0101", status: "active", clinicianIdx: 0, referral: "Community Referral" },
  { first_name: "Christopher", last_name: "Johnson", dob: "1985-07-22", gender: "male", phone: "(713) 555-0102", status: "active", clinicianIdx: 1, referral: "Physician Referral" },
  { first_name: "Emily", last_name: "Davidson", dob: "1998-11-03", gender: "female", phone: "(713) 555-0103", status: "active", clinicianIdx: 0, referral: "Crisis Line" },
  { first_name: "Marcus", last_name: "Williams", dob: "1979-01-10", gender: "male", phone: "(713) 555-0104", status: "active", clinicianIdx: 2, referral: "Court Ordered" },
  { first_name: "Sophia", last_name: "Anderson", dob: "2001-05-28", gender: "female", phone: "(713) 555-0105", status: "intake", clinicianIdx: 3, referral: "School Counselor" },
  { first_name: "Daniel", last_name: "Brown", dob: "1988-09-14", gender: "male", phone: "(713) 555-0106", status: "hold", clinicianIdx: 1, referral: "Self Referral" },
  { first_name: "Isabella", last_name: "Garcia", dob: "1995-12-07", gender: "female", phone: "(713) 555-0107", status: "active", clinicianIdx: 4, referral: "Community Referral" },
  { first_name: "Ethan", last_name: "Taylor", dob: "1990-04-19", gender: "male", phone: "(713) 555-0108", status: "active", clinicianIdx: 5, referral: "Physician Referral" },
  { first_name: "Olivia", last_name: "Robinson", dob: "2003-08-30", gender: "female", phone: "(713) 555-0109", status: "intake", clinicianIdx: 2, referral: "Family Referral" },
  { first_name: "William", last_name: "Lee", dob: "1975-06-11", gender: "male", phone: "(713) 555-0110", status: "discharged", clinicianIdx: 0, referral: "EAP" },
  { first_name: "Mia", last_name: "Harris", dob: "1983-02-25", gender: "female", phone: "(713) 555-0111", status: "active", clinicianIdx: 3, referral: "Community Referral" },
  { first_name: "Alexander", last_name: "Clark", dob: "1997-10-08", gender: "male", phone: "(713) 555-0112", status: "active", clinicianIdx: 4, referral: "Crisis Line" },
];

const patientIds: string[] = [];
for (let i = 0; i < patientData.length; i++) {
  const p = patientData[i];
  const id = randomUUID();
  patientIds.push(id);
  const mrn = `MRN-2026-${String(i + 1).padStart(5, "0")}`;
  const intakeDate = daysAgo(p.status === "discharged" ? 120 : Math.floor(Math.random() * 60));
  sqlite.exec(`INSERT INTO patients (id, mrn, first_name, last_name, date_of_birth, gender, phone, status, assigned_clinician_id, intake_date, referral_source, created_at, updated_at) VALUES ('${id}', '${mrn}', '${q(p.first_name)}', '${q(p.last_name)}', '${p.dob}', '${p.gender}', '${p.phone}', '${p.status}', '${clinicianIds[p.clinicianIdx]}', '${intakeDate}', '${q(p.referral)}', '${now}', '${now}')`);
}

// ─── Treatment Plans ─────────────────────────────────────────
console.log("[Seed] Creating treatment plans...");

const planData = [
  { patientIdx: 0, diagnosis: "F33.1 Major Depressive Disorder, Recurrent Moderate", problem: "Persistent depressive symptoms affecting daily functioning", clinicianIdx: 0, status: "active" },
  { patientIdx: 1, diagnosis: "F41.1 Generalized Anxiety Disorder", problem: "Excessive worry interfering with social and occupational functioning", clinicianIdx: 1, status: "active" },
  { patientIdx: 2, diagnosis: "F43.10 Post-Traumatic Stress Disorder", problem: "Trauma-related symptoms including flashbacks and hypervigilance", clinicianIdx: 0, status: "active" },
  { patientIdx: 3, diagnosis: "F10.20 Alcohol Use Disorder, Moderate", problem: "Pattern of alcohol use leading to clinically significant impairment", clinicianIdx: 2, status: "active" },
  { patientIdx: 5, diagnosis: "F84.0 Autism Spectrum Disorder", problem: "Social communication difficulties and restricted repetitive behaviors", clinicianIdx: 1, status: "under_review" },
  { patientIdx: 6, diagnosis: "F31.81 Bipolar II Disorder", problem: "Recurrent depressive episodes with hypomanic features", clinicianIdx: 4, status: "active" },
  { patientIdx: 7, diagnosis: "F43.22 Adjustment Disorder with Anxiety", problem: "Difficulty coping with recent life transition and job loss", clinicianIdx: 5, status: "active" },
];

const planIds: string[] = [];
for (let i = 0; i < planData.length; i++) {
  const tp = planData[i];
  const id = randomUUID();
  planIds.push(id);
  const goals = JSON.stringify([
    { description: "Reduce primary symptom severity by 50%", targetDate: futureDay(90) },
    { description: "Develop 3 coping strategies for distress management", targetDate: futureDay(60) },
    { description: "Improve daily functioning scores", targetDate: futureDay(120) },
  ]);
  const interventions = JSON.stringify([
    { type: "CBT", description: "Cognitive Behavioral Therapy sessions", frequency: "Weekly" },
    { type: "Medication", description: "Medication management and monitoring", frequency: "Monthly" },
    { type: "Skills Training", description: "DBT skills group participation", frequency: "Bi-weekly" },
  ]);
  sqlite.exec(`INSERT INTO treatment_plans (id, patient_id, plan_number, status, primary_diagnosis, presenting_problem, goals_json, interventions_json, start_date, review_date, assigned_clinician_id, created_at, updated_at) VALUES ('${id}', '${patientIds[tp.patientIdx]}', 'TP-2026-${String(i + 1).padStart(4, "0")}', '${tp.status}', '${q(tp.diagnosis)}', '${q(tp.problem)}', '${q(goals)}', '${q(interventions)}', '${daysAgo(30)}', '${futureDay(60)}', '${clinicianIds[tp.clinicianIdx]}', '${now}', '${now}')`);
}

// ─── Clinical Sessions ───────────────────────────────────────
console.log("[Seed] Creating clinical sessions...");

const complaints = ["Increased anxiety", "Mood improvement noted", "Discussed coping strategies", "Medication side effects", "Relationship stress", "Sleep difficulties"];
const notes = [
  "Patient reports some improvement in sleep. Continues to struggle with morning anxiety. Homework: practice breathing exercises daily.",
  "Discussed CBT techniques for thought restructuring. Patient engaged well. Plan to continue weekly sessions.",
  "Reviewed medication compliance. Side effects minimal. Mood stable this week.",
  "Family dynamics explored. Patient identifying triggers. Progress noted.",
  "Crisis plan reviewed. Safety contract in place. Patient has support system contacts.",
];

for (let pIdx = 0; pIdx < patientData.length; pIdx++) {
  const numSessions = patientData[pIdx].status === "discharged" ? 8 : patientData[pIdx].status === "intake" ? 1 : 4 + Math.floor(Math.random() * 6);
  const patientPlanIdx = planData.findIndex((tp) => tp.patientIdx === pIdx);

  for (let s = 0; s < numSessions; s++) {
    const id = randomUUID();
    const sessionDate = daysAgo((numSessions - s) * 7 + Math.floor(Math.random() * 3));
    const types = ["individual", "group", "family", "intake", "crisis", "telehealth"];
    const sessionType = types[Math.floor(Math.random() * types.length)];
    const status = s === numSessions - 1 && patientData[pIdx].status !== "discharged" ? "scheduled" : "completed";
    const planId = patientPlanIdx >= 0 ? planIds[patientPlanIdx] : null;
    const bc = ["90834", "90837", "90791", "90847", "90853", null][Math.floor(Math.random() * 6)];
    const risk = Math.random() > 0.7 ? JSON.stringify({ suicideRisk: ["none", "none", "none", "low", "moderate"][Math.floor(Math.random() * 5)], homocideRisk: "none", elopementRisk: "none" }) : null;
    const cIdx = patientPlanIdx >= 0 ? planData[patientPlanIdx].clinicianIdx : Math.floor(Math.random() * clinicianIds.length);

    sqlite.exec(`INSERT INTO clinical_sessions (id, patient_id, treatment_plan_id, clinician_id, session_date, session_type, duration_minutes, chief_complaint, session_notes, risk_assessment_json, status, billing_code, created_at, updated_at) VALUES ('${id}', '${patientIds[pIdx]}', ${planId ? `'${planId}'` : "NULL"}, '${clinicianIds[cIdx]}', '${sessionDate}', '${sessionType}', 60, '${q(complaints[Math.floor(Math.random() * complaints.length)])}', '${q(notes[Math.floor(Math.random() * notes.length)])}', ${risk ? `'${q(risk)}'` : "NULL"}, '${status}', ${bc ? `'${bc}'` : "NULL"}, '${now}', '${now}')`);
  }
}

// ─── Outcome Measures ────────────────────────────────────────
console.log("[Seed] Creating outcome measures...");

const measureConfigs = [
  { type: "PHQ-9", max: 27 },
  { type: "GAD-7", max: 21 },
  { type: "PSS-10", max: 40 },
];

for (let pIdx = 0; pIdx < patientData.length; pIdx++) {
  if (patientData[pIdx].status === "intake") continue;
  for (const mc of measureConfigs) {
    for (let w = 0; w < 4; w++) {
      const score = Math.floor(Math.random() * (mc.max * 0.6)) + 1;
      let sev: string | null = null;
      if (mc.type === "PHQ-9") sev = score <= 4 ? "minimal" : score <= 9 ? "mild" : score <= 14 ? "moderate" : score <= 19 ? "moderately_severe" : "severe";
      else if (mc.type === "GAD-7") sev = score <= 4 ? "minimal" : score <= 9 ? "mild" : score <= 14 ? "moderate" : "severe";
      sqlite.exec(`INSERT INTO outcome_measures (id, patient_id, measure_type, score, max_score, severity_level, administered_by, administered_at, created_at) VALUES ('${randomUUID()}', '${patientIds[pIdx]}', '${mc.type}', ${score}, ${mc.max}, ${sev ? `'${sev}'` : "NULL"}, '${clinicianIds[Math.floor(Math.random() * clinicianIds.length)]}', '${daysAgo(w * 14 + Math.floor(Math.random() * 7))}', '${now}')`);
    }
  }
}

// ─── Claims ──────────────────────────────────────────────────
console.log("[Seed] Creating claims...");

const claimStatuses = ["draft", "pending", "submitted", "acknowledged", "pending_review", "approved", "denied", "appealed", "paid", "write_off"];
const procedureCodes = ["90834", "90837", "90791", "90847", "90853", "99408"];

for (let i = 0; i < 25; i++) {
  const id = randomUUID();
  const pIdx = Math.floor(Math.random() * patientData.length);
  const payerIdx = Math.floor(Math.random() * payerData.length);
  const cIdx = Math.floor(Math.random() * clinicianIds.length);
  const status = claimStatuses[Math.floor(Math.random() * claimStatuses.length)];
  const totalAmount = 10000 + Math.floor(Math.random() * 40000);
  const paidAmount = status === "paid" ? Math.floor(totalAmount * (0.6 + Math.random() * 0.3)) : status === "denied" ? 0 : Math.floor(totalAmount * (0.3 + Math.random() * 0.4));
  const serviceDate = daysAgo(Math.floor(Math.random() * 90));
  const submissionDate = ["submitted", "acknowledged", "pending_review", "approved", "denied", "appealed", "paid"].includes(status) ? daysAgo(Math.floor(Math.random() * 30)) : null;

  sqlite.exec(`INSERT INTO claims (id, claim_number, patient_id, payer_id, clinician_id, service_date, submission_date, status, total_amount, paid_amount, denial_reason, denial_code, created_at, updated_at) VALUES ('${id}', 'CLM-2026-${String(i + 1).padStart(6, "0")}', '${patientIds[pIdx]}', '${payerData[payerIdx].id}', '${clinicianIds[cIdx]}', '${serviceDate}', ${submissionDate ? `'${submissionDate}'` : "NULL"}, '${status}', ${totalAmount}, ${paidAmount}, ${status === "denied" ? "'Service not covered under current plan'" : "NULL"}, ${status === "denied" ? "'CO-50'" : "NULL"}, '${now}', '${now}')`);

  const numLines = 1 + Math.floor(Math.random() * 3);
  for (let l = 0; l < numLines; l++) {
    const units = 1 + Math.floor(Math.random() * 2);
    const unitPrice = Math.floor(totalAmount / numLines / units);
    const descriptions = ["Individual therapy session", "Initial psychiatric evaluation", "Family therapy session", "Group therapy session", "Medication management"];
    sqlite.exec(`INSERT INTO claim_line_items (id, claim_id, service_date, procedure_code, units, unit_price, total_price, description, created_at) VALUES ('${randomUUID()}', '${id}', '${serviceDate}', '${procedureCodes[Math.floor(Math.random() * procedureCodes.length)]}', ${units}, ${unitPrice}, ${units * unitPrice}, '${q(descriptions[Math.floor(Math.random() * descriptions.length)])}', '${now}')`);
  }
}

// ─── Audits ──────────────────────────────────────────────────
console.log("[Seed] Creating audits...");

const auditData = [
  { title: "Q2 2026 HIPAA Privacy Audit", type: "regulatory", scope: "Review of all HIPAA privacy policies, staff training records, and patient data access logs", score: 98, status: "completed" },
  { title: "Clinical Documentation Review", type: "peer_review", scope: "Random sample of 20 clinical session notes for completeness and compliance", score: 92, status: "completed" },
  { title: "Medication Management Audit", type: "internal", scope: "Review of medication prescribing patterns, storage, and documentation", score: 88, status: "pending_review" },
  { title: "Staff Credential Verification", type: "internal", scope: "Verification of all clinical staff licenses and certifications", score: 0, status: "in_progress" },
  { title: "Q3 2026 Random Chart Audit", type: "random", scope: "Random selection of 15 patient charts for treatment plan compliance", score: 0, status: "planned" },
];

for (let i = 0; i < auditData.length; i++) {
  const a = auditData[i];
  const findings = a.score > 0 ? JSON.stringify([{ finding: "Minor documentation gap", severity: "low", status: "resolved" }]) : "[]";
  sqlite.exec(`INSERT INTO audits_qa (id, audit_number, title, audit_type, scope, status, findings_json, score, started_at, due_date, created_at, updated_at) VALUES ('${randomUUID()}', 'AUD-2026-${String(i + 1).padStart(4, "0")}', '${q(a.title)}', '${a.type}', '${q(a.scope)}', '${a.status}', '${q(findings)}', ${a.score > 0 ? a.score : "NULL"}, ${a.status !== "planned" ? `'${daysAgo(30)}'` : "NULL"}, '${futureDay(30)}', '${now}', '${now}')`);
}

// ─── Incidents ───────────────────────────────────────────────
console.log("[Seed] Creating incidents...");

const incidentData = [
  { title: "Client eloped from group session", type: "behavioral", severity: "high", description: "Client left group therapy session without notifying staff. Found in parking lot 10 minutes later.", status: "resolved", patientIdx: 3, daysAgo: 14 },
  { title: "Medication count discrepancy", type: "medication_error", severity: "moderate", description: "End-of-shift count showed 2 missing lorazepam tablets. Investigation ongoing.", status: "under_investigation", daysAgo: 3 },
  { title: "Slip and fall in lobby", type: "environmental", severity: "low", description: "Visitor slipped on wet floor near entrance. No injury reported. Mop sign was not placed.", status: "resolved", daysAgo: 21 },
  { title: "Client threatened self-harm", type: "behavioral", severity: "critical", description: "Client expressed suicidal ideation during individual session. Safety plan activated. Crisis team responded.", status: "resolved", patientIdx: 0, daysAgo: 7 },
  { title: "Therapy room equipment failure", type: "equipment", severity: "low", description: "White noise machine in Room 204 malfunctioned. Session moved to alternate room.", status: "closed", daysAgo: 5 },
];

for (let i = 0; i < incidentData.length; i++) {
  const inc = incidentData[i];
  sqlite.exec(`INSERT INTO incidents (id, incident_number, title, description, incident_type, severity, status, patient_id, reported_by, occurred_at, resolved_at, resolution_notes, created_at, updated_at) VALUES ('${randomUUID()}', 'INC-2026-${String(i + 1).padStart(4, "0")}', '${q(inc.title)}', '${q(inc.description)}', '${inc.type}', '${inc.severity}', '${inc.status}', ${inc.patientIdx !== undefined ? `'${patientIds[inc.patientIdx]}'` : "NULL"}, '${clinicianIds[Math.floor(Math.random() * clinicianIds.length)]}', '${daysAgo(inc.daysAgo)}', ${inc.status === "resolved" || inc.status === "closed" ? `'${daysAgo(inc.daysAgo - 2)}'` : "NULL"}, ${inc.status === "resolved" ? "'Follow-up completed. Safety measures reinforced.'" : "NULL"}, '${now}', '${now}')`);
}

// ─── Corrective Actions ──────────────────────────────────────
console.log("[Seed] Creating corrective actions...");

const caData = [
  { title: "Implement elopement protocol training", priority: "high", status: "in_progress", assignedTo: clinicianIds[2], due: futureDay(14) },
  { title: "Update medication count procedures", priority: "urgent", status: "open", assignedTo: clinicianIds[1], due: futureDay(7) },
  { title: "Review and replace lobby floor mats", priority: "low", status: "completed", assignedTo: clinicianIds[0], due: daysAgo(5) },
  { title: "Revise safety plan documentation", priority: "high", status: "pending_verification", assignedTo: clinicianIds[3], due: futureDay(3) },
];

for (let i = 0; i < caData.length; i++) {
  const ca = caData[i];
  sqlite.exec(`INSERT INTO corrective_actions (id, action_number, title, description, priority, status, assigned_to, due_date, completed_at, created_at, updated_at) VALUES ('${randomUUID()}', 'CA-2026-${String(i + 1).padStart(4, "0")}', '${q(ca.title)}', '${q(ca.title + " - detailed implementation required")}', '${ca.priority}', '${ca.status}', '${ca.assignedTo}', '${ca.due}', ${ca.status === "completed" ? `'${daysAgo(2)}'` : "NULL"}, '${now}', '${now}')`);
}

console.log("[Seed] Complete!");
console.log(`  - ${patientData.length} patients`);
console.log(`  - ${planData.length} treatment plans`);
console.log(`  - 50+ clinical sessions`);
console.log(`  - 100+ outcome measures`);
console.log(`  - 25 claims`);
console.log(`  - ${auditData.length} audits`);
console.log(`  - ${incidentData.length} incidents`);
console.log(`  - ${caData.length} corrective actions`);
