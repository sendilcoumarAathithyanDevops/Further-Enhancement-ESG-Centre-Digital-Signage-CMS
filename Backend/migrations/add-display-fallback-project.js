const db = require("../db");

const WAIT_INTERVAL_MS = 100;
const WAIT_TIMEOUT_MS = 15000;

async function waitForSqlDatabase() {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = db.getStatus();
    if (status.available) return;
    if (status.sqlError) {
      throw new Error(`SQL database is unavailable: ${status.sqlError}`);
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
  }
  throw new Error("Timed out waiting for the SQL database connection.");
}

async function run() {
  await waitForSqlDatabase();
  await db.query(`
    CREATE TABLE IF NOT EXISTS display_fallback_settings (
      setting_id TINYINT NOT NULL,
      project_id INT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (setting_id),
      CONSTRAINT fk_display_fallback_project
        FOREIGN KEY (project_id) REFERENCES projects (project_id)
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
  await db.query(`
    INSERT IGNORE INTO display_fallback_settings (setting_id, project_id)
    SELECT 1, project_id
    FROM projects
    WHERE name = 'Welcome Page'
      AND category = 'default'
      AND status = 'published'
      AND is_template = FALSE
    ORDER BY project_id ASC
    LIMIT 1
  `);
  console.log("[migration] display_fallback_settings is ready.");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[migration] Failed:", error);
    process.exit(1);
  });
