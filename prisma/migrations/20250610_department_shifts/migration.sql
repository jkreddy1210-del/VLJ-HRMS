CREATE TABLE `department_shifts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `department_id` INT NOT NULL,
  `shift_name` VARCHAR(100) NOT NULL,
  `start_time` VARCHAR(5) NOT NULL,
  `end_time` VARCHAR(5) NOT NULL,
  `grace_minutes` INT NOT NULL DEFAULT 0,
  `status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `created_by` INT NULL,
  `updated_by` INT NULL,
  INDEX `department_shifts_department_id_idx`(`department_id`),
  INDEX `department_shifts_status_idx`(`status`),
  INDEX `department_shifts_department_id_status_idx`(`department_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `department_shifts`
  ADD CONSTRAINT `department_shifts_department_id_fkey`
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `department_shifts`
  ADD CONSTRAINT `department_shifts_created_by_fkey`
  FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `department_shifts`
  ADD CONSTRAINT `department_shifts_updated_by_fkey`
  FOREIGN KEY (`updated_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `attendance`
  ADD COLUMN `late_minutes` INT NULL,
  ADD COLUMN `attendance_remark` VARCHAR(50) NULL;

INSERT INTO `permissions` (`permission_name`, `module_name`, `updated_at`)
SELECT 'Shift Management', 'Admin', NOW(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `permissions` WHERE `permission_name` = 'Shift Management'
);

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `updated_at`)
SELECT r.id, p.id, NOW(3)
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.role_name IN ('admin', 'hr', 'super_admin')
  AND p.permission_name = 'Shift Management'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
