-- Month-wise attendance totals for Attendance Report bulk upload
CREATE TABLE `attendance_monthly_summaries` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `employee_id` INT NOT NULL,
  `employee_code` VARCHAR(20) NOT NULL,
  `year` INT NOT NULL,
  `month` INT NOT NULL,
  `month_name` VARCHAR(20) NOT NULL,
  `late_days` INT NOT NULL DEFAULT 0,
  `full_days` INT NOT NULL DEFAULT 0,
  `half_days` INT NOT NULL DEFAULT 0,
  `sundays` INT NOT NULL DEFAULT 0,
  `total_present_days` INT NOT NULL DEFAULT 0,
  `absent_days` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `created_by` INT NULL,
  `updated_by` INT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `attendance_monthly_summaries_employee_id_year_month_key`(`employee_id`, `year`, `month`),
  INDEX `attendance_monthly_summaries_employee_code_idx`(`employee_code`),
  INDEX `attendance_monthly_summaries_year_month_idx`(`year`, `month`),
  CONSTRAINT `attendance_monthly_summaries_employee_id_fkey`
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `attendance_monthly_summaries_created_by_fkey`
    FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `attendance_monthly_summaries_updated_by_fkey`
    FOREIGN KEY (`updated_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
