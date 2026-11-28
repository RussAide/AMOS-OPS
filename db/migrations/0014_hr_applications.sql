CREATE TABLE `hr_applications` (
  `reference` text COLLATE NOCASE PRIMARY KEY NOT NULL,
  `requisition_reference` text NOT NULL REFERENCES `hr_requisitions`(`reference`) ON DELETE RESTRICT,
  `source_reference` text NOT NULL,
  `qualification_outcome` text DEFAULT 'pending' NOT NULL,
  `qualification_reference` text,
  `screening_reference` text,
  `interview_reference` text,
  `references_reference` text,
  `disposition` text DEFAULT 'pending' NOT NULL,
  `revision` integer DEFAULT 1 NOT NULL
);
CREATE INDEX `idx_hr_applications_requisition` ON `hr_applications` (`requisition_reference`);
