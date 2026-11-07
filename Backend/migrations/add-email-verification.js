// One-off migration: adds email-verification columns to `users`.
// Safe to re-run — each column is only added if it doesn't already exist.
// Existing rows are backfilled as email_verified = 1 (grandfathered in),
// since they predate this feature and never had a chance to verify.

const db = require("../db");

const COLUMNS = [
  {
    name: "email_verified",
    ddl: "ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 1",
  },
  {
    name: "email_verification_token_hash",
    ddl: "ADD COLUMN email_verification_token_hash VARCHAR(255) NULL",
  },
  {
    name: "email_verification_expires_at",
    ddl: "ADD COLUMN email_verification_expires_at DATETIME NULL",
  },
  {
    name: "pending_email",
    ddl: "ADD COLUMN pending_email VARCHAR(255) NULL",
  },
];

async function columnExists(columnName) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = ?`,
    [columnName]
  );
  return rows[0].count > 0;
}

async function run() {
  for (const column of COLUMNS) {
    const exists = await columnExists(column.name);
    if (exists) {
      console.log(`[migration] users.${column.name} already exists — skipping.`);
      continue;
    }
    console.log(`[migration] Adding users.${column.name} ...`);
    await db.query(`ALTER TABLE users ${column.ddl}`);
    console.log(`[migration] Added users.${column.name}.`);
  }

  console.log("[migration] Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error("[migration] Failed:", err);
  process.exit(1);
});
