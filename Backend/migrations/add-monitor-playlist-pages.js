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
    CREATE TABLE IF NOT EXISTS monitor_playlist_pages (
      playlist_page_id INT NOT NULL AUTO_INCREMENT,
      playlist_item_id INT NOT NULL,
      canvas_id INT NOT NULL,
      page_order INT NOT NULL DEFAULT 1,
      duration_seconds INT NOT NULL DEFAULT 10,
      PRIMARY KEY (playlist_page_id),
      KEY idx_monitor_playlist_pages_item_order (playlist_item_id, page_order),
      KEY idx_monitor_playlist_pages_canvas (canvas_id),
      CONSTRAINT fk_monitor_playlist_pages_item
        FOREIGN KEY (playlist_item_id)
        REFERENCES monitor_playlist_items (playlist_item_id)
        ON DELETE CASCADE,
      CONSTRAINT fk_monitor_playlist_pages_canvas
        FOREIGN KEY (canvas_id)
        REFERENCES canvases (canvas_id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
  console.log("[migration] monitor_playlist_pages is ready.");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[migration] Failed:", error);
    process.exit(1);
  });
