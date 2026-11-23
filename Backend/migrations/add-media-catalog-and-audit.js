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
    CREATE TABLE IF NOT EXISTS media_assets (
      media_path VARCHAR(500) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      owner_user_id INT DEFAULT NULL,
      category_tag VARCHAR(32) DEFAULT NULL,
      uploaded_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (media_path),
      KEY idx_media_assets_category (category_tag),
      KEY idx_media_assets_owner (owner_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_log_id BIGINT NOT NULL AUTO_INCREMENT,
      actor_user_id INT DEFAULT NULL,
      actor_username VARCHAR(100) NOT NULL,
      action VARCHAR(16) NOT NULL,
      resource VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45) DEFAULT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (audit_log_id),
      KEY idx_audit_logs_created_at (created_at),
      KEY idx_audit_logs_actor (actor_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
  console.log("[migration] media_assets and audit_logs are ready.");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[migration] Failed:", error);
    process.exit(1);
  });
