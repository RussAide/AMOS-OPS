CREATE TABLE `hr_offers` (
  `application_reference` text COLLATE NOCASE PRIMARY KEY NOT NULL REFERENCES `hr_applications`(`reference`) ON DELETE RESTRICT,
  `offer_reference` text COLLATE NOCASE NOT NULL,
  `selection_reference` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `response_reference` text,
  `person_id` text REFERENCES `hr_people`(`id`) ON DELETE RESTRICT,
  `packet_reference` text,
  `file_checklist_reference` text,
  `packet_status` text DEFAULT 'pending' NOT NULL,
  `revision` integer DEFAULT 1 NOT NULL,
  CONSTRAINT `hr_offers_response_state` CHECK (
    (`status` = 'pending' AND `response_reference` IS NULL AND `person_id` IS NULL) OR
    (`status` = 'declined' AND `response_reference` IS NOT NULL AND `person_id` IS NULL) OR
    (`status` = 'accepted' AND `response_reference` IS NOT NULL AND `person_id` IS NOT NULL)
  )
);
CREATE UNIQUE INDEX `hr_offers_offer_reference_unique` ON `hr_offers` (`offer_reference`);
CREATE UNIQUE INDEX `hr_offers_person_id_unique` ON `hr_offers` (`person_id`);
