CREATE TABLE `hr_requisitions` (
  `reference` text COLLATE NOCASE PRIMARY KEY NOT NULL,
  `position` text NOT NULL,
  `department` text NOT NULL,
  `supervisor` text NOT NULL,
  `hiring_owner` text NOT NULL,
  `approved_headcount` integer NOT NULL,
  `revision` integer DEFAULT 1 NOT NULL,
  CONSTRAINT `hr_requisitions_headcount` CHECK (typeof(`approved_headcount`) = 'integer' AND `approved_headcount` BETWEEN 1 AND 999)
);
