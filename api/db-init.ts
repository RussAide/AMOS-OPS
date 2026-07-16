import { sqlite } from "./queries/connection";
import { ensureIdentitySchema } from "./security/identity-schema";
import { assertSyntheticScenarioRuntime, env } from "./lib/env";
import {
  ensurePhase2ControlSchema,
  seedPhase2ControlScenario,
} from "./services/phase2/runtime-schema";
import {
  ensurePhase3ControlSchema,
  seedPhase3ControlScenario,
} from "./services/phase3/runtime-schema";
import { ensureReviewOwnerAccount } from "./security/review-access";
import { bootstrapFreshDatabaseSchema } from "./fresh-schema";

interface SchemaDatabase {
  exec(sql: string): unknown;
}

/** Runtime fallback for environments that initialize an empty prototype DB before migration adoption. */
export function ensureM21CcmgSchema(db: SchemaDatabase = sqlite): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS m21_ccmg_referrals (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL UNIQUE,
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      youth_id TEXT NOT NULL,
      youth_display_label TEXT NOT NULL,
      referral_source_division TEXT NOT NULL CHECK (referral_source_division IN ('BHC','GRO','EO','GAD','external')),
      referred_at TEXT NOT NULL,
      referral_reason TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'routine' CHECK (urgency IN ('routine','urgent','emergency')),
      status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','screening','held','rejected','ready_for_routing','active','closed')),
      hold_reason TEXT,
      rejection_reason TEXT,
      intake_status TEXT NOT NULL DEFAULT 'not_started' CHECK (intake_status IN ('not_started','in_progress','complete')),
      intake_completed_at TEXT,
      intake_completed_by TEXT,
      eligibility_status TEXT NOT NULL DEFAULT 'pending' CHECK (eligibility_status IN ('pending','eligible','ineligible','needs_review')),
      age_qualified INTEGER NOT NULL DEFAULT 0 CHECK (age_qualified IN (0,1)),
      diagnosis_qualified INTEGER NOT NULL DEFAULT 0 CHECK (diagnosis_qualified IN (0,1)),
      functional_impairment INTEGER NOT NULL DEFAULT 0 CHECK (functional_impairment IN (0,1)),
      coverage_qualified INTEGER NOT NULL DEFAULT 0 CHECK (coverage_qualified IN (0,1)),
      eligibility_rationale TEXT,
      eligibility_determined_at TEXT,
      eligibility_determined_by TEXT,
      payer_label TEXT,
      payer_verification_status TEXT NOT NULL DEFAULT 'not_started' CHECK (payer_verification_status IN ('not_started','pending','verified','failed')),
      payer_verified_at TEXT,
      authorization_required INTEGER NOT NULL DEFAULT 0 CHECK (authorization_required IN (0,1)),
      authorization_status TEXT NOT NULL DEFAULT 'not_required' CHECK (authorization_status IN ('not_required','pending','approved','denied','expired')),
      authorization_reference TEXT,
      authorization_effective_at TEXT,
      authorization_expires_at TEXT,
      consent_status TEXT NOT NULL DEFAULT 'pending' CHECK (consent_status IN ('pending','active','declined','revoked','expired')),
      consent_reference TEXT,
      consent_effective_at TEXT,
      consent_expires_at TEXT,
      cans_status TEXT NOT NULL DEFAULT 'not_scheduled' CHECK (cans_status IN ('not_scheduled','scheduled','completed','overdue','cancelled')),
      cans_due_at TEXT,
      cans_scheduled_for TEXT,
      current_cans_assessment_id TEXT,
      current_cans_version INTEGER,
      cans_acuity TEXT NOT NULL DEFAULT 'not_assessed' CHECK (cans_acuity IN ('not_assessed','low','moderate','high','critical')),
      capacity_required INTEGER NOT NULL DEFAULT 0 CHECK (capacity_required IN (0,1)),
      capacity_facility_label TEXT,
      capacity_status TEXT NOT NULL DEFAULT 'not_required' CHECK (capacity_status IN ('not_required','unchecked','available','reserved','waitlisted','unavailable')),
      available_slots INTEGER,
      reserved_slot_reference TEXT,
      capacity_checked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
    );
    CREATE INDEX IF NOT EXISTS idx_m21_ccmg_referrals_mode_status
      ON m21_ccmg_referrals (evidence_class,status,urgency);

    CREATE TABLE IF NOT EXISTS m21_ccmg_cans_assessments (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL,
      referral_id TEXT NOT NULL,
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      version INTEGER NOT NULL CHECK (version > 0),
      instrument_version TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft','final','superseded')),
      previous_assessment_id TEXT,
      completed_at TEXT,
      completed_by TEXT,
      total_score INTEGER,
      acuity TEXT NOT NULL CHECK (acuity IN ('low','moderate','high','critical')),
      domain_scores_json TEXT NOT NULL,
      actionable_items_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (referral_id) REFERENCES m21_ccmg_referrals(id) ON DELETE RESTRICT,
      UNIQUE (referral_id,version)
    );
    CREATE TRIGGER IF NOT EXISTS m21_ccmg_cans_assessments_no_update
      BEFORE UPDATE ON m21_ccmg_cans_assessments
      BEGIN SELECT RAISE(ABORT, 'M21_CANS_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS m21_ccmg_cans_assessments_no_delete
      BEFORE DELETE ON m21_ccmg_cans_assessments
      BEGIN SELECT RAISE(ABORT, 'M21_CANS_IMMUTABLE'); END;

    CREATE TABLE IF NOT EXISTS m21_ccmg_plan_lineage (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL,
      referral_id TEXT NOT NULL,
      cans_assessment_id TEXT NOT NULL,
      cans_version INTEGER NOT NULL CHECK (cans_version > 0),
      target_type TEXT NOT NULL CHECK (target_type IN ('mhtcm_plan','mhrs_skills_goals')),
      target_record_id TEXT NOT NULL,
      target_version INTEGER NOT NULL CHECK (target_version > 0),
      target_approval_status TEXT NOT NULL CHECK (target_approval_status = 'approved'),
      target_approved_by TEXT NOT NULL,
      target_approved_at TEXT NOT NULL,
      routed_by TEXT NOT NULL,
      routed_at TEXT NOT NULL,
      mapped_goals_json TEXT NOT NULL,
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      created_at TEXT NOT NULL,
      FOREIGN KEY (referral_id) REFERENCES m21_ccmg_referrals(id) ON DELETE RESTRICT,
      FOREIGN KEY (cans_assessment_id) REFERENCES m21_ccmg_cans_assessments(id) ON DELETE RESTRICT,
      UNIQUE (cans_assessment_id,target_type,target_record_id,target_version)
    );
    CREATE TRIGGER IF NOT EXISTS m21_ccmg_plan_lineage_no_update
      BEFORE UPDATE ON m21_ccmg_plan_lineage
      BEGIN SELECT RAISE(ABORT, 'M21_LINEAGE_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS m21_ccmg_plan_lineage_no_delete
      BEFORE DELETE ON m21_ccmg_plan_lineage
      BEGIN SELECT RAISE(ABORT, 'M21_LINEAGE_IMMUTABLE'); END;

    CREATE TABLE IF NOT EXISTS m21_ccmg_work_items (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL,
      referral_id TEXT NOT NULL,
      youth_display_label TEXT NOT NULL,
      queue_id TEXT NOT NULL CHECK (queue_id IN ('intake','qa','cans','medication_management','mhtcm','mhrs')),
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending','in_progress','blocked','awaiting_approval','completed','cancelled')),
      priority TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','critical')),
      assigned_division TEXT NOT NULL CHECK (assigned_division IN ('BHC','GRO')),
      assigned_department TEXT NOT NULL CHECK (assigned_department IN ('CCMG','MHTCM','MHRS','GRO')),
      assigned_role TEXT NOT NULL,
      assigned_to TEXT,
      due_at TEXT NOT NULL,
      escalation_level TEXT NOT NULL DEFAULT 'none' CHECK (escalation_level IN ('none','supervisor','director','executive')),
      escalated_at TEXT,
      escalation_reason TEXT,
      approval_status TEXT NOT NULL DEFAULT 'not_required' CHECK (approval_status IN ('not_required','pending','approved','rejected')),
      approved_by TEXT,
      approved_at TEXT,
      approval_rationale TEXT,
      exception_code TEXT,
      exception_reason TEXT,
      exception_status TEXT NOT NULL DEFAULT 'none' CHECK (exception_status IN ('none','open','resolved','waived')),
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (referral_id) REFERENCES m21_ccmg_referrals(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_m21_ccmg_work_queue
      ON m21_ccmg_work_items (evidence_class,queue_id,status,due_at);

    CREATE TABLE IF NOT EXISTS m21_ccmg_handoffs (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL,
      referral_id TEXT NOT NULL,
      work_item_id TEXT NOT NULL,
      from_division TEXT NOT NULL CHECK (from_division IN ('BHC','GRO')),
      from_department TEXT NOT NULL CHECK (from_department IN ('CCMG','MHTCM','MHRS','GRO')),
      to_division TEXT NOT NULL CHECK (to_division IN ('BHC','GRO')),
      to_department TEXT NOT NULL CHECK (to_department IN ('CCMG','MHTCM','MHRS','GRO')),
      status TEXT NOT NULL CHECK (status IN ('initiated','accepted','rejected','returned','completed')),
      reason TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      initiated_by TEXT NOT NULL,
      initiated_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      accepted_by TEXT,
      accepted_at TEXT,
      completed_at TEXT,
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
      FOREIGN KEY (referral_id) REFERENCES m21_ccmg_referrals(id) ON DELETE RESTRICT,
      FOREIGN KEY (work_item_id) REFERENCES m21_ccmg_work_items(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_m21_ccmg_handoff_status
      ON m21_ccmg_handoffs (evidence_class,status,due_at);

    CREATE TABLE IF NOT EXISTS m21_ccmg_audit_events (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT,
      referral_id TEXT,
      work_item_id TEXT,
      event_type TEXT NOT NULL CHECK (event_type IN ('access','assignment','approval','plan_handoff','material_change')),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      reason TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      changed_fields_json TEXT NOT NULL DEFAULT '[]',
      correlation_id TEXT NOT NULL,
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      occurred_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_m21_ccmg_audit_entity
      ON m21_ccmg_audit_events (entity_type,entity_id,occurred_at);
    CREATE TRIGGER IF NOT EXISTS m21_ccmg_audit_events_no_update
      BEFORE UPDATE ON m21_ccmg_audit_events
      BEGIN SELECT RAISE(ABORT, 'M21_AUDIT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS m21_ccmg_audit_events_no_delete
      BEFORE DELETE ON m21_ccmg_audit_events
      BEGIN SELECT RAISE(ABORT, 'M21_AUDIT_IMMUTABLE'); END;
  `);
}

/** Idempotent fictional data for the explicitly controlled demo/evaluation posture only. */
export function seedM21CcmgSyntheticScenarios(
  db: SchemaDatabase = sqlite,
): void {
  db.exec(`
    INSERT OR IGNORE INTO m21_ccmg_referrals
      (id,case_id,evidence_class,youth_id,youth_display_label,referral_source_division,referred_at,referral_reason,urgency,status,intake_status,payer_label,payer_verification_status,authorization_required,authorization_status,cans_status,cans_due_at,cans_scheduled_for,capacity_required,capacity_facility_label,capacity_status,created_at,updated_at)
    VALUES
      ('M21-REF-NEW-001','M21-CASE-NEW-001','synthetic_demo','SYNTH-YOUTH-NEW-001','Synthetic Youth New-01','external','2026-07-14T08:00:00Z','Synthetic new referral requires controlled screening.','routine','screening','in_progress','Synthetic Payer Alpha','pending',1,'pending','scheduled','2026-07-16T17:00:00Z','2026-07-15T10:00:00Z',1,'Synthetic GRO Capacity Pool','unchecked','2026-07-14T08:00:00Z','2026-07-14T08:30:00Z');

    INSERT OR IGNORE INTO m21_ccmg_referrals
      (id,case_id,evidence_class,youth_id,youth_display_label,referral_source_division,referred_at,referral_reason,urgency,status,intake_status,intake_completed_at,intake_completed_by,eligibility_status,age_qualified,diagnosis_qualified,functional_impairment,coverage_qualified,eligibility_rationale,eligibility_determined_at,eligibility_determined_by,payer_label,payer_verification_status,payer_verified_at,authorization_required,authorization_status,authorization_reference,authorization_effective_at,authorization_expires_at,consent_status,consent_reference,consent_effective_at,consent_expires_at,cans_status,cans_due_at,cans_scheduled_for,current_cans_assessment_id,current_cans_version,cans_acuity,capacity_required,capacity_facility_label,capacity_status,available_slots,reserved_slot_reference,capacity_checked_at,created_at,updated_at,version)
    VALUES
      ('M21-REF-EXISTING-001','M21-CASE-EXISTING-001','synthetic_demo','SYNTH-YOUTH-EXISTING-001','Synthetic Youth Existing-01','GRO','2026-07-01T09:00:00Z','Synthetic existing youth requires coordinated MHTCM and MHRS oversight.','urgent','active','complete','2026-07-01T12:00:00Z','SYNTH-ACTOR-INTAKE','eligible',1,1,1,1,'All controlled prototype eligibility criteria met.','2026-07-01T13:00:00Z','SYNTH-ACTOR-ELIGIBILITY','Synthetic Payer Beta','verified','2026-07-01T13:30:00Z',1,'approved','SYNTH-AUTH-EXISTING-001','2026-07-01T00:00:00Z','2026-09-30T23:59:59Z','active','SYNTH-CONSENT-EXISTING-001','2026-07-01T00:00:00Z','2026-12-31T23:59:59Z','completed','2026-07-03T17:00:00Z','2026-07-03T10:00:00Z','M21-CANS-EXISTING-V2',2,'high',1,'Synthetic GRO Capacity Pool','reserved',2,'SYNTH-BED-RES-001','2026-07-01T14:00:00Z','2026-07-01T09:00:00Z','2026-07-10T15:00:00Z',3);

    INSERT OR IGNORE INTO m21_ccmg_referrals
      (id,case_id,evidence_class,youth_id,youth_display_label,referral_source_division,referred_at,referral_reason,urgency,status,hold_reason,intake_status,intake_completed_at,intake_completed_by,eligibility_status,eligibility_rationale,payer_label,payer_verification_status,authorization_required,authorization_status,consent_status,cans_status,capacity_required,capacity_facility_label,capacity_status,available_slots,capacity_checked_at,created_at,updated_at)
    VALUES
      ('M21-REF-HELD-001','M21-CASE-HELD-001','synthetic_demo','SYNTH-YOUTH-HELD-001','Synthetic Youth Held-01','external','2026-07-12T11:00:00Z','Synthetic referral held for missing eligibility evidence.','routine','held','Missing controlled eligibility and payer documentation.','complete','2026-07-12T12:00:00Z','SYNTH-ACTOR-INTAKE','needs_review','Required evidence is incomplete.','Synthetic Payer Gamma','failed',1,'pending','pending','not_scheduled',1,'Synthetic GRO Capacity Pool','waitlisted',0,'2026-07-12T13:00:00Z','2026-07-12T11:00:00Z','2026-07-12T13:00:00Z');

    INSERT OR IGNORE INTO m21_ccmg_referrals
      (id,case_id,evidence_class,youth_id,youth_display_label,referral_source_division,referred_at,referral_reason,urgency,status,intake_status,intake_completed_at,intake_completed_by,eligibility_status,age_qualified,diagnosis_qualified,functional_impairment,coverage_qualified,eligibility_rationale,eligibility_determined_at,eligibility_determined_by,payer_label,payer_verification_status,payer_verified_at,authorization_required,authorization_status,consent_status,consent_reference,consent_effective_at,consent_expires_at,cans_status,cans_due_at,cans_scheduled_for,current_cans_assessment_id,current_cans_version,cans_acuity,capacity_required,capacity_facility_label,capacity_status,available_slots,capacity_checked_at,created_at,updated_at,version)
    VALUES
      ('M21-REF-URGENT-001','M21-CASE-URGENT-001','synthetic_demo','SYNTH-YOUTH-URGENT-001','Synthetic Youth Urgent-01','GRO','2026-07-14T07:00:00Z','Synthetic urgent referral requires director escalation.','emergency','screening','complete','2026-07-14T07:30:00Z','SYNTH-ACTOR-INTAKE','eligible',1,1,1,1,'Urgent synthetic case meets controlled eligibility criteria.','2026-07-14T07:45:00Z','SYNTH-ACTOR-ELIGIBILITY','Synthetic Payer Delta','verified','2026-07-14T08:00:00Z',1,'pending','active','SYNTH-CONSENT-URGENT-001','2026-07-14T07:00:00Z','2026-08-31T23:59:59Z','completed','2026-07-14T09:00:00Z','2026-07-14T08:15:00Z','M21-CANS-URGENT-V1',1,'critical',1,'Synthetic GRO Capacity Pool','available',1,'2026-07-14T08:30:00Z','2026-07-14T07:00:00Z','2026-07-14T09:00:00Z',2);

    INSERT OR IGNORE INTO m21_ccmg_cans_assessments
      (id,case_id,referral_id,evidence_class,version,instrument_version,status,previous_assessment_id,completed_at,completed_by,total_score,acuity,domain_scores_json,actionable_items_json,created_at)
    VALUES
      ('M21-CANS-EXISTING-V1','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','synthetic_demo',1,'CANS-SYNTHETIC-2026.1','superseded',NULL,'2026-07-03T11:00:00Z','SYNTH-ACTOR-CANS',28,'moderate','{"behavioral_emotional":2,"risk_behaviors":2,"life_functioning":2,"strengths":1,"caregiver_resources":1,"cultural_factors":0}','[{"itemCode":"BEH-01","label":"emotional regulation","domain":"behavioral_emotional","rating":2,"disposition":"need"},{"itemCode":"LIF-01","label":"daily routine","domain":"life_functioning","rating":2,"disposition":"need"},{"itemCode":"STR-01","label":"community connection","domain":"strengths","rating":1,"disposition":"strength"}]','2026-07-03T11:00:00Z'),
      ('M21-CANS-EXISTING-V2','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','synthetic_demo',2,'CANS-SYNTHETIC-2026.1','final','M21-CANS-EXISTING-V1','2026-07-10T10:00:00Z','SYNTH-ACTOR-CANS',35,'high','{"behavioral_emotional":3,"risk_behaviors":3,"life_functioning":2,"strengths":1,"caregiver_resources":2,"cultural_factors":0}','[{"itemCode":"BEH-01","label":"emotional regulation","domain":"behavioral_emotional","rating":3,"disposition":"need"},{"itemCode":"RSK-01","label":"safety planning","domain":"risk_behaviors","rating":3,"disposition":"need"},{"itemCode":"LIF-01","label":"daily routine","domain":"life_functioning","rating":2,"disposition":"need"},{"itemCode":"STR-01","label":"community connection","domain":"strengths","rating":1,"disposition":"strength"}]','2026-07-10T10:00:00Z'),
      ('M21-CANS-URGENT-V1','M21-CASE-URGENT-001','M21-REF-URGENT-001','synthetic_demo',1,'CANS-SYNTHETIC-2026.1','final',NULL,'2026-07-14T08:45:00Z','SYNTH-ACTOR-CANS',44,'critical','{"behavioral_emotional":3,"risk_behaviors":3,"life_functioning":3,"strengths":2,"caregiver_resources":3,"cultural_factors":1}','[{"itemCode":"RSK-URG","label":"urgent safety coordination","domain":"risk_behaviors","rating":3,"disposition":"need"},{"itemCode":"LIF-URG","label":"immediate daily support","domain":"life_functioning","rating":3,"disposition":"need"}]','2026-07-14T08:45:00Z');

    INSERT OR IGNORE INTO m21_ccmg_plan_lineage
      (id,case_id,referral_id,cans_assessment_id,cans_version,target_type,target_record_id,target_version,target_approval_status,target_approved_by,target_approved_at,routed_by,routed_at,mapped_goals_json,evidence_class,created_at)
    VALUES
      ('M21-LINEAGE-EXISTING-V1-MHTCM','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-CANS-EXISTING-V1',1,'mhtcm_plan','SYNTH-MHTCM-PLAN-001',1,'approved','SYNTH-LPHA-APPROVER','2026-07-03T12:00:00Z','SYNTH-CCMG-DIRECTOR','2026-07-03T12:15:00Z','[{"sourceItemCode":"BEH-01","sourceDomain":"behavioral_emotional","sourceRating":2,"goalCode":"MHTCM-MONITORING-BEH-01","goalText":"Address emotional regulation through the approved monitoring function.","workflow":"MHTCM"}]','synthetic_demo','2026-07-03T12:15:00Z'),
      ('M21-LINEAGE-EXISTING-V1-MHRS','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-CANS-EXISTING-V1',1,'mhrs_skills_goals','SYNTH-MHRS-GOALS-001',1,'approved','SYNTH-LPHA-APPROVER','2026-07-03T12:00:00Z','SYNTH-CCMG-DIRECTOR','2026-07-03T12:15:00Z','[{"sourceItemCode":"LIF-01","sourceDomain":"life_functioning","sourceRating":2,"goalCode":"MHRS-SKILL-LIF-01","goalText":"Build and practice a measurable skill for daily routine.","workflow":"MHRS"}]','synthetic_demo','2026-07-03T12:15:00Z'),
      ('M21-LINEAGE-EXISTING-V2-MHTCM','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-CANS-EXISTING-V2',2,'mhtcm_plan','SYNTH-MHTCM-PLAN-001',2,'approved','SYNTH-LPHA-APPROVER','2026-07-10T11:00:00Z','SYNTH-CCMG-DIRECTOR','2026-07-10T11:15:00Z','[{"sourceItemCode":"RSK-01","sourceDomain":"risk_behaviors","sourceRating":3,"goalCode":"MHTCM-COORDINATION-RSK-01","goalText":"Address safety planning through the approved coordination function.","workflow":"MHTCM"}]','synthetic_demo','2026-07-10T11:15:00Z'),
      ('M21-LINEAGE-EXISTING-V2-MHRS','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-CANS-EXISTING-V2',2,'mhrs_skills_goals','SYNTH-MHRS-GOALS-001',2,'approved','SYNTH-LPHA-APPROVER','2026-07-10T11:00:00Z','SYNTH-CCMG-DIRECTOR','2026-07-10T11:15:00Z','[{"sourceItemCode":"LIF-01","sourceDomain":"life_functioning","sourceRating":2,"goalCode":"MHRS-SKILL-LIF-01","goalText":"Build and practice a measurable skill for daily routine.","workflow":"MHRS"},{"sourceItemCode":"STR-01","sourceDomain":"strengths","sourceRating":1,"goalCode":"MHRS-SKILL-STR-01","goalText":"Build and practice a measurable skill for community connection.","workflow":"MHRS"}]','synthetic_demo','2026-07-10T11:15:00Z');

    INSERT OR IGNORE INTO m21_ccmg_work_items
      (id,case_id,referral_id,youth_display_label,queue_id,title,status,priority,assigned_division,assigned_department,assigned_role,assigned_to,due_at,escalation_level,escalated_at,escalation_reason,approval_status,approved_by,approved_at,approval_rationale,exception_code,exception_reason,exception_status,source_type,source_id,evidence_class,version,created_at,updated_at)
    VALUES
      ('M21-WORK-INTAKE-001','M21-CASE-NEW-001','M21-REF-NEW-001','Synthetic Youth New-01','intake','Complete controlled referral intake','in_progress','routine','BHC','CCMG','intake-coordinator','SYNTH-INTAKE-COORDINATOR','2026-07-15T17:00:00Z','none',NULL,NULL,'not_required',NULL,NULL,NULL,NULL,NULL,'none','referral','M21-REF-NEW-001','synthetic_demo',1,'2026-07-14T08:00:00Z','2026-07-14T08:30:00Z'),
      ('M21-WORK-QA-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','Synthetic Youth Existing-01','qa','Resolve synthetic chart QA finding','blocked','urgent','BHC','CCMG','chart-auditor','SYNTH-CHART-AUDITOR','2026-07-13T17:00:00Z','supervisor','2026-07-14T08:00:00Z','QA item passed its controlled due date.','pending',NULL,NULL,NULL,'QA-EVIDENCE-MISSING','Synthetic signature evidence is missing.','open','qa_finding','SYNTH-QA-FINDING-001','synthetic_demo',2,'2026-07-10T12:00:00Z','2026-07-14T08:00:00Z'),
      ('M21-WORK-CANS-001','M21-CASE-NEW-001','M21-REF-NEW-001','Synthetic Youth New-01','cans','Complete scheduled CANS','pending','routine','BHC','CCMG','qmhp-cs','SYNTH-QMHP-001','2026-07-16T17:00:00Z','none',NULL,NULL,'not_required',NULL,NULL,NULL,NULL,NULL,'none','cans_schedule','M21-REF-NEW-001','synthetic_demo',1,'2026-07-14T08:30:00Z','2026-07-14T08:30:00Z'),
      ('M21-WORK-MED-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','Synthetic Youth Existing-01','medication_management','Review synthetic medication-management coordination','awaiting_approval','urgent','BHC','CCMG','nurse','SYNTH-NURSE-001','2026-07-14T17:00:00Z','none',NULL,NULL,'pending',NULL,NULL,NULL,NULL,NULL,'none','medication_oversight','SYNTH-MED-001','synthetic_demo',1,'2026-07-12T12:00:00Z','2026-07-12T12:00:00Z'),
      ('M21-WORK-MHTCM-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','Synthetic Youth Existing-01','mhtcm','Approve CANS v2 MHTCM plan handoff','completed','urgent','BHC','MHTCM','mhtcm-supervisor','SYNTH-MHTCM-SUPERVISOR','2026-07-10T17:00:00Z','none',NULL,NULL,'approved','SYNTH-LPHA-APPROVER','2026-07-10T11:00:00Z','Approved for synthetic prototype routing.',NULL,NULL,'none','cans_lineage','M21-CANS-EXISTING-V2','synthetic_demo',3,'2026-07-10T10:00:00Z','2026-07-10T11:15:00Z'),
      ('M21-WORK-MHRS-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','Synthetic Youth Existing-01','mhrs','Implement approved MHRS skills goals','in_progress','routine','BHC','MHRS','mhrs-supervisor','SYNTH-MHRS-SUPERVISOR','2026-07-18T17:00:00Z','none',NULL,NULL,'approved','SYNTH-LPHA-APPROVER','2026-07-10T11:00:00Z','Approved for synthetic prototype routing.',NULL,NULL,'none','cans_lineage','M21-CANS-EXISTING-V2','synthetic_demo',2,'2026-07-10T10:00:00Z','2026-07-11T09:00:00Z'),
      ('M21-WORK-URGENT-001','M21-CASE-URGENT-001','M21-REF-URGENT-001','Synthetic Youth Urgent-01','intake','Resolve urgent authorization exception','blocked','critical','BHC','CCMG','ccmg-program-director','SYNTH-CCMG-DIRECTOR','2026-07-14T10:00:00Z','director','2026-07-14T08:05:00Z','Emergency synthetic referral requires director intervention.','pending',NULL,NULL,NULL,'AUTH-PENDING-URGENT','Required authorization remains pending.','open','payer_authorization','M21-REF-URGENT-001','synthetic_demo',2,'2026-07-14T07:00:00Z','2026-07-14T08:05:00Z'),
      ('M21-WORK-HELD-001','M21-CASE-HELD-001','M21-REF-HELD-001','Synthetic Youth Held-01','intake','Resolve held-referral evidence exception','blocked','routine','BHC','CCMG','intake-coordinator','SYNTH-INTAKE-COORDINATOR','2026-07-15T17:00:00Z','supervisor','2026-07-14T09:00:00Z','Held synthetic referral requires supervisory review.','pending',NULL,NULL,NULL,'ELIGIBILITY-EVIDENCE-MISSING','Controlled eligibility evidence remains incomplete.','open','referral_validation','M21-REF-HELD-001','synthetic_demo',1,'2026-07-12T13:00:00Z','2026-07-14T09:00:00Z'),
      ('M21-WORK-CAPACITY-001','M21-CASE-NEW-001','M21-REF-NEW-001','Synthetic Youth New-01','intake','Confirm minimum-necessary GRO capacity','pending','routine','GRO','GRO','program-director','SYNTH-GRO-DIRECTOR','2026-07-15T12:00:00Z','none',NULL,NULL,'not_required',NULL,NULL,NULL,NULL,NULL,'none','capacity','M21-REF-NEW-001','synthetic_demo',1,'2026-07-14T08:30:00Z','2026-07-14T08:30:00Z'),
      ('M21-WORK-SELF-APPROVAL-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','Synthetic Youth Existing-01','mhtcm','Validate independent MHTCM approval control','awaiting_approval','routine','BHC','MHTCM','treatment-director','SYNTH-TREATMENT-DIRECTOR','2026-07-17T17:00:00Z','none',NULL,NULL,'pending',NULL,NULL,NULL,NULL,NULL,'none','independence_control','SYNTH-INDEPENDENCE-001','synthetic_demo',1,'2026-07-14T09:00:00Z','2026-07-14T09:00:00Z');

    INSERT OR IGNORE INTO m21_ccmg_handoffs
      (id,case_id,referral_id,work_item_id,from_division,from_department,to_division,to_department,status,reason,payload_json,initiated_by,initiated_at,due_at,accepted_by,accepted_at,completed_at,evidence_class,version)
    VALUES
      ('M21-HANDOFF-MHTCM-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-WORK-MHTCM-001','BHC','CCMG','BHC','MHTCM','completed','Route approved CANS v2 goals to MHTCM.','{"cansAssessmentId":"M21-CANS-EXISTING-V2","targetRecordId":"SYNTH-MHTCM-PLAN-001","targetVersion":2}','SYNTH-CCMG-DIRECTOR','2026-07-10T11:15:00Z','2026-07-11T17:00:00Z','SYNTH-MHTCM-SUPERVISOR','2026-07-10T11:30:00Z','2026-07-10T12:00:00Z','synthetic_demo',2),
      ('M21-HANDOFF-MHRS-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-WORK-MHRS-001','BHC','CCMG','BHC','MHRS','accepted','Route approved CANS v2 skills goals to MHRS.','{"cansAssessmentId":"M21-CANS-EXISTING-V2","targetRecordId":"SYNTH-MHRS-GOALS-001","targetVersion":2}','SYNTH-CCMG-DIRECTOR','2026-07-10T11:15:00Z','2026-07-12T17:00:00Z','SYNTH-MHRS-SUPERVISOR','2026-07-10T11:45:00Z',NULL,'synthetic_demo',2),
      ('M21-HANDOFF-URGENT-001','M21-CASE-URGENT-001','M21-REF-URGENT-001','M21-WORK-URGENT-001','GRO','GRO','BHC','CCMG','initiated','Urgent cross-divisional clinical oversight handoff.','{"urgency":"emergency","exceptionCode":"AUTH-PENDING-URGENT"}','SYNTH-GRO-DIRECTOR','2026-07-14T07:15:00Z','2026-07-14T09:00:00Z',NULL,NULL,NULL,'synthetic_demo',1);

    INSERT OR IGNORE INTO m21_ccmg_audit_events
      (id,case_id,referral_id,work_item_id,event_type,action,entity_type,entity_id,actor_id,actor_role,reason,before_json,after_json,changed_fields_json,correlation_id,evidence_class,occurred_at)
    VALUES
      ('M21-AUDIT-ACCESS-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001',NULL,'access','referral_detail_viewed','ccmg_referral','M21-REF-EXISTING-001','SYNTH-CCMG-DIRECTOR','ccmg-program-director','Synthetic role-based detail access.',NULL,NULL,'[]','M21-CORR-ACCESS-001','synthetic_demo','2026-07-10T12:00:00Z'),
      ('M21-AUDIT-ASSIGN-001','M21-CASE-NEW-001','M21-REF-NEW-001','M21-WORK-INTAKE-001','assignment','work_item_assigned','ccmg_work_item','M21-WORK-INTAKE-001','SYNTH-CCMG-DIRECTOR','ccmg-program-director','Assign synthetic intake work.','{"assignedTo":null}','{"assignedTo":"SYNTH-INTAKE-COORDINATOR"}','["assignedTo"]','M21-CORR-ASSIGN-001','synthetic_demo','2026-07-14T08:30:00Z'),
      ('M21-AUDIT-APPROVE-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-WORK-MHTCM-001','approval','work_item_approved','ccmg_work_item','M21-WORK-MHTCM-001','SYNTH-LPHA-APPROVER','treatment-director','Approve synthetic MHTCM plan routing.','{"approvalStatus":"pending"}','{"approvalStatus":"approved"}','["approvalStatus"]','M21-CORR-APPROVE-001','synthetic_demo','2026-07-10T11:00:00Z'),
      ('M21-AUDIT-HANDOFF-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-WORK-MHTCM-001','plan_handoff','plan_handoff_completed','ccmg_handoff','M21-HANDOFF-MHTCM-001','SYNTH-MHTCM-SUPERVISOR','mhtcm-supervisor','Accept and complete synthetic MHTCM handoff.','{"status":"initiated"}','{"status":"completed"}','["status"]','M21-CORR-HANDOFF-001','synthetic_demo','2026-07-10T12:00:00Z'),
      ('M21-AUDIT-CHANGE-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001',NULL,'material_change','cans_version_advanced','ccmg_referral','M21-REF-EXISTING-001','SYNTH-CCMG-DIRECTOR','ccmg-program-director','Advance controlled CANS lineage to version 2.','{"currentCansVersion":1}','{"currentCansVersion":2}','["currentCansVersion"]','M21-CORR-CHANGE-001','synthetic_demo','2026-07-10T10:00:00Z');
  `);
}

// ─── Auto-create all tables on startup ─────────────────────

export function initDatabase(options: { trainingWorkspace?: boolean } = {}) {
  console.log("[DB] Initializing database...");

  const freshSchema = bootstrapFreshDatabaseSchema(sqlite);
  if (freshSchema.bootstrapped) {
    console.log(
      `[DB] Fresh schema bootstrapped from ${freshSchema.appliedMigrations} controlled migrations; ` +
        `${freshSchema.createdCurrentTables} current tables and ${freshSchema.addedCurrentColumns} current columns reconciled.`,
    );
  }

  // Users & Auth
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'rcs-day',
      department TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // Additive identity/session/MFA/recovery/access-review controls. This is
  // idempotent so existing prototype databases are preserved in place.
  ensureIdentitySchema(sqlite);
  if (!options.trainingWorkspace) ensureReviewOwnerAccount(sqlite, env);
  ensureM21CcmgSchema(sqlite);
  ensurePhase2ControlSchema(sqlite);
  ensurePhase3ControlSchema(sqlite);
  if (
    options.trainingWorkspace ||
    (env.isDemo && env.evaluationMode) ||
    env.reviewDeployment
  ) {
    if (!options.trainingWorkspace) assertSyntheticScenarioRuntime(env);
    seedM21CcmgSyntheticScenarios(sqlite);
    seedPhase2ControlScenario(sqlite);
    seedPhase3ControlScenario(sqlite);
  }

  // HR
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS hr_people (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      employee_id TEXT,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      lane TEXT NOT NULL DEFAULT 'activation',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_employee INTEGER NOT NULL DEFAULT 0,
      hire_date TEXT,
      supervisor TEXT,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS module_statuses (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      status_id TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
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
    )
  `);

  // Clinical
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      mrn TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT,
      gender TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      assigned_clinician_id TEXT,
      insurance_plan_id TEXT,
      admission_date TEXT,
      discharge_date TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS treatment_plans (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      plan_number TEXT NOT NULL,
      primary_diagnosis TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      assigned_clinician_id TEXT,
      start_date TEXT,
      end_date TEXT,
      goals_json TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clinical_sessions (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      treatment_plan_id TEXT,
      clinician_id TEXT,
      session_type TEXT,
      session_date TEXT,
      duration_minutes INTEGER,
      notes TEXT,
      billing_code TEXT,
      status TEXT DEFAULT 'completed',
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS outcome_measures (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      measure_type TEXT NOT NULL,
      score INTEGER,
      severity TEXT,
      administered_at TEXT,
      clinician_id TEXT,
      notes TEXT,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS insurance_plans (
      id TEXT PRIMARY KEY,
      plan_name TEXT NOT NULL,
      payer_name TEXT,
      payer_type TEXT,
      plan_type TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT
    )
  `);

  // Revenue
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payers (
      id TEXT PRIMARY KEY,
      payer_name TEXT NOT NULL,
      payer_type TEXT,
      contact_info TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      claim_number TEXT NOT NULL UNIQUE,
      patient_id TEXT,
      payer_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      total_amount INTEGER,
      submitted_at TEXT,
      paid_at TEXT,
      denial_reason TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS claim_line_items (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      service_code TEXT NOT NULL,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      unit_price INTEGER,
      total_price INTEGER,
      created_at TEXT
    )
  `);

  // QA
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS audits_qa (
      id TEXT PRIMARY KEY,
      audit_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      audit_type TEXT NOT NULL,
      scope TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      assigned_auditor_id TEXT,
      department TEXT,
      findings_json TEXT DEFAULT '[]',
      score INTEGER,
      started_at TEXT,
      completed_at TEXT,
      due_date TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      incident_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      incident_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      patient_id TEXT,
      reported_by TEXT NOT NULL,
      assigned_to TEXT,
      occurred_at TEXT NOT NULL,
      resolved_at TEXT,
      resolution_notes TEXT,
      follow_up_required INTEGER NOT NULL DEFAULT 0,
      follow_up_date TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS corrective_actions (
      id TEXT PRIMARY KEY,
      action_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      related_audit_id TEXT,
      related_incident_id TEXT,
      priority TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      assigned_to TEXT NOT NULL,
      due_date TEXT NOT NULL,
      completed_at TEXT,
      completion_notes TEXT,
      verified_by TEXT,
      verified_at TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // GAD
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      wo_number TEXT,
      title TEXT,
      description TEXT,
      priority TEXT,
      status TEXT DEFAULT 'open',
      category TEXT,
      assigned_to TEXT,
      due_date TEXT,
      facility TEXT,
      completion_notes TEXT,
      completed_at TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT,
      vendor_type TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      services TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS facilities (
      id TEXT PRIMARY KEY,
      name TEXT,
      code TEXT,
      type TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      licensed_capacity INTEGER DEFAULT 0,
      operational_capacity INTEGER DEFAULT 0,
      current_occupancy INTEGER DEFAULT 0,
      total_rooms INTEGER DEFAULT 0,
      total_beds INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      activation_date TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      facility_id TEXT NOT NULL,
      room_number TEXT NOT NULL,
      floor TEXT DEFAULT 'ground',
      room_type TEXT DEFAULT 'standard',
      max_beds INTEGER DEFAULT 2,
      current_occupancy INTEGER DEFAULT 0,
      bed_layout TEXT DEFAULT 'double',
      has_private_bath INTEGER DEFAULT 0,
      has_window INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS procurement_requests (
      id TEXT PRIMARY KEY,
      request_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      quantity INTEGER DEFAULT 1,
      estimated_unit_cost INTEGER,
      estimated_total_cost INTEGER,
      vendor_id TEXT,
      vendor_name TEXT,
      facility_id TEXT,
      facility_name TEXT,
      requested_by TEXT NOT NULL,
      requested_by_id TEXT,
      approved_by TEXT,
      approved_at TEXT,
      status TEXT DEFAULT 'draft',
      priority TEXT DEFAULT 'medium',
      justification TEXT,
      rejection_reason TEXT,
      po_number TEXT,
      received_at TEXT,
      received_by TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS safety_inspections (
      id TEXT PRIMARY KEY,
      inspection_number TEXT NOT NULL UNIQUE,
      facility_id TEXT NOT NULL,
      facility_name TEXT NOT NULL,
      inspection_type TEXT NOT NULL,
      inspected_by TEXT NOT NULL,
      inspected_by_id TEXT,
      inspection_date TEXT NOT NULL,
      next_due_date TEXT,
      frequency_days INTEGER DEFAULT 90,
      status TEXT DEFAULT 'pending',
      score INTEGER,
      checklist_json TEXT DEFAULT '[]',
      findings TEXT,
      corrective_actions TEXT,
      corrective_actions_completed INTEGER DEFAULT 0,
      corrective_actions_completed_at TEXT,
      photos_json TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS vendor_contracts (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      contract_number TEXT NOT NULL UNIQUE,
      contract_type TEXT DEFAULT 'service_agreement',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      value INTEGER,
      payment_terms TEXT,
      auto_renew INTEGER DEFAULT 0,
      renewal_terms TEXT,
      termination_notice_days INTEGER DEFAULT 30,
      status TEXT DEFAULT 'active',
      scope_of_work TEXT,
      documents_json TEXT,
      primary_contact_name TEXT,
      primary_contact_email TEXT,
      primary_contact_phone TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // GRO
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referral_number TEXT,
      patient_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      referral_source TEXT,
      source_detail TEXT,
      referral_type TEXT,
      status TEXT DEFAULT 'new',
      assigned_to TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS partnerships (
      id TEXT PRIMARY KEY,
      organization_name TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      partnership_type TEXT,
      status TEXT DEFAULT 'active',
      start_date TEXT,
      notes TEXT,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS outreach_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      target_audience TEXT,
      leads_generated INTEGER DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT
    )
  `);

  // Agent Personas
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_personas (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT NOT NULL,
      scope TEXT,
      boundaries_json TEXT,
      status TEXT DEFAULT 'deferred',
      wave TEXT DEFAULT 'wave3',
      category TEXT NOT NULL,
      color TEXT,
      icon TEXT,
      permissions TEXT,
      outputs TEXT,
      activated_at TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS persona_interactions (
      id TEXT PRIMARY KEY,
      persona_id TEXT,
      query_text TEXT,
      response_text TEXT,
      context_data TEXT,
      status TEXT DEFAULT 'completed',
      started_at TEXT,
      completed_at TEXT
    )
  `);

  // NIL Knowledge Graph
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS nil_entities (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      source_id TEXT,
      source_table TEXT,
      display_name TEXT NOT NULL,
      description TEXT,
      metadata TEXT,
      module TEXT NOT NULL DEFAULT 'unknown',
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS nil_relationships (
      id TEXT PRIMARY KEY,
      from_entity_id TEXT NOT NULL,
      to_entity_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      strength INTEGER NOT NULL DEFAULT 1,
      created_at TEXT
    )
  `);

  // MS Graph
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ms_graph_users (
      id TEXT PRIMARY KEY,
      entra_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      given_name TEXT,
      surname TEXT,
      user_principal_name TEXT NOT NULL,
      mail TEXT,
      job_title TEXT,
      department TEXT,
      office_location TEXT,
      account_enabled INTEGER NOT NULL DEFAULT 1,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      last_sync_at TEXT,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ms_graph_groups (
      id TEXT PRIMARY KEY,
      entra_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      group_type TEXT,
      security_enabled INTEGER,
      mail_enabled INTEGER,
      member_count INTEGER DEFAULT 0,
      last_sync_at TEXT,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ms_graph_sync_log (
      id TEXT PRIMARY KEY,
      sync_type TEXT NOT NULL,
      status TEXT NOT NULL,
      users_synced INTEGER DEFAULT 0,
      groups_synced INTEGER DEFAULT 0,
      errors_json TEXT,
      started_at TEXT,
      completed_at TEXT
    )
  `);

  // Workflow
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_instances (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      trigger_data TEXT,
      started_at TEXT,
      completed_at TEXT,
      triggered_by TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_approvals (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      approver_role TEXT NOT NULL,
      approver_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      comment TEXT,
      requested_at TEXT,
      responded_at TEXT
    )
  `);

  // Audit log (shared for workflow + security)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_audit_log (
      id TEXT PRIMARY KEY,
      instance_id TEXT,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT,
      created_at TEXT
    )
  `);

  // ═══════════════════════════════════════════════════════════════
  // D005: Workflow Engine Tables (v2)
  // ═══════════════════════════════════════════════════════════════

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_definitions_v2 (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status_map TEXT,
      evidence_gates TEXT,
      escalation_rules TEXT,
      entity_type TEXT NOT NULL DEFAULT 'general',
      created_at TEXT
    )
  `);

  sqlite.exec(`
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
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_transitions_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor TEXT,
      reason TEXT,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_evidence_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id INTEGER NOT NULL,
      gate_name TEXT NOT NULL,
      file_name TEXT,
      file_path TEXT,
      submitted_by TEXT,
      submitted_at TEXT,
      validated INTEGER DEFAULT 0
    )
  `);

  // Notifications
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      person_name TEXT,
      module_name TEXT,
      action_href TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT
    )
  `);

  // Forms
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS form_templates (
      id TEXT PRIMARY KEY,
      template_name TEXT NOT NULL,
      category TEXT,
      binder_area TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS form_template_fields (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      field_type TEXT NOT NULL,
      label TEXT NOT NULL,
      required INTEGER DEFAULT 0,
      options_json TEXT,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // ─── M1: Onboarding Progress ─────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS onboarding_progress (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      module_name TEXT,
      status TEXT NOT NULL DEFAULT 'not-started',
      score INTEGER,
      completed_at TEXT,
      assigned_by TEXT,
      assigned_at TEXT,
      due_date TEXT,
      evidence_required INTEGER DEFAULT 0,
      evidence_uploaded INTEGER DEFAULT 0,
      UNIQUE(person_id, module_id)
    )
  `);

  // ─── M1: Credential Expiries ─────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS credential_expiries (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      credential_type TEXT NOT NULL,
      credential_name TEXT NOT NULL,
      issued_date TEXT,
      expiry_date TEXT NOT NULL,
      alert_threshold_days INTEGER DEFAULT 30,
      alert_status TEXT NOT NULL DEFAULT 'current',
      document_id TEXT,
      verified_by TEXT,
      verified_at TEXT,
      notes TEXT,
      created_at TEXT
    )
  `);

  // ─── M1: Document Templates ──────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS document_templates (
      id TEXT PRIMARY KEY,
      template_name TEXT NOT NULL,
      template_code TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      description TEXT,
      required_fields_json TEXT DEFAULT '[]',
      default_metadata_json TEXT DEFAULT '{}',
      version TEXT DEFAULT '1.0',
      is_active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT
    )
  `);

  // ─── M1: Evidence Packets ────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS evidence_packets (
      id TEXT PRIMARY KEY,
      packet_name TEXT NOT NULL,
      packet_type TEXT NOT NULL,
      person_id TEXT,
      case_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      document_ids_json TEXT DEFAULT '[]',
      assembled_by TEXT,
      assembled_at TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT
    )
  `);

  // ─── M1: Work Queue ──────────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS work_queue (
      id TEXT PRIMARY KEY,
      task_title TEXT NOT NULL,
      task_type TEXT NOT NULL,
      description TEXT,
      assigned_to TEXT,
      assigned_by TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      entity_type TEXT,
      entity_id TEXT,
      workflow_id TEXT,
      evidence_required INTEGER DEFAULT 0,
      evidence_uploaded INTEGER DEFAULT 0,
      due_date TEXT,
      completed_at TEXT,
      completed_by TEXT,
      escalation_level INTEGER DEFAULT 0,
      escalated_at TEXT,
      escalation_reason TEXT,
      created_at TEXT
    )
  `);

  // ─── M1: Workflow Definitions ────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_definitions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL UNIQUE,
      workflow_name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT
    )
  `);

  // ─── M1: Evidence Gates (per workflow) ───────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS evidence_gates (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      gate_name TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT,
      UNIQUE(workflow_id, gate_name)
    )
  `);

  // ─── M1: Task Evidence (uploaded files) ──────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_evidence (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      uploaded_by TEXT,
      uploaded_at TEXT
    )
  `);

  // ─── M1: Escalation Log ──────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS escalation_log (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      previous_level INTEGER DEFAULT 0,
      new_level INTEGER NOT NULL,
      reason TEXT,
      escalated_by TEXT,
      notification_sent INTEGER DEFAULT 0,
      created_at TEXT
    )
  `);

  // ─── M1: Reassignment Log ────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reassignment_log (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      old_assignee TEXT,
      new_assignee TEXT NOT NULL,
      reason TEXT NOT NULL,
      reassigned_by TEXT,
      created_at TEXT
    )
  `);

  // Seed default admin if no users exist
  const userCount = sqlite.prepare("SELECT COUNT(*) as c FROM users").get() as
    { c: number } | undefined;
  if ((userCount?.c ?? 0) === 0) {
    console.log(
      "[DB] No users found. First registration will auto-create super-admin.",
    );
  }

  // Seed 13 AMOS personas if none exist
  const personaCount = sqlite
    .prepare("SELECT COUNT(*) as c FROM agent_personas")
    .get() as { c: number } | undefined;
  if ((personaCount?.c ?? 0) === 0) {
    const now = new Date().toISOString();
    const seedPersonas = [
      // ═══ 6 Pilot Personas (Active in UI) ═══
      [
        "amos-core",
        "amos-core",
        "AMOS-Core",
        "AC",
        "Universal operational backbone. Dashboard aggregation, notification routing, cross-module search, and daily operational support.",
        "system-operations",
        JSON.stringify([
          "dashboards",
          "notifications",
          "search",
          "system-config",
        ]),
        "pilot",
        "pilot",
        "Core",
        "#3B82F6",
        "Cpu",
        JSON.stringify(["all_read", "ops_write"]),
        JSON.stringify(["dashboards", "alerts", "search_results"]),
        "2026-01-01T00:00:00Z",
        1,
        now,
        now,
      ],
      [
        "amos-clinical",
        "amos-clinical",
        "AMOS-Clinical",
        "ACL",
        "Clinical operations specialist. BHC care delivery, CANS/ANSA assessment support, treatment planning, clinical documentation guidance.",
        "bhc-clinical",
        JSON.stringify([
          "assessments",
          "treatment-plans",
          "clinical-notes",
          "cans-ansi",
        ]),
        "pilot",
        "pilot",
        "Clinical",
        "#10B981",
        "Stethoscope",
        JSON.stringify(["clinical_read", "clinical_write", "phi_access"]),
        JSON.stringify(["assessments", "treatment_plans", "clinical_notes"]),
        "2026-01-01T00:00:00Z",
        2,
        now,
        now,
      ],
      [
        "amos-gro",
        "amos-gro",
        "AMOS-GRO",
        "AGRO",
        "Residential operations specialist. GRO shift management, youth care logs, behavioral observations, safety rounds, census tracking.",
        "residential-operations",
        JSON.stringify([
          "shift-logs",
          "observations",
          "care-plans",
          "safety-rounds",
          "census",
        ]),
        "pilot",
        "pilot",
        "Residential",
        "#F59E0B",
        "Home",
        JSON.stringify(["gro_read", "gro_write", "residential_write"]),
        JSON.stringify(["shift_logs", "observations", "care_plans"]),
        "2026-01-01T00:00:00Z",
        3,
        now,
        now,
      ],
      [
        "amos-sentinel",
        "amos-sentinel",
        "AMOS-Sentinel",
        "ASENT",
        "QA and compliance guardian. Audit readiness, CAP tracking, deficiency monitoring, regulatory compliance verification.",
        "qa-compliance",
        JSON.stringify([
          "audits",
          "cap-plans",
          "compliance-reports",
          "deficiency-tracking",
        ]),
        "pilot",
        "pilot",
        "Compliance",
        "#EF4444",
        "Shield",
        JSON.stringify(["qa_read", "audit_write", "compliance_write"]),
        JSON.stringify(["audits", "cap_plans", "compliance_reports"]),
        "2026-01-01T00:00:00Z",
        4,
        now,
        now,
      ],
      [
        "amos-scribe",
        "amos-scribe",
        "AMOS-Scribe",
        "ASCR",
        "Document production engine. Branded DOCX/PDF/Excel generation, template library, controlled publishing workflow.",
        "document-management",
        JSON.stringify(["documents", "templates", "publishing", "docx-pdf"]),
        "pilot",
        "pilot",
        "Documents",
        "#8B5CF6",
        "FileText",
        JSON.stringify(["documents_read", "studio_write", "templates_write"]),
        JSON.stringify(["documents", "presentations", "spreadsheets"]),
        "2026-01-01T00:00:00Z",
        5,
        now,
        now,
      ],
      [
        "amos-revenue",
        "amos-revenue",
        "AMOS-Revenue",
        "AREV",
        "Revenue cycle specialist. Authorizations, claims management, billing readiness, payer packet assembly, denials tracking.",
        "billing-revenue",
        JSON.stringify([
          "claims",
          "authorizations",
          "billing",
          "payer-packets",
          "denials",
        ]),
        "pilot",
        "pilot",
        "Revenue",
        "#06B6D4",
        "Banknote",
        JSON.stringify(["revenue_read", "billing_write", "claims_write"]),
        JSON.stringify(["claims", "authorizations", "payer_packets"]),
        "2026-01-01T00:00:00Z",
        6,
        now,
        now,
      ],
      // ═══ 7 Deferred Personas (NOT Active in UI) ═══
      [
        "amos-hr",
        "amos-hr",
        "AMOS-HR",
        "AHR",
        "Human resources specialist. Onboarding workflow, credential tracking, training assignments, performance documentation, compliance auditing.",
        "hr-operations",
        JSON.stringify([
          "onboarding",
          "credentials",
          "training",
          "performance",
        ]),
        "deferred",
        "wave1",
        "HR",
        "#EC4899",
        "Users",
        JSON.stringify(["hr_read", "hr_write", "credentials_write"]),
        JSON.stringify([
          "onboarding_plans",
          "credentials_reports",
          "performance_reviews",
        ]),
        null,
        7,
        now,
        now,
      ],
      [
        "amos-prime",
        "amos-prime",
        "AMOS-Prime",
        "AP",
        "Executive orchestration persona. Top-level task routing, cross-system coordination, and strategic synthesis.",
        "executive",
        JSON.stringify(["routing", "coordination", "strategic-synthesis"]),
        "deferred",
        "wave3",
        "Executive",
        "#F97316",
        "Crown",
        JSON.stringify(["all_read", "routing_write"]),
        JSON.stringify(["memos", "decisions", "alerts"]),
        null,
        8,
        now,
        now,
      ],
      [
        "amos-nxl",
        "amos-nxl",
        "AMOS-NXL",
        "ANXL",
        "Narrative intelligence engine. Generates operational narratives, trend explanations, and executive briefings from live data.",
        "intelligence",
        JSON.stringify(["narratives", "briefings", "trends"]),
        "deferred",
        "wave3",
        "Intelligence",
        "#14B8A6",
        "Brain",
        JSON.stringify(["analytics_read", "narrative_write"]),
        JSON.stringify(["briefings", "narratives", "summaries"]),
        null,
        9,
        now,
        now,
      ],
      [
        "amos-thesis",
        "amos-thesis",
        "AMOS-THESIS",
        "AT",
        "Research and evidence synthesis. Academic literature review, regulatory research, evidence-based recommendation engine.",
        "research",
        JSON.stringify([
          "literature-review",
          "regulatory-research",
          "evidence-synthesis",
        ]),
        "deferred",
        "wave3",
        "Research",
        "#6366F1",
        "GraduationCap",
        JSON.stringify(["research_read", "synthesis_write"]),
        JSON.stringify(["reports", "literature_reviews", "recommendations"]),
        null,
        10,
        now,
        now,
      ],
      [
        "amos-dms",
        "amos-dms",
        "AMOS-DMS",
        "ADMS",
        "Document management specialist. Document lifecycle, template generation, packet assembly, and compliance publishing.",
        "document-system",
        JSON.stringify([
          "doc-lifecycle",
          "templates",
          "packet-assembly",
          "compliance-pub",
        ]),
        "deferred",
        "wave3",
        "Documents",
        "#84CC16",
        "FolderOpen",
        JSON.stringify(["documents_read", "dms_write", "templates_write"]),
        JSON.stringify(["documents", "packets", "templates"]),
        null,
        11,
        now,
        now,
      ],
      [
        "amos-coach",
        "amos-coach",
        "AMOS-Coach",
        "ACOACH",
        "Training and coaching facilitator. Staff development, competency tracking, scenario-based learning, performance coaching.",
        "training",
        JSON.stringify(["staff-dev", "competency", "learning", "coaching"]),
        "deferred",
        "wave2",
        "Training",
        "#D946EF",
        "Trophy",
        JSON.stringify(["training_read", "coaching_write"]),
        JSON.stringify([
          "training_plans",
          "competency_assessments",
          "coaching_sessions",
        ]),
        null,
        12,
        now,
        now,
      ],
      [
        "amos-strategy",
        "amos-strategy",
        "AMOS-Strategy",
        "ASTRAT",
        "Strategic planning analyst. Growth initiatives, market analysis, board reporting, risk register, strategic decision support.",
        "strategy",
        JSON.stringify([
          "growth",
          "market-analysis",
          "board-reports",
          "risk-register",
        ]),
        "deferred",
        "wave2",
        "Strategy",
        "#0EA5E9",
        "TrendingUp",
        JSON.stringify(["executive_read", "strategy_write"]),
        JSON.stringify(["strategic_plans", "risk_registers", "board_memos"]),
        null,
        13,
        now,
        now,
      ],
    ];
    const insert = sqlite.prepare(
      "INSERT INTO agent_personas (id, key, name, code, description, scope, boundaries_json, status, wave, category, color, icon, permissions, outputs, activated_at, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const p of seedPersonas) insert.run(...p);
    console.log("[DB] Seeded 13 AMOS personas (6 pilot active, 7 deferred).");
  }

  console.log("[DB] Database initialized successfully.");
}
