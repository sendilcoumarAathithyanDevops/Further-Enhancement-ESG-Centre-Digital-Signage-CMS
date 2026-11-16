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
    ALTER TABLE monitors
    MODIFY COLUMN monitor_category
      ENUM('environmental', 'governance', 'social', 'default') NOT NULL
  `);
  console.log("[migration] Default monitor category is ready.");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[migration] Failed:", error);
    process.exit(1);
  });
