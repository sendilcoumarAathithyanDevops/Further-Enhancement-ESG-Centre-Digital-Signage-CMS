const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const mysql = require("mysql2/promise");
const memoryDb = require("./fallbackStore");

const primaryRequiredSettings = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const primaryMissingSettings = primaryRequiredSettings.filter((name) => {
  const value = process.env[name]?.trim();
  return !value || value.startsWith("replace-with-");
});

function createPool({ host, port, user, password, database, ssl, connectTimeout }) {
  return mysql.createPool({
    host,
    port: Number(port || 3306),
    user,
    password,
    database,
    ssl: ssl === "true" ? { rejectUnauthorized: false } : undefined,
    connectTimeout: Number(connectTimeout || 10000),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

const pools = [];
if (primaryMissingSettings.length === 0) {
  pools.push({
    source: "primary-sql",
    pool: createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL,
      connectTimeout: process.env.DB_CONNECT_TIMEOUT,
    }),
  });
}

const fallbackRequiredSettings = [
  "DB_FALLBACK_HOST",
  "DB_FALLBACK_USER",
  "DB_FALLBACK_NAME",
];
const fallbackConfigured = fallbackRequiredSettings.every((name) =>
  process.env[name]?.trim()
);
if (fallbackConfigured) {
  pools.push({
    source: "fallback-sql",
    pool: createPool({
      host: process.env.DB_FALLBACK_HOST,
      port: process.env.DB_FALLBACK_PORT,
      user: process.env.DB_FALLBACK_USER,
      password: process.env.DB_FALLBACK_PASSWORD || "",
      database: process.env.DB_FALLBACK_NAME,
      ssl: process.env.DB_FALLBACK_SSL,
      connectTimeout: process.env.DB_FALLBACK_CONNECT_TIMEOUT,
    }),
  });
}

let activePoolIndex = null;
let lastDatabaseError = null;

function isConnectionError(error) {
  const unavailableCodes = new Set([
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ECONNRESET",
    "EPIPE",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "PROTOCOL_CONNECTION_LOST",
    "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
    "PROTOCOL_SEQUENCE_TIMEOUT",
    "ER_ACCESS_DENIED_ERROR",
    "ER_BAD_DB_ERROR",
  ]);

  return unavailableCodes.has(error?.code);
}

function activatePool(index) {
  activePoolIndex = index;
  lastDatabaseError = null;
  memoryDb.deactivate();
  console.warn(`[database] Using ${pools[index].source}.`);
}

function activateFileFallback(error) {
  activePoolIndex = null;
  lastDatabaseError = error;
  memoryDb.activate(error);
  console.warn(
    `[database] SQL unavailable (${error?.code || error?.message}); using fallback data store.`
  );
}

function handleConnectionFailure(index, error) {
  lastDatabaseError = error;
  if (index + 1 < pools.length) {
    activePoolIndex = index + 1;
    console.warn(
      `[database] ${pools[index].source} connection lost; next operations will use ${pools[index + 1].source}.`
    );
    return;
  }
  activateFileFallback(error);
}

function watchConnection(connection, index) {
  return new Proxy(connection, {
    get(target, property) {
      const method = target[property];
      if (property === "query" || property === "execute") {
        return async (...args) => {
          try {
            return await method.apply(target, args);
          } catch (error) {
            if (isConnectionError(error)) handleConnectionFailure(index, error);
            throw error;
          }
        };
      }
      return typeof method === "function" ? method.bind(target) : method;
    },
  });
}

async function checkDatabase() {
  if (pools.length === 0) {
    const message = primaryMissingSettings.length
      ? `Missing database configuration: ${primaryMissingSettings.join(", ")}`
      : "No SQL database is configured.";
    activateFileFallback(new Error(message));
    return;
  }

  let lastError;
  for (let index = 0; index < pools.length; index += 1) {
    try {
      await pools[index].pool.query("SELECT 1");
      activatePool(index);
      return;
    } catch (error) {
      lastError = error;
      console.warn(
        `[database] ${pools[index].source} unavailable (${error.code || error.message}).`
      );
    }
  }

  activateFileFallback(lastError);
}

async function query(sql, params) {
  if (activePoolIndex === null) {
    return memoryDb.query(sql, params);
  }

  for (let index = activePoolIndex; index < pools.length; index += 1) {
    try {
      const result = await pools[index].pool.query(sql, params);
      if (index !== activePoolIndex) activatePool(index);
      return result;
    } catch (error) {
      if (!isConnectionError(error)) throw error;
      lastDatabaseError = error;
      if (index === pools.length - 1) {
        activateFileFallback(error);
        return memoryDb.query(sql, params);
      }
      console.warn(
        `[database] ${pools[index].source} connection lost; trying ${pools[index + 1].source}.`
      );
    }
  }
}

async function getConnection() {
  if (activePoolIndex === null) {
    return memoryDb.getConnection();
  }

  for (let index = activePoolIndex; index < pools.length; index += 1) {
    try {
      const connection = await pools[index].pool.getConnection();
      if (index !== activePoolIndex) activatePool(index);
      return watchConnection(connection, index);
    } catch (error) {
      if (!isConnectionError(error)) throw error;
      lastDatabaseError = error;
      if (index === pools.length - 1) {
        activateFileFallback(error);
        return memoryDb.getConnection();
      }
      console.warn(
        `[database] ${pools[index].source} connection lost; trying ${pools[index + 1].source}.`
      );
    }
  }
}

const resilientDb = {
  query,
  execute: query,
  getConnection,
  getStatus() {
    return {
      source:
        activePoolIndex === null
          ? "fallback"
          : pools[activePoolIndex].source,
      available: activePoolIndex !== null,
      sqlError: lastDatabaseError
        ? lastDatabaseError.code || lastDatabaseError.message
        : null,
      ...memoryDb.getStatus(),
    };
  },
};

checkDatabase();

module.exports = resilientDb;
