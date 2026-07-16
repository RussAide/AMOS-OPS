-- M2.1: controlled CCMG oversight prototype.
-- All seeded records are explicitly synthetic demonstration evidence.

CREATE TABLE `m21_ccmg_referrals` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `case_id` TEXT NOT NULL UNIQUE,
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `youth_id` TEXT NOT NULL,
  `youth_display_label` TEXT NOT NULL,
  `referral_source_division` TEXT NOT NULL CHECK (`referral_source_division` IN ('BHC','GRO','EO','GAD','external')),
  `referred_at` TEXT NOT NULL,
  `referral_reason` TEXT NOT NULL,
  `urgency` TEXT NOT NULL DEFAULT 'routine' CHECK (`urgency` IN ('routine','urgent','emergency')),
  `status` TEXT NOT NULL DEFAULT 'received' CHECK (`status` IN ('received','screening','held','rejected','ready_for_routing','active','closed')),
  `hold_reason` TEXT,
  `rejection_reason` TEXT,
  `intake_status` TEXT NOT NULL DEFAULT 'not_started' CHECK (`intake_status` IN ('not_started','in_progress','complete')),
  `intake_completed_at` TEXT,
  `intake_completed_by` TEXT,
  `eligibility_status` TEXT NOT NULL DEFAULT 'pending' CHECK (`eligibility_status` IN ('pending','eligible','ineligible','needs_review')),
  `age_qualified` INTEGER NOT NULL DEFAULT 0 CHECK (`age_qualified` IN (0,1)),
  `diagnosis_qualified` INTEGER NOT NULL DEFAULT 0 CHECK (`diagnosis_qualified` IN (0,1)),
  `functional_impairment` INTEGER NOT NULL DEFAULT 0 CHECK (`functional_impairment` IN (0,1)),
  `coverage_qualified` INTEGER NOT NULL DEFAULT 0 CHECK (`coverage_qualified` IN (0,1)),
  `eligibility_rationale` TEXT,
  `eligibility_determined_at` TEXT,
  `eligibility_determined_by` TEXT,
  `payer_label` TEXT,
  `payer_verification_status` TEXT NOT NULL DEFAULT 'not_started' CHECK (`payer_verification_status` IN ('not_started','pending','verified','failed')),
  `payer_verified_at` TEXT,
  `authorization_required` INTEGER NOT NULL DEFAULT 0 CHECK (`authorization_required` IN (0,1)),
  `authorization_status` TEXT NOT NULL DEFAULT 'not_required' CHECK (`authorization_status` IN ('not_required','pending','approved','denied','expired')),
  `authorization_reference` TEXT,
  `authorization_effective_at` TEXT,
  `authorization_expires_at` TEXT,
  `consent_status` TEXT NOT NULL DEFAULT 'pending' CHECK (`consent_status` IN ('pending','active','declined','revoked','expired')),
  `consent_reference` TEXT,
  `consent_effective_at` TEXT,
  `consent_expires_at` TEXT,
  `cans_status` TEXT NOT NULL DEFAULT 'not_scheduled' CHECK (`cans_status` IN ('not_scheduled','scheduled','completed','overdue','cancelled')),
  `cans_due_at` TEXT,
  `cans_scheduled_for` TEXT,
  `current_cans_assessment_id` TEXT,
  `current_cans_version` INTEGER,
  `cans_acuity` TEXT NOT NULL DEFAULT 'not_assessed' CHECK (`cans_acuity` IN ('not_assessed','low','moderate','high','critical')),
  `capacity_required` INTEGER NOT NULL DEFAULT 0 CHECK (`capacity_required` IN (0,1)),
  `capacity_facility_label` TEXT,
  `capacity_status` TEXT NOT NULL DEFAULT 'not_required' CHECK (`capacity_status` IN ('not_required','unchecked','available','reserved','waitlisted','unavailable')),
  `available_slots` INTEGER,
  `reserved_slot_reference` TEXT,
  `capacity_checked_at` TEXT,
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1 CHECK (`version` > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_m21_ccmg_referrals_mode_status` ON `m21_ccmg_referrals` (`evidence_class`,`status`,`urgency`);
--> statement-breakpoint

CREATE TABLE `m21_ccmg_cans_assessments` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `case_id` TEXT NOT NULL,
  `referral_id` TEXT NOT NULL,
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `version` INTEGER NOT NULL CHECK (`version` > 0),
  `instrument_version` TEXT NOT NULL,
  `status` TEXT NOT NULL CHECK (`status` IN ('draft','final','superseded')),
  `previous_assessment_id` TEXT,
  `completed_at` TEXT,
  `completed_by` TEXT,
  `total_score` INTEGER,
  `acuity` TEXT NOT NULL CHECK (`acuity` IN ('low','moderate','high','critical')),
  `domain_scores_json` TEXT NOT NULL,
  `actionable_items_json` TEXT NOT NULL,
  `created_at` TEXT NOT NULL,
  FOREIGN KEY (`referral_id`) REFERENCES `m21_ccmg_referrals`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_m21_ccmg_cans_referral_version` ON `m21_ccmg_cans_assessments` (`referral_id`,`version`);
--> statement-breakpoint
CREATE TRIGGER `m21_ccmg_cans_assessments_no_update`
BEFORE UPDATE ON `m21_ccmg_cans_assessments`
BEGIN
  SELECT RAISE(ABORT, 'M21_CANS_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `m21_ccmg_cans_assessments_no_delete`
BEFORE DELETE ON `m21_ccmg_cans_assessments`
BEGIN
  SELECT RAISE(ABORT, 'M21_CANS_IMMUTABLE');
END;
--> statement-breakpoint

CREATE TABLE `m21_ccmg_plan_lineage` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `case_id` TEXT NOT NULL,
  `referral_id` TEXT NOT NULL,
  `cans_assessment_id` TEXT NOT NULL,
  `cans_version` INTEGER NOT NULL CHECK (`cans_version` > 0),
  `target_type` TEXT NOT NULL CHECK (`target_type` IN ('mhtcm_plan','mhrs_skills_goals')),
  `target_record_id` TEXT NOT NULL,
  `target_version` INTEGER NOT NULL CHECK (`target_version` > 0),
  `target_approval_status` TEXT NOT NULL CHECK (`target_approval_status` = 'approved'),
  `target_approved_by` TEXT NOT NULL,
  `target_approved_at` TEXT NOT NULL,
  `routed_by` TEXT NOT NULL,
  `routed_at` TEXT NOT NULL,
  `mapped_goals_json` TEXT NOT NULL,
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `created_at` TEXT NOT NULL,
  FOREIGN KEY (`referral_id`) REFERENCES `m21_ccmg_referrals`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`cans_assessment_id`) REFERENCES `m21_ccmg_cans_assessments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_m21_ccmg_lineage_target` ON `m21_ccmg_plan_lineage` (`cans_assessment_id`,`target_type`,`target_record_id`,`target_version`);
--> statement-breakpoint
CREATE TRIGGER `m21_ccmg_plan_lineage_no_update`
BEFORE UPDATE ON `m21_ccmg_plan_lineage`
BEGIN
  SELECT RAISE(ABORT, 'M21_LINEAGE_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `m21_ccmg_plan_lineage_no_delete`
BEFORE DELETE ON `m21_ccmg_plan_lineage`
BEGIN
  SELECT RAISE(ABORT, 'M21_LINEAGE_IMMUTABLE');
END;
--> statement-breakpoint

CREATE TABLE `m21_ccmg_work_items` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `case_id` TEXT NOT NULL,
  `referral_id` TEXT NOT NULL,
  `youth_display_label` TEXT NOT NULL,
  `queue_id` TEXT NOT NULL CHECK (`queue_id` IN ('intake','qa','cans','medication_management','mhtcm','mhrs')),
  `title` TEXT NOT NULL,
  `status` TEXT NOT NULL CHECK (`status` IN ('pending','in_progress','blocked','awaiting_approval','completed','cancelled')),
  `priority` TEXT NOT NULL DEFAULT 'routine' CHECK (`priority` IN ('routine','urgent','critical')),
  `assigned_division` TEXT NOT NULL CHECK (`assigned_division` IN ('BHC','GRO')),
  `assigned_department` TEXT NOT NULL CHECK (`assigned_department` IN ('CCMG','MHTCM','MHRS','GRO')),
  `assigned_role` TEXT NOT NULL,
  `assigned_to` TEXT,
  `due_at` TEXT NOT NULL,
  `escalation_level` TEXT NOT NULL DEFAULT 'none' CHECK (`escalation_level` IN ('none','supervisor','director','executive')),
  `escalated_at` TEXT,
  `escalation_reason` TEXT,
  `approval_status` TEXT NOT NULL DEFAULT 'not_required' CHECK (`approval_status` IN ('not_required','pending','approved','rejected')),
  `approved_by` TEXT,
  `approved_at` TEXT,
  `approval_rationale` TEXT,
  `exception_code` TEXT,
  `exception_reason` TEXT,
  `exception_status` TEXT NOT NULL DEFAULT 'none' CHECK (`exception_status` IN ('none','open','resolved','waived')),
  `source_type` TEXT NOT NULL,
  `source_id` TEXT NOT NULL,
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `version` INTEGER NOT NULL DEFAULT 1 CHECK (`version` > 0),
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL,
  FOREIGN KEY (`referral_id`) REFERENCES `m21_ccmg_referrals`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `idx_m21_ccmg_work_queue` ON `m21_ccmg_work_items` (`evidence_class`,`queue_id`,`status`,`due_at`);
--> statement-breakpoint

CREATE TABLE `m21_ccmg_handoffs` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `case_id` TEXT NOT NULL,
  `referral_id` TEXT NOT NULL,
  `work_item_id` TEXT NOT NULL,
  `from_division` TEXT NOT NULL CHECK (`from_division` IN ('BHC','GRO')),
  `from_department` TEXT NOT NULL CHECK (`from_department` IN ('CCMG','MHTCM','MHRS','GRO')),
  `to_division` TEXT NOT NULL CHECK (`to_division` IN ('BHC','GRO')),
  `to_department` TEXT NOT NULL CHECK (`to_department` IN ('CCMG','MHTCM','MHRS','GRO')),
  `status` TEXT NOT NULL CHECK (`status` IN ('initiated','accepted','rejected','returned','completed')),
  `reason` TEXT NOT NULL,
  `payload_json` TEXT NOT NULL DEFAULT '{}',
  `initiated_by` TEXT NOT NULL,
  `initiated_at` TEXT NOT NULL,
  `due_at` TEXT NOT NULL,
  `accepted_by` TEXT,
  `accepted_at` TEXT,
  `completed_at` TEXT,
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `version` INTEGER NOT NULL DEFAULT 1 CHECK (`version` > 0),
  FOREIGN KEY (`referral_id`) REFERENCES `m21_ccmg_referrals`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`work_item_id`) REFERENCES `m21_ccmg_work_items`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `idx_m21_ccmg_handoff_status` ON `m21_ccmg_handoffs` (`evidence_class`,`status`,`due_at`);
--> statement-breakpoint

CREATE TABLE `m21_ccmg_audit_events` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `case_id` TEXT,
  `referral_id` TEXT,
  `work_item_id` TEXT,
  `event_type` TEXT NOT NULL CHECK (`event_type` IN ('access','assignment','approval','plan_handoff','material_change')),
  `action` TEXT NOT NULL,
  `entity_type` TEXT NOT NULL,
  `entity_id` TEXT NOT NULL,
  `actor_id` TEXT NOT NULL,
  `actor_role` TEXT NOT NULL,
  `reason` TEXT NOT NULL,
  `before_json` TEXT,
  `after_json` TEXT,
  `changed_fields_json` TEXT NOT NULL DEFAULT '[]',
  `correlation_id` TEXT NOT NULL,
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `occurred_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_m21_ccmg_audit_entity` ON `m21_ccmg_audit_events` (`entity_type`,`entity_id`,`occurred_at`);
--> statement-breakpoint
CREATE TRIGGER `m21_ccmg_audit_events_no_update`
BEFORE UPDATE ON `m21_ccmg_audit_events`
BEGIN
  SELECT RAISE(ABORT, 'M21_AUDIT_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `m21_ccmg_audit_events_no_delete`
BEFORE DELETE ON `m21_ccmg_audit_events`
BEGIN
  SELECT RAISE(ABORT, 'M21_AUDIT_IMMUTABLE');
END;
--> statement-breakpoint

-- Four controlled synthetic scenarios: new, existing, held, and urgent.
INSERT INTO `m21_ccmg_referrals`
(`id`,`case_id`,`evidence_class`,`youth_id`,`youth_display_label`,`referral_source_division`,`referred_at`,`referral_reason`,`urgency`,`status`,`intake_status`,`payer_label`,`payer_verification_status`,`authorization_required`,`authorization_status`,`cans_status`,`cans_due_at`,`cans_scheduled_for`,`capacity_required`,`capacity_facility_label`,`capacity_status`,`created_at`,`updated_at`)
VALUES
('M21-REF-NEW-001','M21-CASE-NEW-001','synthetic_demo','SYNTH-YOUTH-NEW-001','Synthetic Youth New-01','external','2026-07-14T08:00:00Z','Synthetic new referral requires controlled screening.','routine','screening','in_progress','Synthetic Payer Alpha','pending',1,'pending','scheduled','2026-07-16T17:00:00Z','2026-07-15T10:00:00Z',1,'Synthetic GRO Capacity Pool','unchecked','2026-07-14T08:00:00Z','2026-07-14T08:30:00Z');
--> statement-breakpoint

INSERT INTO `m21_ccmg_referrals`
(`id`,`case_id`,`evidence_class`,`youth_id`,`youth_display_label`,`referral_source_division`,`referred_at`,`referral_reason`,`urgency`,`status`,`intake_status`,`intake_completed_at`,`intake_completed_by`,`eligibility_status`,`age_qualified`,`diagnosis_qualified`,`functional_impairment`,`coverage_qualified`,`eligibility_rationale`,`eligibility_determined_at`,`eligibility_determined_by`,`payer_label`,`payer_verification_status`,`payer_verified_at`,`authorization_required`,`authorization_status`,`authorization_reference`,`authorization_effective_at`,`authorization_expires_at`,`consent_status`,`consent_reference`,`consent_effective_at`,`consent_expires_at`,`cans_status`,`cans_due_at`,`cans_scheduled_for`,`current_cans_assessment_id`,`current_cans_version`,`cans_acuity`,`capacity_required`,`capacity_facility_label`,`capacity_status`,`available_slots`,`reserved_slot_reference`,`capacity_checked_at`,`created_at`,`updated_at`,`version`)
VALUES
('M21-REF-EXISTING-001','M21-CASE-EXISTING-001','synthetic_demo','SYNTH-YOUTH-EXISTING-001','Synthetic Youth Existing-01','GRO','2026-07-01T09:00:00Z','Synthetic existing youth requires coordinated MHTCM and MHRS oversight.','urgent','active','complete','2026-07-01T12:00:00Z','SYNTH-ACTOR-INTAKE','eligible',1,1,1,1,'All controlled prototype eligibility criteria met.','2026-07-01T13:00:00Z','SYNTH-ACTOR-ELIGIBILITY','Synthetic Payer Beta','verified','2026-07-01T13:30:00Z',1,'approved','SYNTH-AUTH-EXISTING-001','2026-07-01T00:00:00Z','2026-09-30T23:59:59Z','active','SYNTH-CONSENT-EXISTING-001','2026-07-01T00:00:00Z','2026-12-31T23:59:59Z','completed','2026-07-03T17:00:00Z','2026-07-03T10:00:00Z','M21-CANS-EXISTING-V2',2,'high',1,'Synthetic GRO Capacity Pool','reserved',2,'SYNTH-BED-RES-001','2026-07-01T14:00:00Z','2026-07-01T09:00:00Z','2026-07-10T15:00:00Z',3);
--> statement-breakpoint

INSERT INTO `m21_ccmg_referrals`
(`id`,`case_id`,`evidence_class`,`youth_id`,`youth_display_label`,`referral_source_division`,`referred_at`,`referral_reason`,`urgency`,`status`,`hold_reason`,`intake_status`,`intake_completed_at`,`intake_completed_by`,`eligibility_status`,`eligibility_rationale`,`payer_label`,`payer_verification_status`,`authorization_required`,`authorization_status`,`consent_status`,`cans_status`,`capacity_required`,`capacity_facility_label`,`capacity_status`,`available_slots`,`capacity_checked_at`,`created_at`,`updated_at`)
VALUES
('M21-REF-HELD-001','M21-CASE-HELD-001','synthetic_demo','SYNTH-YOUTH-HELD-001','Synthetic Youth Held-01','external','2026-07-12T11:00:00Z','Synthetic referral held for missing eligibility evidence.','routine','held','Missing controlled eligibility and payer documentation.','complete','2026-07-12T12:00:00Z','SYNTH-ACTOR-INTAKE','needs_review','Required evidence is incomplete.','Synthetic Payer Gamma','failed',1,'pending','pending','not_scheduled',1,'Synthetic GRO Capacity Pool','waitlisted',0,'2026-07-12T13:00:00Z','2026-07-12T11:00:00Z','2026-07-12T13:00:00Z');
--> statement-breakpoint

INSERT INTO `m21_ccmg_referrals`
(`id`,`case_id`,`evidence_class`,`youth_id`,`youth_display_label`,`referral_source_division`,`referred_at`,`referral_reason`,`urgency`,`status`,`intake_status`,`intake_completed_at`,`intake_completed_by`,`eligibility_status`,`age_qualified`,`diagnosis_qualified`,`functional_impairment`,`coverage_qualified`,`eligibility_rationale`,`eligibility_determined_at`,`eligibility_determined_by`,`payer_label`,`payer_verification_status`,`payer_verified_at`,`authorization_required`,`authorization_status`,`consent_status`,`consent_reference`,`consent_effective_at`,`consent_expires_at`,`cans_status`,`cans_due_at`,`cans_scheduled_for`,`current_cans_assessment_id`,`current_cans_version`,`cans_acuity`,`capacity_required`,`capacity_facility_label`,`capacity_status`,`available_slots`,`capacity_checked_at`,`created_at`,`updated_at`,`version`)
VALUES
('M21-REF-URGENT-001','M21-CASE-URGENT-001','synthetic_demo','SYNTH-YOUTH-URGENT-001','Synthetic Youth Urgent-01','GRO','2026-07-14T07:00:00Z','Synthetic urgent referral requires director escalation.','emergency','screening','complete','2026-07-14T07:30:00Z','SYNTH-ACTOR-INTAKE','eligible',1,1,1,1,'Urgent synthetic case meets controlled eligibility criteria.','2026-07-14T07:45:00Z','SYNTH-ACTOR-ELIGIBILITY','Synthetic Payer Delta','verified','2026-07-14T08:00:00Z',1,'pending','active','SYNTH-CONSENT-URGENT-001','2026-07-14T07:00:00Z','2026-08-31T23:59:59Z','completed','2026-07-14T09:00:00Z','2026-07-14T08:15:00Z','M21-CANS-URGENT-V1',1,'critical',1,'Synthetic GRO Capacity Pool','available',1,'2026-07-14T08:30:00Z','2026-07-14T07:00:00Z','2026-07-14T09:00:00Z',2);
--> statement-breakpoint

INSERT INTO `m21_ccmg_cans_assessments`
(`id`,`case_id`,`referral_id`,`evidence_class`,`version`,`instrument_version`,`status`,`previous_assessment_id`,`completed_at`,`completed_by`,`total_score`,`acuity`,`domain_scores_json`,`actionable_items_json`,`created_at`)
VALUES
('M21-CANS-EXISTING-V1','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','synthetic_demo',1,'CANS-SYNTHETIC-2026.1','superseded',NULL,'2026-07-03T11:00:00Z','SYNTH-ACTOR-CANS',28,'moderate','{"behavioral_emotional":2,"risk_behaviors":2,"life_functioning":2,"strengths":1,"caregiver_resources":1,"cultural_factors":0}','[{"itemCode":"BEH-01","label":"emotional regulation","domain":"behavioral_emotional","rating":2,"disposition":"need"},{"itemCode":"LIF-01","label":"daily routine","domain":"life_functioning","rating":2,"disposition":"need"},{"itemCode":"STR-01","label":"community connection","domain":"strengths","rating":1,"disposition":"strength"}]','2026-07-03T11:00:00Z'),
('M21-CANS-EXISTING-V2','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','synthetic_demo',2,'CANS-SYNTHETIC-2026.1','final','M21-CANS-EXISTING-V1','2026-07-10T10:00:00Z','SYNTH-ACTOR-CANS',35,'high','{"behavioral_emotional":3,"risk_behaviors":3,"life_functioning":2,"strengths":1,"caregiver_resources":2,"cultural_factors":0}','[{"itemCode":"BEH-01","label":"emotional regulation","domain":"behavioral_emotional","rating":3,"disposition":"need"},{"itemCode":"RSK-01","label":"safety planning","domain":"risk_behaviors","rating":3,"disposition":"need"},{"itemCode":"LIF-01","label":"daily routine","domain":"life_functioning","rating":2,"disposition":"need"},{"itemCode":"STR-01","label":"community connection","domain":"strengths","rating":1,"disposition":"strength"}]','2026-07-10T10:00:00Z'),
('M21-CANS-URGENT-V1','M21-CASE-URGENT-001','M21-REF-URGENT-001','synthetic_demo',1,'CANS-SYNTHETIC-2026.1','final',NULL,'2026-07-14T08:45:00Z','SYNTH-ACTOR-CANS',44,'critical','{"behavioral_emotional":3,"risk_behaviors":3,"life_functioning":3,"strengths":2,"caregiver_resources":3,"cultural_factors":1}','[{"itemCode":"RSK-URG","label":"urgent safety coordination","domain":"risk_behaviors","rating":3,"disposition":"need"},{"itemCode":"LIF-URG","label":"immediate daily support","domain":"life_functioning","rating":3,"disposition":"need"}]','2026-07-14T08:45:00Z');
--> statement-breakpoint

INSERT INTO `m21_ccmg_plan_lineage`
(`id`,`case_id`,`referral_id`,`cans_assessment_id`,`cans_version`,`target_type`,`target_record_id`,`target_version`,`target_approval_status`,`target_approved_by`,`target_approved_at`,`routed_by`,`routed_at`,`mapped_goals_json`,`evidence_class`,`created_at`)
VALUES
('M21-LINEAGE-EXISTING-V1-MHTCM','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-CANS-EXISTING-V1',1,'mhtcm_plan','SYNTH-MHTCM-PLAN-001',1,'approved','SYNTH-LPHA-APPROVER','2026-07-03T12:00:00Z','SYNTH-CCMG-DIRECTOR','2026-07-03T12:15:00Z','[{"sourceItemCode":"BEH-01","sourceDomain":"behavioral_emotional","sourceRating":2,"goalCode":"MHTCM-MONITORING-BEH-01","goalText":"Address emotional regulation through the approved monitoring function.","workflow":"MHTCM"}]','synthetic_demo','2026-07-03T12:15:00Z'),
('M21-LINEAGE-EXISTING-V1-MHRS','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-CANS-EXISTING-V1',1,'mhrs_skills_goals','SYNTH-MHRS-GOALS-001',1,'approved','SYNTH-LPHA-APPROVER','2026-07-03T12:00:00Z','SYNTH-CCMG-DIRECTOR','2026-07-03T12:15:00Z','[{"sourceItemCode":"LIF-01","sourceDomain":"life_functioning","sourceRating":2,"goalCode":"MHRS-SKILL-LIF-01","goalText":"Build and practice a measurable skill for daily routine.","workflow":"MHRS"}]','synthetic_demo','2026-07-03T12:15:00Z'),
('M21-LINEAGE-EXISTING-V2-MHTCM','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-CANS-EXISTING-V2',2,'mhtcm_plan','SYNTH-MHTCM-PLAN-001',2,'approved','SYNTH-LPHA-APPROVER','2026-07-10T11:00:00Z','SYNTH-CCMG-DIRECTOR','2026-07-10T11:15:00Z','[{"sourceItemCode":"RSK-01","sourceDomain":"risk_behaviors","sourceRating":3,"goalCode":"MHTCM-COORDINATION-RSK-01","goalText":"Address safety planning through the approved coordination function.","workflow":"MHTCM"}]','synthetic_demo','2026-07-10T11:15:00Z'),
('M21-LINEAGE-EXISTING-V2-MHRS','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-CANS-EXISTING-V2',2,'mhrs_skills_goals','SYNTH-MHRS-GOALS-001',2,'approved','SYNTH-LPHA-APPROVER','2026-07-10T11:00:00Z','SYNTH-CCMG-DIRECTOR','2026-07-10T11:15:00Z','[{"sourceItemCode":"LIF-01","sourceDomain":"life_functioning","sourceRating":2,"goalCode":"MHRS-SKILL-LIF-01","goalText":"Build and practice a measurable skill for daily routine.","workflow":"MHRS"},{"sourceItemCode":"STR-01","sourceDomain":"strengths","sourceRating":1,"goalCode":"MHRS-SKILL-STR-01","goalText":"Build and practice a measurable skill for community connection.","workflow":"MHRS"}]','synthetic_demo','2026-07-10T11:15:00Z');
--> statement-breakpoint

INSERT INTO `m21_ccmg_work_items`
(`id`,`case_id`,`referral_id`,`youth_display_label`,`queue_id`,`title`,`status`,`priority`,`assigned_division`,`assigned_department`,`assigned_role`,`assigned_to`,`due_at`,`escalation_level`,`escalated_at`,`escalation_reason`,`approval_status`,`approved_by`,`approved_at`,`approval_rationale`,`exception_code`,`exception_reason`,`exception_status`,`source_type`,`source_id`,`evidence_class`,`version`,`created_at`,`updated_at`)
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
--> statement-breakpoint

INSERT INTO `m21_ccmg_handoffs`
(`id`,`case_id`,`referral_id`,`work_item_id`,`from_division`,`from_department`,`to_division`,`to_department`,`status`,`reason`,`payload_json`,`initiated_by`,`initiated_at`,`due_at`,`accepted_by`,`accepted_at`,`completed_at`,`evidence_class`,`version`)
VALUES
('M21-HANDOFF-MHTCM-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-WORK-MHTCM-001','BHC','CCMG','BHC','MHTCM','completed','Route approved CANS v2 goals to MHTCM.','{"cansAssessmentId":"M21-CANS-EXISTING-V2","targetRecordId":"SYNTH-MHTCM-PLAN-001","targetVersion":2}','SYNTH-CCMG-DIRECTOR','2026-07-10T11:15:00Z','2026-07-11T17:00:00Z','SYNTH-MHTCM-SUPERVISOR','2026-07-10T11:30:00Z','2026-07-10T12:00:00Z','synthetic_demo',2),
('M21-HANDOFF-MHRS-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-WORK-MHRS-001','BHC','CCMG','BHC','MHRS','accepted','Route approved CANS v2 skills goals to MHRS.','{"cansAssessmentId":"M21-CANS-EXISTING-V2","targetRecordId":"SYNTH-MHRS-GOALS-001","targetVersion":2}','SYNTH-CCMG-DIRECTOR','2026-07-10T11:15:00Z','2026-07-12T17:00:00Z','SYNTH-MHRS-SUPERVISOR','2026-07-10T11:45:00Z',NULL,'synthetic_demo',2),
('M21-HANDOFF-URGENT-001','M21-CASE-URGENT-001','M21-REF-URGENT-001','M21-WORK-URGENT-001','GRO','GRO','BHC','CCMG','initiated','Urgent cross-divisional clinical oversight handoff.','{"urgency":"emergency","exceptionCode":"AUTH-PENDING-URGENT"}','SYNTH-GRO-DIRECTOR','2026-07-14T07:15:00Z','2026-07-14T09:00:00Z',NULL,NULL,NULL,'synthetic_demo',1);
--> statement-breakpoint

INSERT INTO `m21_ccmg_audit_events`
(`id`,`case_id`,`referral_id`,`work_item_id`,`event_type`,`action`,`entity_type`,`entity_id`,`actor_id`,`actor_role`,`reason`,`before_json`,`after_json`,`changed_fields_json`,`correlation_id`,`evidence_class`,`occurred_at`)
VALUES
('M21-AUDIT-ACCESS-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001',NULL,'access','referral_detail_viewed','ccmg_referral','M21-REF-EXISTING-001','SYNTH-CCMG-DIRECTOR','ccmg-program-director','Synthetic role-based detail access.',NULL,NULL,'[]','M21-CORR-ACCESS-001','synthetic_demo','2026-07-10T12:00:00Z'),
('M21-AUDIT-ASSIGN-001','M21-CASE-NEW-001','M21-REF-NEW-001','M21-WORK-INTAKE-001','assignment','work_item_assigned','ccmg_work_item','M21-WORK-INTAKE-001','SYNTH-CCMG-DIRECTOR','ccmg-program-director','Assign synthetic intake work.','{"assignedTo":null}','{"assignedTo":"SYNTH-INTAKE-COORDINATOR"}','["assignedTo"]','M21-CORR-ASSIGN-001','synthetic_demo','2026-07-14T08:30:00Z'),
('M21-AUDIT-APPROVE-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-WORK-MHTCM-001','approval','work_item_approved','ccmg_work_item','M21-WORK-MHTCM-001','SYNTH-LPHA-APPROVER','treatment-director','Approve synthetic MHTCM plan routing.','{"approvalStatus":"pending"}','{"approvalStatus":"approved"}','["approvalStatus"]','M21-CORR-APPROVE-001','synthetic_demo','2026-07-10T11:00:00Z'),
('M21-AUDIT-HANDOFF-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','M21-WORK-MHTCM-001','plan_handoff','plan_handoff_completed','ccmg_handoff','M21-HANDOFF-MHTCM-001','SYNTH-MHTCM-SUPERVISOR','mhtcm-supervisor','Accept and complete synthetic MHTCM handoff.','{"status":"initiated"}','{"status":"completed"}','["status"]','M21-CORR-HANDOFF-001','synthetic_demo','2026-07-10T12:00:00Z'),
('M21-AUDIT-CHANGE-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001',NULL,'material_change','cans_version_advanced','ccmg_referral','M21-REF-EXISTING-001','SYNTH-CCMG-DIRECTOR','ccmg-program-director','Advance controlled CANS lineage to version 2.','{"currentCansVersion":1}','{"currentCansVersion":2}','["currentCansVersion"]','M21-CORR-CHANGE-001','synthetic_demo','2026-07-10T10:00:00Z');
