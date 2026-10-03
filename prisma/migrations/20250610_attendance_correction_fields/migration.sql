ALTER TABLE `attendance_corrections`
  MODIFY `attendance_id` INT NULL,
  ADD COLUMN `attendance_date` DATE NOT NULL DEFAULT (CURRENT_DATE) AFTER `attendance_id`,
  ADD COLUMN `current_status` ENUM('Present','Absent','Late','Half_Day','Leave','Holiday','Weekly_Off') NULL AFTER `attendance_date`,
  ADD COLUMN `requested_status` ENUM('Present','Absent','Late','Half_Day','Leave','Holiday','Weekly_Off') NOT NULL DEFAULT 'Present' AFTER `current_status`;

UPDATE `attendance_corrections` ac
INNER JOIN `attendance` a ON ac.attendance_id = a.id
SET ac.attendance_date = a.attendance_date,
    ac.current_status = a.attendance_status,
    ac.requested_status = a.attendance_status
WHERE ac.attendance_id IS NOT NULL;
