-- Add execution_plan column to schedules table
-- This column stores concrete parameters for scheduled execution from plan mode

ALTER TABLE `schedules` ADD COLUMN `execution_plan` json DEFAULT NULL AFTER `context_snapshot`;
