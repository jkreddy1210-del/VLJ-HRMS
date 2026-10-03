CREATE TABLE `attendance_status_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(30) NOT NULL,
  `label` VARCHAR(50) NOT NULL,
  `db_enum` ENUM('Present','Absent','Late','Half_Day','Leave','Holiday','Weekly_Off') NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_markable` BOOLEAN NOT NULL DEFAULT true,
  `is_filterable` BOOLEAN NOT NULL DEFAULT true,
  `requires_in_time` BOOLEAN NOT NULL DEFAULT false,
  `badge_variant` VARCHAR(20) NOT NULL DEFAULT 'secondary',
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `attendance_status_settings_code_key`(`code`),
  INDEX `attendance_status_settings_is_active_sort_order_idx`(`is_active`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `attendance_status_settings`
  (`code`, `label`, `db_enum`, `sort_order`, `is_markable`, `is_filterable`, `requires_in_time`, `badge_variant`, `is_active`, `updated_at`)
VALUES
  ('present', 'Present', 'Present', 1, true, true, true, 'success', true, NOW(3)),
  ('absent', 'Absent', 'Absent', 2, true, true, false, 'destructive', true, NOW(3)),
  ('halfDay', 'Half Day', 'Half_Day', 3, true, true, true, 'warning', true, NOW(3)),
  ('leave', 'Leave', 'Leave', 4, true, true, false, 'secondary', true, NOW(3)),
  ('late', 'Late', 'Late', 5, false, true, true, 'info', true, NOW(3));
