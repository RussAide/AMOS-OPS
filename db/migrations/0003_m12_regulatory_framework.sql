-- M1.2: controlled regulatory register, prototype review evidence,
-- exceptions, and immutable control-event ledger.

CREATE TABLE `regulatory_sources` (
	`id` TEXT PRIMARY KEY NOT NULL,
	`title` TEXT NOT NULL,
	`authority` TEXT NOT NULL,
	`source_url` TEXT NOT NULL,
	`version_or_effective_date` TEXT NOT NULL,
	`validated_on` TEXT NOT NULL,
	`validation_status` TEXT NOT NULL CHECK (`validation_status` = 'current-source-validated')
);
--> statement-breakpoint

CREATE TABLE `regulatory_rules` (
	`id` TEXT PRIMARY KEY NOT NULL,
	`domain` TEXT NOT NULL CHECK (`domain` IN ('MHTCM', 'MHRS', 'BILLING', 'GRO', 'PART2')),
	`title` TEXT NOT NULL,
	`authority_id` TEXT NOT NULL,
	`citation` TEXT NOT NULL,
	`owner` TEXT NOT NULL,
	`state` TEXT NOT NULL CHECK (`state` IN ('operational', 'conditional')),
	`control_map_json` TEXT NOT NULL,
	`created_at` TEXT NOT NULL,
	FOREIGN KEY (`authority_id`) REFERENCES `regulatory_sources`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `idx_regulatory_rules_domain` ON `regulatory_rules` (`domain`, `state`);
--> statement-breakpoint

CREATE TABLE `regulatory_rule_reviews` (
	`id` TEXT PRIMARY KEY NOT NULL,
	`rule_id` TEXT NOT NULL,
	`review_lane` TEXT NOT NULL CHECK (`review_lane` IN ('compliance', 'operations')),
	`reviewer` TEXT NOT NULL,
	`reviewed_on` TEXT NOT NULL,
	`status` TEXT NOT NULL CHECK (`status` = 'prototype-reviewed'),
	`note` TEXT NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `regulatory_rules`(`id`) ON DELETE CASCADE,
	UNIQUE (`rule_id`, `review_lane`)
);
--> statement-breakpoint
CREATE INDEX `idx_regulatory_rule_reviews_rule` ON `regulatory_rule_reviews` (`rule_id`, `review_lane`);
--> statement-breakpoint

CREATE TABLE `regulatory_exceptions` (
	`id` TEXT PRIMARY KEY NOT NULL,
	`rule_id` TEXT NOT NULL,
	`title` TEXT NOT NULL,
	`safe_disposition` TEXT NOT NULL,
	`owner` TEXT NOT NULL,
	`status` TEXT NOT NULL CHECK (`status` IN ('controlled-open', 'resolved')),
	`resolved_at` TEXT,
	FOREIGN KEY (`rule_id`) REFERENCES `regulatory_rules`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `idx_regulatory_exceptions_status` ON `regulatory_exceptions` (`status`, `rule_id`);
--> statement-breakpoint

CREATE TABLE `regulatory_control_events` (
	`id` TEXT PRIMARY KEY NOT NULL,
	`rule_id` TEXT NOT NULL,
	`event_type` TEXT NOT NULL,
	`outcome` TEXT NOT NULL CHECK (`outcome` IN ('allow', 'deny', 'review')),
	`reason_codes_json` TEXT NOT NULL,
	`actor_id` TEXT,
	`subject_reference` TEXT,
	`correlation_id` TEXT NOT NULL,
	`occurred_at` TEXT NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `regulatory_rules`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `idx_regulatory_control_events_rule` ON `regulatory_control_events` (`rule_id`, `occurred_at`);
--> statement-breakpoint
CREATE INDEX `idx_regulatory_control_events_correlation` ON `regulatory_control_events` (`correlation_id`);
--> statement-breakpoint

INSERT INTO `regulatory_sources`
(`id`, `title`, `authority`, `source_url`, `version_or_effective_date`, `validated_on`, `validation_status`)
VALUES
('SRC-TMHP-BH-2026-07', 'Texas Medicaid Provider Procedures Manual - Behavioral Health Services Handbook', 'Texas Medicaid & Healthcare Partnership', 'https://www.tmhp.com/sites/default/files/file-library/resources/provider-manuals/tmppm/pdf-chapters/2026/2026-07-july/2_02_behavioral_health.pdf', 'July 2026 handbook', '2026-07-14', 'current-source-validated'),
('SRC-TX-26TAC-748', 'Texas Administrative Code - 26 TAC Chapter 748', 'Texas Secretary of State', 'https://texas-sos.appianportalsgov.com/rules-and-meetings?interface=VIEW_TAC&title=26&part=1&chapter=748', 'Official TAC chapter queried as in effect on 2026-07-14', '2026-07-14', 'current-source-validated'),
('SRC-42CFR-PART2', '42 CFR Part 2 - Confidentiality of Substance Use Disorder Patient Records', 'Electronic Code of Federal Regulations', 'https://www.ecfr.gov/current/title-42/chapter-I/subchapter-A/part-2', 'eCFR current through 2026-07-10 at validation', '2026-07-14', 'current-source-validated'),
('SRC-45CFR-164-502', '45 CFR 164.502 - Uses and disclosures of protected health information', 'Electronic Code of Federal Regulations', 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-E/section-164.502', 'Current online edition at validation', '2026-07-14', 'current-source-validated');
--> statement-breakpoint

INSERT INTO `regulatory_rules`
(`id`, `domain`, `title`, `authority_id`, `citation`, `owner`, `state`, `control_map_json`, `created_at`)
VALUES
('M12-CL-001','MHTCM','Intake screening function','SRC-TMHP-BH-2026-07','MHTCM six-function model','MHTCM Supervisor','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-CL-002','MHTCM','Eligibility function','SRC-TMHP-BH-2026-07','MHTCM six-function model','MHTCM Supervisor','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-CL-003','MHTCM','Care coordination function','SRC-TMHP-BH-2026-07','MHTCM six-function model','MHTCM Supervisor','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-CL-004','MHTCM','Referral management function','SRC-TMHP-BH-2026-07','MHTCM six-function model','MHTCM Supervisor','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-CL-005','MHTCM','Discharge planning function','SRC-TMHP-BH-2026-07','MHTCM six-function model','MHTCM Supervisor','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-CL-006','MHTCM','Aftercare follow-up function','SRC-TMHP-BH-2026-07','MHTCM six-function model','MHTCM Supervisor','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-CL-007','MHRS','Psychosocial rehabilitation category','SRC-TMHP-BH-2026-07','MHRS four-category model','MHRS Supervisor','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-CL-008','MHRS','Skills training category','SRC-TMHP-BH-2026-07','MHRS four-category model','MHRS Supervisor','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-CL-009','MHRS','Supportive interventions category','SRC-TMHP-BH-2026-07','MHRS four-category model','MHRS Supervisor','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-CL-010','MHRS','Community integration category','SRC-TMHP-BH-2026-07','MHRS four-category model','MHRS Supervisor','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-BL-001','BILLING','T1017 service-code and unit control','SRC-TMHP-BH-2026-07','T1017 billing requirements','Revenue Cycle Manager','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-BL-002','BILLING','H2017 service-code and unit control','SRC-TMHP-BH-2026-07','H2017 billing requirements','Revenue Cycle Manager','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-BL-003','BILLING','H2014 service-code and unit control','SRC-TMHP-BH-2026-07','H2014 billing requirements','Revenue Cycle Manager','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-BL-004','BILLING','H2014-HO conditional billing control','SRC-TMHP-BH-2026-07','H2014 with HO modifier as applicable','Revenue Cycle Manager','conditional','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-BL-005','BILLING','Service documentation completeness','SRC-TMHP-BH-2026-07','Documentation requirements','Clinical Supervisor','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-BL-006','BILLING','Authorization and review currency','SRC-TMHP-BH-2026-07','Prior authorization and periodic review','Clinical Supervisor','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-GRO-001','GRO','Awake and sleeping staffing ratios','SRC-TX-26TAC-748','26 TAC Chapter 748 supervision ratios','GRO Administrator','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-GRO-002','GRO','Under-five weighted supervision count','SRC-TX-26TAC-748','26 TAC Chapter 748 mixed-age supervision','Program Director','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-GRO-003','GRO','Bedroom square footage and capacity','SRC-TX-26TAC-748','26 TAC Chapter 748 physical environment','Facilities Manager','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-GRO-004','GRO','Youth rights delivery and acknowledgment','SRC-TX-26TAC-748','26 TAC Chapter 748 rights and responsibilities','Program Director','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-GRO-005','GRO','Prohibited practices','SRC-TX-26TAC-748','26 TAC Chapter 748 behavior intervention','Compliance Officer','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-GRO-006','GRO','Restraint monitoring and medical response','SRC-TX-26TAC-748','26 TAC Chapter 748 emergency behavior intervention','Director of Nursing','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-GRO-007','GRO','Post-event observation, discussion, and review','SRC-TX-26TAC-748','26 TAC Chapter 748 post-intervention review','Program Director','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-GRO-008','GRO','Child and personnel record retention','SRC-TX-26TAC-748','26 TAC Chapter 748 records','Compliance Officer','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-P2-001','PART2','Part 2 applicability and protected-pending-review flag','SRC-42CFR-PART2','42 CFR 2.11-2.12','Privacy Officer','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-P2-002','PART2','Consent content and validity','SRC-42CFR-PART2','42 CFR 2.31','Privacy Officer','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-P2-003','PART2','Minimum-necessary disclosure scope','SRC-45CFR-164-502','45 CFR 164.502(b)','Privacy Officer','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-P2-004','PART2','Accompanying notice and redisclosure control','SRC-42CFR-PART2','42 CFR 2.32-2.33','Privacy Officer','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-P2-005','PART2','Medical-emergency exception record','SRC-42CFR-PART2','42 CFR 2.51','Privacy Officer','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z'),
('M12-P2-006','PART2','Access/disclosure audit and accounting','SRC-42CFR-PART2','42 CFR 2.25','Privacy Officer','operational','{"ui":true,"api":true,"db":true,"audit":true,"exception":true,"test":true}','2026-07-14T00:00:00Z');
--> statement-breakpoint

INSERT INTO `regulatory_rule_reviews`
(`id`, `rule_id`, `review_lane`, `reviewer`, `reviewed_on`, `status`, `note`)
SELECT r.`id` || '-REV-' || CASE lane.`name` WHEN 'compliance' THEN 'C' ELSE 'O' END,
       r.`id`, lane.`name`,
       CASE lane.`name` WHEN 'compliance' THEN 'Synthetic Compliance SME' ELSE 'Synthetic Operational SME' END,
       '2026-07-14', 'prototype-reviewed',
       'Synthetic prototype review only; formal human acceptance remains the milestone owner decision.'
FROM `regulatory_rules` r
CROSS JOIN (SELECT 'compliance' AS `name` UNION ALL SELECT 'operations') lane;
--> statement-breakpoint

INSERT INTO `regulatory_exceptions`
(`id`, `rule_id`, `title`, `safe_disposition`, `owner`, `status`)
VALUES
('M12-EX-001','M12-BL-004','H2014-HO payer applicability','Keep inactive and deny billing until payer contract and authorization explicitly permit it.','Revenue Cycle Manager','controlled-open'),
('M12-EX-002','M12-GRO-002','Mixed-age or heightened-needs staffing','Apply the strictest calculated ratio and require Program Director review before shift release.','GRO Administrator','controlled-open'),
('M12-EX-003','M12-P2-001','Uncertain Part 2 applicability','Classify as protected-pending-review and prohibit disclosure until Privacy Officer determination.','Privacy Officer','controlled-open');
