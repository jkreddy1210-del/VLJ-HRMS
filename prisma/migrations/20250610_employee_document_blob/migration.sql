ALTER TABLE `employee_documents`
  ADD COLUMN `mime_type` VARCHAR(100) NULL AFTER `file_name`,
  ADD COLUMN `file_data` LONGBLOB NULL AFTER `mime_type`,
  MODIFY COLUMN `file_path` VARCHAR(500) NULL;
