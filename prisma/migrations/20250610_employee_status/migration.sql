-- Step 1: Add Inactive to enum (keep Resigned temporarily)
ALTER TABLE `employees`
  MODIFY COLUMN `status` ENUM('Active','Resigned','Inactive','On_Hold','Terminated') NOT NULL DEFAULT 'Active';

-- Step 2: Migrate Resigned -> Inactive
UPDATE `employees` SET `status` = 'Inactive' WHERE `status` = 'Resigned';

-- Step 3: Remove Resigned from enum
ALTER TABLE `employees`
  MODIFY COLUMN `status` ENUM('Active','Inactive','On_Hold','Terminated') NOT NULL DEFAULT 'Active';
