-- Designation employee ID fields + department link
ALTER TABLE `designations`
  ADD COLUMN `designation_code` VARCHAR(10) NULL AFTER `designation_name`,
  ADD COLUMN `department_id` INT NULL AFTER `designation_code`,
  ADD COLUMN `sequence_start` INT NULL AFTER `department_id`,
  ADD COLUMN `last_sequence` INT NULL AFTER `sequence_start`,
  ADD COLUMN `released_sequences` JSON NOT NULL DEFAULT ('[]') AFTER `last_sequence`;

-- Drop old unique on designation_name only (if exists)
ALTER TABLE `designations` DROP INDEX `designations_designation_name_key`;

-- Backfill will be done via seed reset; add FK after data migration
-- CREATE INDEX + unique constraints applied after seed
