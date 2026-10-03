-- VLJ HRMS — schema upgrades needed for current code
-- Backup DB first. If a column already exists, skip that statement (MySQL will error "Duplicate column").

-- ========== 1. IFSC code (new) ==========
ALTER TABLE `employees`
  ADD COLUMN `ifsc_code` VARCHAR(11) NULL AFTER `account_number`;

-- ========== 2. Employee documents BLOB ==========
ALTER TABLE `employee_documents`
  ADD COLUMN `mime_type` VARCHAR(100) NULL AFTER `file_name`,
  ADD COLUMN `file_data` LONGBLOB NULL AFTER `mime_type`,
  MODIFY COLUMN `file_path` VARCHAR(500) NULL;

-- ========== 3. Profile photo LONGBLOB ==========
UPDATE `employees`
SET `profile_photo` = NULL
WHERE `profile_photo` IS NOT NULL
  AND (
    `profile_photo` LIKE '/%'
    OR `profile_photo` LIKE 'http%'
    OR `profile_photo` LIKE 'https%'
  );

ALTER TABLE `employees`
  MODIFY COLUMN `profile_photo` LONGBLOB NULL;

-- ========== 4. Personal info: mother, father, marital status ==========
ALTER TABLE `employees`
  ADD COLUMN `mother_name` VARCHAR(100) NULL AFTER `blood_group`,
  ADD COLUMN `father_name` VARCHAR(100) NULL AFTER `mother_name`,
  ADD COLUMN `marital_status` VARCHAR(20) NULL AFTER `father_name`;

-- ========== 5. Banks master (dropdown + addable) ==========
CREATE TABLE IF NOT EXISTS `banks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bank_name` VARCHAR(100) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `banks_bank_name_key` (`bank_name`),
  KEY `banks_bank_name_idx` (`bank_name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO `banks` (`bank_name`, `updated_at`)
SELECT DISTINCT TRIM(`bank_name`), NOW(3)
FROM `employees`
WHERE `bank_name` IS NOT NULL AND TRIM(`bank_name`) <> '';

INSERT IGNORE INTO `banks` (`bank_name`, `updated_at`) VALUES
  ('HDFC Bank', NOW(3)),
  ('ICICI Bank', NOW(3)),
  ('State Bank of India', NOW(3)),
  ('Axis Bank', NOW(3)),
  ('Kotak Mahindra Bank', NOW(3)),
  ('Bank of Baroda', NOW(3)),
  ('Canara Bank', NOW(3)),
  ('Union Bank of India', NOW(3)),
  ('Punjab National Bank', NOW(3)),
  ('Yes Bank', NOW(3));

-- ========== 6. Spouse, religion, nationality, temporary address ==========
ALTER TABLE `employees`
  ADD COLUMN `spouse_name` VARCHAR(100) NULL AFTER `marital_status`,
  ADD COLUMN `religion` VARCHAR(50) NULL AFTER `spouse_name`,
  ADD COLUMN `nationality` VARCHAR(50) NULL AFTER `religion`,
  ADD COLUMN `temporary_address` TEXT NULL AFTER `address`;

-- ========== 7. Festivals DB removed ==========
-- Dashboard calendar uses free Google "Holidays in India" ICS (no table / no yearly seed).
-- If an older festivals table exists, run: scripts/drop-festivals-table.sql
-- DROP TABLE IF EXISTS `festivals`;
