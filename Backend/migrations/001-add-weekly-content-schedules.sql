-- Apply once to an existing database before deploying weekly schedule support.
ALTER TABLE `monitor_schedules`
  ADD COLUMN `repeat_days` JSON DEFAULT NULL,
  ADD COLUMN `time_zone` VARCHAR(64) DEFAULT NULL,
  ADD COLUMN `repeat_start_time` TIME DEFAULT NULL,
  ADD COLUMN `repeat_end_time` TIME DEFAULT NULL;
