-- Employee Category migration
ALTER TABLE `employees`
  ADD COLUMN `employee_category` ENUM('Fresher','Experienced') NOT NULL DEFAULT 'Fresher' AFTER `aadhaar`,
  ADD COLUMN `qualification` VARCHAR(150) NULL AFTER `employee_category`,
  ADD COLUMN `specialization` VARCHAR(150) NULL AFTER `qualification`,
  ADD COLUMN `skills` TEXT NULL AFTER `specialization`,
  ADD COLUMN `college_name` VARCHAR(200) NULL AFTER `skills`,
  ADD COLUMN `graduation_year` INT NULL AFTER `college_name`,
  ADD COLUMN `cgpa` VARCHAR(20) NULL AFTER `graduation_year`,
  ADD COLUMN `internship_details` TEXT NULL AFTER `cgpa`,
  ADD COLUMN `certifications` TEXT NULL AFTER `internship_details`,
  ADD COLUMN `total_experience_years` INT NULL AFTER `certifications`,
  ADD COLUMN `total_experience_months` INT NULL AFTER `total_experience_years`,
  ADD COLUMN `previous_company` VARCHAR(200) NULL AFTER `total_experience_months`,
  ADD COLUMN `previous_designation` VARCHAR(150) NULL AFTER `previous_company`,
  ADD COLUMN `previous_ctc` DECIMAL(12,2) NULL AFTER `previous_designation`,
  ADD COLUMN `expected_ctc` DECIMAL(12,2) NULL AFTER `previous_ctc`,
  ADD COLUMN `last_working_date` DATE NULL AFTER `expected_ctc`,
  ADD COLUMN `notice_period` VARCHAR(100) NULL AFTER `last_working_date`,
  ADD COLUMN `relevant_experience` TEXT NULL AFTER `notice_period`,
  ADD COLUMN `experience_letter_url` VARCHAR(500) NULL AFTER `relevant_experience`,
  ADD COLUMN `relieving_letter_url` VARCHAR(500) NULL AFTER `experience_letter_url`,
  ADD COLUMN `payslip_urls` JSON NULL AFTER `relieving_letter_url`;

ALTER TABLE `employees` ADD INDEX `employees_employee_category_idx` (`employee_category`);

-- Extend document_type enum for experience documents
ALTER TABLE `employee_documents`
  MODIFY COLUMN `document_type` ENUM(
    'Aadhaar','PAN','Bank_Passbook','Offer_Letter','Agreement',
    'Experience_Letter','Relieving_Letter','Payslip','Other'
  ) NOT NULL;
