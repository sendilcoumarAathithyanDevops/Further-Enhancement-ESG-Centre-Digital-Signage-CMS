ALTER TABLE monitor_commands
  MODIFY COLUMN command_type ENUM(
    'launch_display',
    'restart_browser',
    'reload_project',
    'sleep_pc',
    'wake_pc',
    'shutdown_pc',
    'display_off',
    'display_on'
  ) NOT NULL;
