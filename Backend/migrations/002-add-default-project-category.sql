ALTER TABLE projects
  MODIFY COLUMN category ENUM(
    'environmental',
    'governance',
    'social',
    'default'
  ) NOT NULL;
