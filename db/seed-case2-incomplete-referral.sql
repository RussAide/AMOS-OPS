-- SYNTHETIC EVALUATION FIXTURE ONLY.
-- Execute only through a guarded workflow using an isolated demo/evaluation
-- database. This SQL file is intentionally not exposed as a package script.
-- ═══════════════════════════════════════════════════════════════
-- Pilot Case 2: "Incomplete Referral" — 14yo Female, Behavioral
-- Task: D012-02 — Gap Detection Workflow
-- SQL Seed Script — Idempotent (safe to re-run)
-- ═══════════════════════════════════════════════════════════════

-- ─── Idempotent Cleanup ────────────────────────────────────────

DELETE FROM youth_profiles WHERE mrn = 'SYNTH-CASE2-RECORD-001';
DELETE FROM workflow_instances_v2 WHERE entity_id = 'PATIENT-B-UUID';
DELETE FROM intake_pipeline WHERE mrn = 'SYNTH-CASE2-RECORD-001';
DELETE FROM referral_checklists WHERE youth_id = 'PATIENT-B-UUID';
DELETE FROM notifications WHERE person_name = 'Synthetic Youth Case-002';
DELETE FROM audit_logs WHERE entity_type = 'intake_pipeline' AND entity_id = 'INTAKE-B-UUID';
DELETE FROM status_transitions WHERE person_name = 'Synthetic Youth Case-002';
DELETE FROM authorizations WHERE mrn = 'SYNTH-CASE2-RECORD-001';

-- ─── Ensure Tables Exist ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS youth_profiles (
  id TEXT PRIMARY KEY,
  mrn TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT,
  race TEXT,
  ethnicity TEXT,
  preferred_language TEXT DEFAULT 'English',
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  guardian1_name TEXT NOT NULL,
  guardian1_relationship TEXT NOT NULL,
  guardian1_phone TEXT NOT NULL,
  guardian1_email TEXT,
  guardian2_name TEXT,
  guardian2_relationship TEXT,
  guardian2_phone TEXT,
  guardian2_email TEXT,
  emergency_name TEXT,
  emergency_relationship TEXT,
  emergency_phone TEXT,
  referral_source_type TEXT,
  referral_source_name TEXT,
  referral_source_phone TEXT,
  referred_by TEXT,
  referral_date TEXT,
  assigned_clinician_id TEXT,
  assigned_clinician_name TEXT,
  assigned_case_manager_id TEXT,
  assigned_case_manager_name TEXT,
  status TEXT NOT NULL DEFAULT 'referral_pending',
  level_of_care TEXT DEFAULT 'not_yet_determined',
  bed_assignment TEXT,
  primary_payer_id TEXT,
  primary_payer_name TEXT,
  policy_number TEXT,
  group_number TEXT,
  subscriber_name TEXT,
  subscriber_relationship TEXT,
  admission_date TEXT,
  projected_discharge_date TEXT,
  actual_discharge_date TEXT,
  discharge_reason TEXT,
  discharge_disposition TEXT,
  created_at TEXT,
  updated_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS workflow_definitions_v2 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status_map TEXT,
  evidence_gates TEXT,
  escalation_rules TEXT,
  entity_type TEXT NOT NULL DEFAULT 'general',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS workflow_instances_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  current_status TEXT NOT NULL,
  previous_status TEXT,
  assigned_to TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  due_date TEXT,
  escalation_level INTEGER DEFAULT 0,
  escalation_reason TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS workflow_transitions_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor TEXT,
  reason TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS workflow_evidence_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id INTEGER NOT NULL,
  gate_name TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  submitted_by TEXT,
  submitted_at TEXT,
  validated INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS intake_pipeline (
  id TEXT PRIMARY KEY,
  youth_id TEXT NOT NULL,
  mrn TEXT NOT NULL,
  youth_name TEXT NOT NULL,
  referral_received_date TEXT,
  referral_received_by TEXT,
  referral_received_notes TEXT,
  referral_received_completed INTEGER DEFAULT 0,
  screening_date TEXT,
  screening_completed_by TEXT,
  screening_result TEXT,
  screening_notes TEXT,
  screening_completed INTEGER DEFAULT 0,
  consent_date TEXT,
  consent_completed_by TEXT,
  guardian_consent_obtained INTEGER DEFAULT 0,
  youth_assent_obtained INTEGER DEFAULT 0,
  hipaa_acknowledgment INTEGER DEFAULT 0,
  rights_acknowledgment INTEGER DEFAULT 0,
  consent_notes TEXT,
  consent_completed INTEGER DEFAULT 0,
  payer_verification_date TEXT,
  payer_verification_completed_by TEXT,
  benefits_verified INTEGER DEFAULT 0,
  authorization_required INTEGER DEFAULT 0,
  authorization_submitted INTEGER DEFAULT 0,
  authorization_approved INTEGER DEFAULT 0,
  payer_notes TEXT,
  payer_completed INTEGER DEFAULT 0,
  disposition_date TEXT,
  disposition_completed_by TEXT,
  disposition TEXT,
  disposition_reason TEXT,
  bed_assigned TEXT,
  admission_scheduled_date TEXT,
  disposition_completed INTEGER DEFAULT 0,
  current_step TEXT DEFAULT 'referral',
  overall_status TEXT DEFAULT 'in_progress',
  is_blocked INTEGER DEFAULT 0,
  block_reason TEXT,
  referral_elapsed_hours INTEGER DEFAULT 0,
  screening_elapsed_hours INTEGER DEFAULT 0,
  consent_elapsed_hours INTEGER DEFAULT 0,
  payer_elapsed_hours INTEGER DEFAULT 0,
  disposition_elapsed_hours INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS referral_checklists (
  id TEXT PRIMARY KEY,
  youth_id TEXT NOT NULL,
  intake_id TEXT NOT NULL,
  item1_referral_form_received INTEGER DEFAULT 0,
  item2_demographics_complete INTEGER DEFAULT 0,
  item3_insurance_verified INTEGER DEFAULT 0,
  item4_consent_for_release INTEGER DEFAULT 0,
  item5_psychiatric_history INTEGER DEFAULT 0,
  item6_medical_records_requested INTEGER DEFAULT 0,
  item7_educational_records_requested INTEGER DEFAULT 0,
  item8_legal_status_confirmed INTEGER DEFAULT 0,
  item9_guardian_contact_verified INTEGER DEFAULT 0,
  item10_service_activation_date_set INTEGER DEFAULT 0,
  items_completed INTEGER DEFAULT 0,
  items_total INTEGER DEFAULT 10,
  all_items_complete INTEGER DEFAULT 0,
  completed_by TEXT,
  completed_at TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  person_name TEXT,
  module_name TEXT,
  action_href TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  performed_at TEXT,
  old_values TEXT,
  new_values TEXT
);

CREATE TABLE IF NOT EXISTS status_transitions (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  person_name TEXT NOT NULL,
  module_id TEXT NOT NULL,
  module_name TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS authorizations (
  id TEXT PRIMARY KEY,
  youth_id TEXT NOT NULL,
  youth_name TEXT NOT NULL,
  mrn TEXT NOT NULL,
  payer_name TEXT NOT NULL,
  policy_number TEXT,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  readiness_clinical_docs INTEGER DEFAULT 0,
  readiness_assessment_current INTEGER DEFAULT 0,
  readiness_loc_supported INTEGER DEFAULT 0,
  readiness_treatment_plan INTEGER DEFAULT 0,
  readiness_progress_notes INTEGER DEFAULT 0,
  readiness_medical_necessity INTEGER DEFAULT 0,
  readiness_utilization_review INTEGER DEFAULT 0,
  readiness_guardian_consent INTEGER DEFAULT 0,
  readiness_ub04_clean INTEGER DEFAULT 0,
  readiness_excluded_services INTEGER DEFAULT 0,
  readiness_met_at TEXT,
  submission_date TEXT,
  submitted_by TEXT,
  submission_method TEXT,
  submission_reference TEXT,
  authorization_number TEXT,
  approved_units INTEGER,
  approved_from_date TEXT,
  approved_to_date TEXT,
  created_at TEXT,
  updated_at TEXT,
  created_by TEXT
);

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Patient B — Youth Profile
-- ═══════════════════════════════════════════════════════════════

INSERT INTO youth_profiles (
  id, mrn, first_name, last_name, date_of_birth, age, gender,
  guardian1_name, guardian1_relationship, guardian1_phone, guardian1_email,
  guardian2_name, guardian2_relationship, guardian2_phone,
  referral_source_type, referral_source_name, referral_source_phone, referred_by, referral_date,
  status, level_of_care, notes,
  created_at, updated_at, created_by
) VALUES (
  'PATIENT-B-001',
  'SYNTH-CASE2-RECORD-001',
  'Synthetic',
  'Case-002',
  '2011-01-01',
  14,
  'female',
  'Synthetic Guardian 15',
  'Mother',
  '+1-555-0101',
  'guardian.case2@example.invalid',
  'Synthetic Guardian 14',
  'Father',
  '+1-555-0102',
  'school',
  'Synthetic School Referral Office',
  '+1-555-0103',
  'Synthetic School Counselor',
  '2025-06-25T00:00:00.000Z',
  'referral_pending',
  'not_yet_determined',
  '[PILOT CASE 2] 14yo female presenting with behavioral challenges including: defiance at school, verbal aggression toward peers, declining academic performance over past semester, two disciplinary referrals in past 60 days. School counselor referred for behavioral health evaluation. Presenting concerns: Oppositional behavior, emotional dysregulation, peer conflict. No prior psychiatric hospitalizations. No current medications. Family history: Parents divorced, joint custody, primarily resides with mother.',
  '2025-06-25T00:00:00.000Z',
  '2025-06-25T00:00:00.000Z',
  'pilot-intake-coordinator@amos-ops.invalid'
);

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: WF-001 Workflow Definition
-- ═══════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO workflow_definitions_v2 (id, name, description, status_map, evidence_gates, escalation_rules, entity_type, created_at) VALUES (
  'WF-001',
  'Referral Intake',
  'Youth referral intake workflow from receipt through scheduling',
  '["RECEIVED","SCREENING","ACCEPTED","DECLINED","SCHEDULED"]',
  '[{"name":"demographics_form","required":true,"description":"Complete demographics form for the youth"},{"name":"insurance_verification","required":true,"description":"Insurance eligibility verification completed"},{"name":"clinical_criteria_checklist","required":true,"description":"Clinical criteria checklist for admission"}]',
  '[{"condition":"unscreened_over_48h","triggerDescription":">48 hours unscreened","target":"supervisor","maxHours":48},{"condition":"clinical_risk_detected","triggerDescription":"Clinical risk detected during screening","target":"Treatment Director"}]',
  'patient',
  '2025-06-25T00:00:00.000Z'
);

-- ═══════════════════════════════════════════════════════════════
-- STEP 3: WF-001 Workflow Instance
-- ═══════════════════════════════════════════════════════════════

INSERT INTO workflow_instances_v2 (
  workflow_id, entity_id, entity_type, current_status, previous_status,
  assigned_to, created_by, created_at, updated_at, due_date,
  escalation_level, notes
) VALUES (
  'WF-001',
  'PATIENT-B-001',
  'patient',
  'RECEIVED',
  '',
  'pilot-intake-coordinator@amos-ops.invalid',
  'pilot-intake-coordinator@amos-ops.invalid',
  '2025-06-25T00:00:00.000Z',
  '2025-06-30T00:00:00.000Z',
  '2025-07-12T00:00:00.000Z',
  0,
  '[PILOT CASE 2] INCOMPLETE REFERRED
Day 1: Referral received with missing documents.
Missing: guardian_consent_form, school_records
System gap alert triggered automatically.'
);

-- Get the instance ID (SQLite-specific)
-- Note: In practice, query last_insert_rowid() after insert

-- ═══════════════════════════════════════════════════════════════
-- STEP 4: Intake Pipeline
-- ═══════════════════════════════════════════════════════════════

INSERT INTO intake_pipeline (
  id, youth_id, mrn, youth_name,
  referral_received_date, referral_received_by, referral_received_notes, referral_received_completed,
  screening_date, screening_completed_by, screening_result, screening_notes, screening_completed,
  consent_date, consent_completed_by, guardian_consent_obtained, youth_assent_obtained,
  hipaa_acknowledgment, rights_acknowledgment, consent_notes, consent_completed,
  payer_verification_date, payer_verification_completed_by, benefits_verified,
  authorization_required, authorization_submitted, authorization_approved,
  payer_notes, payer_completed,
  disposition_date, disposition_completed_by, disposition, disposition_reason,
  bed_assigned, admission_scheduled_date, disposition_completed,
  current_step, overall_status, is_blocked, block_reason,
  referral_elapsed_hours, screening_elapsed_hours, consent_elapsed_hours, payer_elapsed_hours,
  created_at, updated_at, created_by
) VALUES (
  'INTAKE-B-001',
  'PATIENT-B-001',
  'SYNTH-CASE2-RECORD-001',
  'Synthetic Youth Case-002',
  '2025-06-25T00:00:00.000Z',
  'pilot-intake-coordinator@amos-ops.invalid',
  'Referral form received via fax from school counselor. Incomplete: missing guardian consent and school records.',
  1,
  '2025-06-27T00:00:00.000Z',
  'pilot-intake-coordinator@amos-ops.invalid',
  'pass',
  'Screening passed. Youth meets criteria for behavioral health evaluation. Behavioral concerns confirmed. No imminent safety risks. Referral accepted pending documentation.',
  1,
  '2025-06-30T00:00:00.000Z',
  'pilot-intake-coordinator@amos-ops.invalid',
  1,
  1,
  1,
  1,
  'All consent documents signed. Guardian consent received Day 5 after initial gap alert. Youth assent obtained in office.',
  1,
  '2025-07-02T00:00:00.000Z',
  'pilot-intake-coordinator@amos-ops.invalid',
  1,
  1,
  1,
  0,
  'Insurance initially EXPIRED (Day 7). Mother provided updated Medicaid card with renewed eligibility. Benefits re-verified successfully. Authorization submitted Day 10, awaiting approval.',
  1,
  '2025-07-02T00:00:00.000Z',
  'pilot-intake-coordinator@amos-ops.invalid',
  'admit',
  'Referral accepted. All gaps resolved. Authorization submitted.',
  'Bed-3A',
  '2025-07-19T00:00:00.000Z',
  1,
  'disposition',
  'in_progress',
  0,
  NULL,
  48,
  24,
  72,
  48,
  '2025-06-25T00:00:00.000Z',
  '2025-07-02T00:00:00.000Z',
  'pilot-intake-coordinator@amos-ops.invalid'
);

-- ═══════════════════════════════════════════════════════════════
-- STEP 5: Referral Checklist (10/10 Complete)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO referral_checklists (
  id, youth_id, intake_id,
  item1_referral_form_received, item2_demographics_complete, item3_insurance_verified,
  item4_consent_for_release, item5_psychiatric_history, item6_medical_records_requested,
  item7_educational_records_requested, item8_legal_status_confirmed, item9_guardian_contact_verified,
  item10_service_activation_date_set,
  items_completed, items_total, all_items_complete,
  completed_by, completed_at, created_at, updated_at
) VALUES (
  'CHECKLIST-B-001',
  'PATIENT-B-001',
  'INTAKE-B-001',
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  10, 10, 1,
  'pilot-intake-coordinator@amos-ops.invalid',
  '2025-07-02T00:00:00.000Z',
  '2025-06-25T00:00:00.000Z',
  '2025-07-02T00:00:00.000Z'
);

-- ═══════════════════════════════════════════════════════════════
-- STEP 6: Gap Alerts (The Core Evidence)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO notifications (id, user_id, type, title, message, person_name, module_name, action_href, is_read, created_at) VALUES (
  'ALERT-B-001',
  'pilot-intake-coordinator@amos-ops.invalid',
  'alert',
  'GAP ALERT: Missing Guardian Consent Form',
  'Patient B (Synthetic Youth Case-002, MRN: SYNTH-CASE2-RECORD-001) — Referral received WITHOUT signed guardian consent form. This document is REQUIRED to proceed past the consent step.

Gap Details:
- Missing: Guardian Consent for Treatment (Form ICC-001)
- Severity: BLOCKING
- Step: consent
- Auto-generated by gap detection system',
  'Synthetic Youth Case-002',
  'intake_pipeline',
  '/patients/PATIENT-B-001/intake',
  1,
  '2025-06-25T00:00:00.000Z'
);

INSERT INTO notifications (id, user_id, type, title, message, person_name, module_name, action_href, is_read, created_at) VALUES (
  'ALERT-B-002',
  'pilot-intake-coordinator@amos-ops.invalid',
  'alert',
  'GAP ALERT: Missing School Records',
  'Patient B (Synthetic Youth Case-002, MRN: SYNTH-CASE2-RECORD-001) — Referral received WITHOUT school records/academic history.

Gap Details:
- Missing: School records, IEP/504 evaluations, disciplinary history
- Severity: BLOCKING
- Step: referral
- Auto-generated by gap detection system',
  'Synthetic Youth Case-002',
  'intake_pipeline',
  '/patients/PATIENT-B-001/intake',
  1,
  '2025-06-25T00:00:00.000Z'
);

INSERT INTO notifications (id, user_id, type, title, message, person_name, module_name, action_href, is_read, created_at) VALUES (
  'ALERT-B-003',
  'pilot-intake-coordinator@amos-ops.invalid',
  'alert',
  'INSURANCE EXPIRED: Benefits Verification Failed',
  'Patient B (Synthetic Youth Case-002, MRN: SYNTH-CASE2-RECORD-001) — Insurance verification FAILED. Medicaid eligibility shows EXPIRED as of 2025-06-28.

Issue Details:
- Payer: Texas Medicaid (STAR Health)
- Policy Number: TMP-4455-7788
- Error: Eligibility expired 2025-06-30
- Action Required: Contact guardian for updated insurance card
- Step: payer
- Auto-generated by insurance verification system',
  'Synthetic Youth Case-002',
  'intake_pipeline',
  '/patients/PATIENT-B-001/insurance',
  1,
  '2025-06-28T00:00:00.000Z'
);

-- ═══════════════════════════════════════════════════════════════
-- STEP 7: Audit Log Entries
-- ═══════════════════════════════════════════════════════════════

INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by, performed_at, old_values, new_values) VALUES
('AUDIT-B-001', 'intake_pipeline', 'INTAKE-B-001', 'gap_detected', 'system@amos-ops.invalid', '2025-06-25T00:00:00.000Z',
 '{"status":"referral_pending","guardian_consent":null,"school_records":null}',
 '{"status":"referral_pending","guardian_consent":"MISSING","school_records":"MISSING","alerts":2}'),

('AUDIT-B-002', 'intake_pipeline', 'INTAKE-B-001', 'partial_documentation_received', 'guardian.case2@example.invalid', '2025-06-27T00:00:00.000Z',
 '{"guardian_consent":"MISSING","school_records":"MISSING"}',
 '{"guardian_consent":"RECEIVED","school_records":"STILL_MISSING","alerts_resolved":1,"alerts_remaining":1}'),

('AUDIT-B-003', 'intake_pipeline', 'INTAKE-B-001', 'all_documentation_complete', 'pilot-intake-coordinator@amos-ops.invalid', '2025-06-30T00:00:00.000Z',
 '{"guardian_consent":"RECEIVED","school_records":"STILL_MISSING","overall":"INCOMPLETE"}',
 '{"guardian_consent":"RECEIVED","school_records":"RECEIVED","overall":"COMPLETE","status":"ACCEPTED"}'),

('AUDIT-B-004', 'intake_pipeline', 'INTAKE-B-001', 'insurance_expired_detected', 'system@amos-ops.invalid', '2025-06-28T00:00:00.000Z',
 '{"insurance_status":"active","payer_verification":"passed"}',
 '{"insurance_status":"EXPIRED","payer_verification":"FAILED","action_required":"contact_guardian"}'),

('AUDIT-B-005', 'intake_pipeline', 'INTAKE-B-001', 'insurance_updated_verified', 'pilot-intake-coordinator@amos-ops.invalid', '2025-06-30T00:00:00.000Z',
 '{"insurance_status":"EXPIRED","policy_number":"TMP-4455-7788","eligibility":"denied"}',
 '{"insurance_status":"ACTIVE","policy_number":"TMP-4455-7788-REN","eligibility":"approved","verified_by":"pilot-intake-coordinator@amos-ops.invalid"}'),

('AUDIT-B-006', 'intake_pipeline', 'INTAKE-B-001', 'authorization_submitted', 'pilot-intake-coordinator@amos-ops.invalid', '2025-07-02T00:00:00.000Z',
 '{"authorization_submitted":false,"authorization_status":"not_submitted"}',
 '{"authorization_submitted":true,"authorization_status":"pending_approval","submitted_date":"2025-07-02T00:00:00.000Z"}');

-- ═══════════════════════════════════════════════════════════════
-- STEP 8: Status Transitions
-- ═══════════════════════════════════════════════════════════════

INSERT INTO status_transitions (id, person_id, person_name, module_id, module_name, from_status, to_status, changed_by, changed_at, note) VALUES
('ST-B-001', 'PATIENT-B-001', 'Synthetic Youth Case-002', 'intake_pipeline', 'Intake Pipeline', 'referral_pending', 'screening', 'pilot-intake-coordinator@amos-ops.invalid', '2025-06-26T00:00:00.000Z', '[Day 1] Referral received. Gap alerts: missing guardian consent, school records.'),
('ST-B-002', 'PATIENT-B-001', 'Synthetic Youth Case-002', 'intake_pipeline', 'Intake Pipeline', 'screening', 'intake', 'pilot-intake-coordinator@amos-ops.invalid', '2025-06-28T00:00:00.000Z', '[Day 3] Partial docs: Guardian consent received. School records still missing. Advancing to intake/consent step.'),
('ST-B-003', 'PATIENT-B-001', 'Synthetic Youth Case-002', 'intake_pipeline', 'Intake Pipeline', 'intake', 'assessment', 'pilot-intake-coordinator@amos-ops.invalid', '2025-06-30T00:00:00.000Z', '[Day 5] All documents complete. School records received from AISD. Referral ACCEPTED. Moving to payer step.'),
('ST-B-004', 'PATIENT-B-001', 'Synthetic Youth Case-002', 'intake_pipeline', 'Intake Pipeline', 'assessment', 'assessment', 'pilot-intake-coordinator@amos-ops.invalid', '2025-06-30T00:00:00.000Z', '[Day 7] Insurance EXPIRED detected. Updated Medicaid card provided by guardian. Benefits re-verified successfully.'),
('ST-B-005', 'PATIENT-B-001', 'Synthetic Youth Case-002', 'intake_pipeline', 'Intake Pipeline', 'assessment', 'active', 'pilot-intake-coordinator@amos-ops.invalid', '2025-07-02T00:00:00.000Z', '[Day 10] Authorization submitted. Awaiting approval. Bed assigned: 3A. Admission scheduled.');

-- ═══════════════════════════════════════════════════════════════
-- STEP 9: Authorization Record
-- ═══════════════════════════════════════════════════════════════

INSERT INTO authorizations (
  id, youth_id, youth_name, mrn, payer_name, policy_number, stage, status,
  readiness_clinical_docs, readiness_assessment_current, readiness_loc_supported,
  readiness_treatment_plan, readiness_progress_notes, readiness_medical_necessity,
  readiness_utilization_review, readiness_guardian_consent, readiness_ub04_clean,
  readiness_excluded_services, readiness_met_at,
  submission_date, submitted_by, submission_method, submission_reference,
  created_at, updated_at, created_by
) VALUES (
  'AUTH-B-001',
  'PATIENT-B-001',
  'Synthetic Youth Case-002',
  'SYNTH-CASE2-RECORD-001',
  'Texas Medicaid (STAR Health)',
  'TMP-4455-7788-REN',
  'submission',
  'submitted',
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  '2025-07-02T00:00:00.000Z',
  '2025-07-02T00:00:00.000Z',
  'pilot-intake-coordinator@amos-ops.invalid',
  'portal',
  'AUTH-REF-20250705-001',
  '2025-07-02T00:00:00.000Z',
  '2025-07-02T00:00:00.000Z',
  'pilot-intake-coordinator@amos-ops.invalid'
);

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (Run these to confirm)
-- ═══════════════════════════════════════════════════════════════

-- Count gap alerts for Patient B:
-- SELECT COUNT(*) FROM notifications WHERE person_name = 'Synthetic Youth Case-002' AND type = 'alert';
-- Expected: 3

-- Count resolved gaps (is_read = 1):
-- SELECT COUNT(*) FROM notifications WHERE person_name = 'Synthetic Youth Case-002' AND type = 'alert' AND is_read = 1;
-- Expected: 3

-- Check referral checklist completion:
-- SELECT items_completed, items_total, all_items_complete FROM referral_checklists WHERE youth_id = 'PATIENT-B-001';
-- Expected: 10, 10, 1

-- Check intake pipeline status:
-- SELECT current_step, overall_status, is_blocked FROM intake_pipeline WHERE youth_id = 'PATIENT-B-001';
-- Expected: disposition, in_progress, 0

-- Check audit log entries:
-- SELECT action, performed_by, performed_at FROM audit_logs WHERE entity_id = 'INTAKE-B-001' ORDER BY performed_at;
-- Expected: 6 rows showing gap lifecycle

-- ═══════════════════════════════════════════════════════════════
-- END OF SEED SCRIPT
-- ═══════════════════════════════════════════════════════════════
