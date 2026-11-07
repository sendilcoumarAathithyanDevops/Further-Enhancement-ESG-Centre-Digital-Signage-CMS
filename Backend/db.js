const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const mysql = require("mysql2/promise");
const memoryDb = require("./fallbackStore");

const requiredSettings = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingSettings = requiredSettings.filter((name) => {
  const value = process.env[name]?.trim();
  return !value || value.startsWith("replace-with-");
});
const sslEnabled = process.env.DB_SSL === "true";

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

let databaseAvailable = false;

async function checkDatabase() {
  if (missingSettings.length > 0) {
    const error = new Error(
      `Missing database configuration: ${missingSettings.join(", ")}`
    );
    databaseAvailable = false;
    memoryDb.activate(error);
    console.warn(`[database] ${error.message}`);
    return;
  }

  try {
    await db.query("SELECT 1");
    databaseAvailable = true;
    memoryDb.deactivate();
  } catch (error) {
    databaseAvailable = false;
    memoryDb.activate(error);
    console.warn(
      `[database] SQL unavailable (${error.code || error.message}); using fallback data store.`
    );
  }
}

function isConnectionError(error) {
  const unavailableCodes = new Set([
    "ETIMEDOUT",
    "ECONNREFUSED",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "PROTOCOL_CONNECTION_LOST",
    "ER_ACCESS_DENIED_ERROR",
    "ER_BAD_DB_ERROR",
  ]);

  return unavailableCodes.has(error?.code);
}

async function query(sql, params) {
  if (!databaseAvailable) {
    return memoryDb.query(sql, params);
  }

  try {
    return await db.query(sql, params);
  } catch (error) {
    if (!isConnectionError(error)) throw error;
    databaseAvailable = false;
    memoryDb.activate(error);
    console.warn("[database] SQL connection lost; using fallback data store.");
    return memoryDb.query(sql, params);
  }
}

async function getConnection() {
  if (!databaseAvailable) {
    return memoryDb.getConnection();
  }

  try {
    return await db.getConnection();
  } catch (error) {
    if (!isConnectionError(error)) throw error;
    databaseAvailable = false;
    memoryDb.activate(error);
    return memoryDb.getConnection();
  }
}

const resilientDb = {
  query,
  execute: query,
  getConnection,
  getStatus() {
    return {
      source: databaseAvailable ? "sql" : "fallback",
      available: databaseAvailable,
      ...memoryDb.getStatus(),
    };
  },
};

checkDatabase();

module.exports = resilientDb;