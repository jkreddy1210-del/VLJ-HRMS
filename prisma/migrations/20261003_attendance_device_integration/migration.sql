-- Vendor-neutral attendance device registry, employee mapping, and inbound event ledger.
-- This migration does not alter existing employee or attendance identifiers.

CREATE TABLE `attendance_devices` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `provider` VARCHAR(50) NOT NULL,
  `external_device_id` VARCHAR(191) NULL,
  `location` VARCHAR(150) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `attendance_devices_external_device_id_key` (`external_device_id`),
  INDEX `attendance_devices_provider_idx` (`provider`),
  INDEX `attendance_devices_is_active_idx` (`is_active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `employee_device_mappings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `attendance_device_id` INT NOT NULL,
  `employee_id` INT NOT NULL,
  `device_employee_id` VARCHAR(191) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `employee_device_mappings_device_device_employee_key` (`attendance_device_id`, `device_employee_id`),
  UNIQUE INDEX `employee_device_mappings_device_employee_key` (`attendance_device_id`, `employee_id`),
  INDEX `employee_device_mappings_employee_id_idx` (`employee_id`),
  INDEX `employee_device_mappings_is_active_idx` (`is_active`),
  CONSTRAINT `employee_device_mappings_device_fkey`
    FOREIGN KEY (`attendance_device_id`) REFERENCES `attendance_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `employee_device_mappings_employee_fkey`
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `device_attendance_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `attendance_device_id` INT NOT NULL,
  `device_employee_id` VARCHAR(191) NOT NULL,
  `external_event_id` VARCHAR(191) NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  `event_type` VARCHAR(50) NULL,
  `processing_status` VARCHAR(30) NOT NULL DEFAULT 'Pending',
  `error_message` TEXT NULL,
  `raw_payload` JSON NULL,
  `processed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `device_attendance_events_device_external_event_key` (`attendance_device_id`, `external_event_id`),
  INDEX `device_attendance_events_device_employee_time_idx` (`attendance_device_id`, `device_employee_id`, `occurred_at`),
  INDEX `device_attendance_events_status_created_idx` (`processing_status`, `created_at`),
  CONSTRAINT `device_attendance_events_device_fkey`
    FOREIGN KEY (`attendance_device_id`) REFERENCES `attendance_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
