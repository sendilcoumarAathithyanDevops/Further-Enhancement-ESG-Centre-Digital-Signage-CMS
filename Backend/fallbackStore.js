const fs = require("fs");
const path = require("path");

const dataFile = process.env.FALLBACK_DB_FILE
  ? path.resolve(process.env.FALLBACK_DB_FILE)
  : path.join(__dirname, "data", "fallback-db.json");

let data = {};
let fallbackError = null;
let fallbackActive = false;

function splitSqlValues(text) {
  const rows = [];
  let current = "";
  let quote = null;
  let depth = 0;
  let escaped = false;

  for (const char of text.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote) {
      current += char;
      escaped = true;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === "`" || char === '"') {
      quote = char;
      current += char;
    } else if (char === "(") {
      depth += 1;
      current += char;
    } else if (char === ")") {
      depth -= 1;
      current += char;
    } else if (char === "," && depth === 0) {
      rows.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) rows.push(current.trim());
  return rows;
}

function parseSqlValue(raw) {
  const value = raw.trim();
  if (/^NULL$/i.test(value)) return null;
  if (/^\d+$/.test(value)) return Number(value);
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return value;
}

function parseTuple(tuple) {
  return splitSqlValues(tuple.replace(/^\(/, "").replace(/\)$/, "")).map(parseSqlValue);
}

function seedFromSqlDump() {
  const dumpPath = path.resolve(__dirname, "..", "FYP CMS System Database.sql");
  if (!fs.existsSync(dumpPath)) return {};

  const sql = fs.readFileSync(dumpPath, "utf8");
  const tables = {};
  const createPattern = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\) ENGINE=/gi;
  let createMatch;

  while ((createMatch = createPattern.exec(sql))) {
    const table = createMatch[1];
    const columns = [];
    for (const line of createMatch[2].split(/\r?\n/)) {
      const match = /^\s*`([^`]+)`/.exec(line);
      if (match) columns.push(match[1]);
    }
    tables[table] = [];
    tables[table]._columns = columns;
  }

  const insertPattern = /INSERT INTO `([^`]+)`(?:\s*\(([^)]+)\))?\s+VALUES\s+([\s\S]*?);/gi;
  let insertMatch;
  while ((insertMatch = insertPattern.exec(sql))) {
    const table = insertMatch[1];
    if (!tables[table]) continue;
    const columns = insertMatch[2]
      ? insertMatch[2].split(",").map((column) => column.trim().replace(/`/g, ""))
      : tables[table]._columns;
    const tuples = splitSqlValues(insertMatch[3]);
    for (const tuple of tuples) {
      const values = parseTuple(tuple);
      const row = {};
      columns.forEach((column, index) => {
        row[column] = values[index] ?? null;
      });
      tables[table].push(row);
    }
  }

  for (const table of Object.keys(tables)) {
    delete tables[table]._columns;
  }
  return tables;
}

function loadData() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  if (fs.existsSync(dataFile)) {
    data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } else {
    data = seedFromSqlDump();
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  }
}

function saveData() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function unalias(column) {
  return String(column).split(".").pop().replace(/[`"]/g, "");
}

function compareWhere(condition, row, params) {
  const match = /^\s*([A-Za-z_][\w.]*)\s*(=|!=|<>|>=|<=|>|<)\s*(?:\?|NULL|'([^']*)')\s*$/i.exec(condition);
  if (!match) return true;
  const column = unalias(match[1]);
  const operator = match[2];
  const expected = match[3] !== undefined ? match[3] : params.shift();
  const actual = row[column];
  const equal = String(actual ?? "") === String(expected ?? "");
  return operator === "=" ? equal : operator === "!=" || operator === "<>" ? !equal : actual != null && (
    (operator === ">" && actual > expected) ||
    (operator === "<" && actual < expected) ||
    (operator === ">=" && actual >= expected) ||
    (operator === "<=" && actual <= expected)
  );
}

function matchesWhere(where, row, params) {
  return where.split(/\s+OR\s+/i).some((orGroup) =>
    orGroup.split(/\s+AND\s+/i).every((condition) =>
      compareWhere(condition, row, [...params])
    )
  );
}

function selectedRows(sql, params) {
  const from = /FROM\s+`?([A-Za-z_]\w*)`?(?:\s+(?:AS\s+)?([A-Za-z_]\w*))?/i.exec(sql);
  if (!from) return [];
  const rows = [...(data[from[1]] || [])];
  const where = /\bWHERE\s+(.*?)(?:\bORDER BY\b|\bGROUP BY\b|\bLIMIT\b|;?$)/is.exec(sql);
  const filtered = !where ? rows : rows.filter((row) => {
    const remainingParams = [...params];
    return matchesWhere(where[1], row, remainingParams);
  });
  const order = /\bORDER BY\s+([A-Za-z_][\w.]*)\s*(ASC|DESC)?/i.exec(sql);
  if (order) {
    const column = unalias(order[1]);
    filtered.sort((a, b) => String(a[column] ?? "").localeCompare(String(b[column] ?? "")));
    if (/DESC/i.test(order[2] || "")) filtered.reverse();
  }
  const limit = /\bLIMIT\s+(\d+)/i.exec(sql);
  return limit ? filtered.slice(0, Number(limit[1])) : filtered;
}

function projectSelect(sql, rows) {
  if (/\bCOUNT\s*\(\s*\*\s*\)/i.test(sql)) {
    return [{ count: rows.length }];
  }
  const select = /SELECT\s+(.*?)\s+FROM\s/is.exec(sql)?.[1] || "*";
  if (select.trim() === "*") return rows;
  return rows.map((row) => {
    const projected = {};
    for (const expression of select.split(/,(?![^']*')/)) {
      const alias = /\s+AS\s+`?([A-Za-z_]\w*)`?\s*$/i.exec(expression.trim());
      let column = expression.trim();
      if (alias) column = column.slice(0, alias.index).trim();
      column = unalias(column);
      if (Object.prototype.hasOwnProperty.call(row, column)) projected[alias ? alias[1] : column] = row[column];
    }
    return projected;
  });
}

async function query(sql, params = []) {
  loadData();
  const normalized = String(sql).trim();
  if (/^SELECT/i.test(normalized)) {
    const rows = projectSelect(normalized, selectedRows(normalized, params));
    return [rows, []];
  }

  const insert = /^INSERT(?:\s+IGNORE)?\s+INTO\s+`?([A-Za-z_]\w*)`?\s*(?:\(([^)]+)\))?\s+VALUES\s*(\([\s\S]*\))/is.exec(normalized);
  if (insert) {
    const table = insert[1];
    const columns = insert[2] ? insert[2].split(",").map((item) => item.trim().replace(/`/g, "")) : Object.keys(data[table]?.[0] || {});
    const values = splitSqlValues(insert[3]);
    data[table] ||= [];
    let firstInsertId = 0;
    for (const tuple of values) {
      const tupleValues = parseTuple(tuple);
      const row = {};
      columns.forEach((column, index) => {
        const value = tupleValues[index] === "?" ? params.shift() : tupleValues[index];
        row[column] = value;
      });
      if (!Object.keys(row).length) continue;
      data[table].push(row);
      if (row.id != null && typeof row.id === "number") firstInsertId = row.id;
      else if (row[`${table}_id`] != null) firstInsertId = row[`${table}_id`];
      else firstInsertId = data[table].length;
    }
    saveData();
    return [{ insertId: firstInsertId, affectedRows: values.length }, []];
  }

  const update = /^UPDATE\s+`?([A-Za-z_]\w*)`?\s+SET\s+([\s\S]*?)(?:\s+WHERE\s+([\s\S]*))?$/is.exec(normalized);
  if (update) {
    const table = data[update[1]] || [];
    const assignments = update[2].split(",");
    let affectedRows = 0;
    for (const row of table) {
      if (update[3] && !matchesWhere(update[3], row, params)) continue;
      for (const assignment of assignments) {
        const match = /^\s*`?([A-Za-z_]\w*)`?\s*=/.exec(assignment);
        if (!match) continue;
        const value = /\?\s*$/.test(assignment) ? params.shift() : parseSqlValue(assignment.split("=")[1].trim());
        row[match[1]] = value;
      }
      affectedRows += 1;
    }
    saveData();
    return [{ affectedRows, changedRows: affectedRows }, []];
  }

  const remove = /^DELETE\s+FROM\s+`?([A-Za-z_]\w*)`?(?:\s+WHERE\s+([\s\S]*))?$/is.exec(normalized);
  if (remove) {
    const table = data[remove[1]] || [];
    const before = table.length;
    const remainingParams = [...params];
    data[remove[1]] = remove[2] ? table.filter((row) =>
      !matchesWhere(remove[2], row, remainingParams)) : [];
    saveData();
    return [{ affectedRows: before - data[remove[1]].length }, []];
  }

  throw new Error(`Fallback store does not support SQL: ${normalized.slice(0, 120)}`);
}

loadData();

module.exports = {
  activate(error) {
    fallbackActive = true;
    fallbackError = error;
  },
  deactivate() {
    fallbackActive = false;
    fallbackError = null;
  },
  getStatus() {
    return {
      fallbackActive,
      fallbackError: fallbackError ? fallbackError.code || fallbackError.message : null,
      fallbackFile: dataFile,
    };
  },
  query,
  getConnection() {
    return Promise.resolve({
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
      query,
      execute: query,
    });
  },
};
