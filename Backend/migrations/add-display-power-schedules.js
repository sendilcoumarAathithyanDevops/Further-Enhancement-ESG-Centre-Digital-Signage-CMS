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
    CREATE TABLE IF NOT EXISTS display_power_schedules (
      power_schedule_id INT NOT NULL AUTO_INCREMENT,
      monitor_id INT NOT NULL,
      created_by INT NOT NULL,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      sleep_time TIME NOT NULL,
      wake_time TIME NOT NULL,
      repeat_days JSON NOT NULL,
      notes VARCHAR(500) DEFAULT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (power_schedule_id),
      KEY idx_power_schedule_monitor (monitor_id),
      KEY idx_power_schedule_created_by (created_by),
      CONSTRAINT fk_power_schedule_monitor
        FOREIGN KEY (monitor_id) REFERENCES monitors (monitor_id) ON DELETE CASCADE,
      CONSTRAINT fk_power_schedule_user
        FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
  console.log("[migration] display_power_schedules is ready.");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[migration] Failed:", error);
    process.exit(1);
  });
