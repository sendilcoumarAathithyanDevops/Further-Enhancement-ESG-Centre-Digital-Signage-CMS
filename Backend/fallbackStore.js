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

  if (Array.isArray(data.monitor_schedules)) {
    let nextId = data.monitor_schedules.reduce(
      (maximum, schedule) => Math.max(maximum, Number(schedule.schedule_id) || 0),
      0
    );
    let changed = false;
    for (const schedule of data.monitor_schedules) {
      if (schedule.schedule_id == null) {
        schedule.schedule_id = ++nextId;
        changed = true;
      }
    }
    if (changed) saveData();
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
    const alias = /\bCOUNT\s*\(\s*\*\s*\)\s+AS\s+`?([A-Za-z_]\w*)`?/i.exec(sql)?.[1];
    return [{ [alias || "count"]: rows.length }];
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

function filterAdminUsers(sql, params) {
  let users = [...(data.users || [])];
  let parameterIndex = 0;

  if (/\bu\.username\s+LIKE\s+\?/i.test(sql) && /\bu\.email\s+LIKE\s+\?/i.test(sql)) {
    const search = String(params[parameterIndex++] || "")
      .replace(/%/g, "")
      .toLowerCase();
    parameterIndex += 1;
    if (search) {
      users = users.filter((user) =>
        [user.username, user.email].some((value) =>
          String(value || "").toLowerCase().includes(search)
        )
      );
    }
  }

  if (/\bu\.role\s*=\s*\?/i.test(sql)) {
    const role = String(params[parameterIndex++] || "").toLowerCase();
    users = users.filter((user) => String(user.role || "").toLowerCase() === role);
  }

  const userIdMatch = /\bu\.user_id\s*=\s*\?/i.exec(sql);
  if (userIdMatch) {
    const userId = Number(params[parameterIndex]);
    users = users.filter((user) => Number(user.user_id) === userId);
  }

  return users;
}

function mapFallbackAdminUser(user) {
  const projects = (data.projects || []).filter(
    (project) => Number(project.user_id) === Number(user.user_id)
  );
  const projectIds = new Set(projects.map((project) => Number(project.project_id)));
  const canvasCount = (data.canvases || []).filter((canvas) =>
    projectIds.has(Number(canvas.project_id))
  ).length;

  return {
    user_id: user.user_id,
    username: user.username,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at,
    project_count: projects.length,
    canvas_count: canvasCount,
    knowledge_base_count: (data.knowledge_base || []).filter(
      (article) => Number(article.user_id) === Number(user.user_id)
    ).length,
  };
}

function fallbackDateTimeIso(value) {
  if (!value) return null;
  const normalized = String(value).replace(" ", "T");
  const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function fallbackScheduleOverlapQuery(sql, params) {
  if (!/^SELECT\s+schedule_id\s+FROM\s+monitor_schedules\b/i.test(sql) ||
      !/\bstatus\s+IN\s*\(\s*'scheduled'\s*,\s*'active'\s*\)/i.test(sql)) {
    return null;
  }

  const monitorId = Number(params[0]);
  const requestedEnd = Date.parse(fallbackDateTimeIso(params[1]) || "");
  const requestedStart = Date.parse(fallbackDateTimeIso(params[2]) || "");
  const excludedScheduleId = /\bschedule_id\s*<>\s*\?/i.test(sql)
    ? Number(params[3])
    : null;
  const overlaps = (data.monitor_schedules || []).filter((schedule) => {
    const start = Date.parse(fallbackDateTimeIso(schedule.start_at) || "");
    const end = Date.parse(fallbackDateTimeIso(schedule.end_at) || "");
    return Number(schedule.monitor_id) === monitorId &&
      ["scheduled", "active"].includes(schedule.status) &&
      Number(schedule.schedule_id) !== excludedScheduleId &&
      start < requestedEnd &&
      end > requestedStart;
  });

  return overlaps.slice(0, 1).map((schedule) => ({ schedule_id: schedule.schedule_id }));
}

function fallbackContentSchedulesQuery(sql, params) {
  if (!/^SELECT\s+ms\.schedule_id,\s*ms\.monitor_id,\s*ms\.project_id,\s*ms\.created_by/i.test(sql) ||
      !/\bFROM\s+monitor_schedules\s+ms\b/i.test(sql) ||
      !/\bJOIN\s+monitors\s+m\b/i.test(sql) ||
      !/\bJOIN\s+projects\s+p\b/i.test(sql)) {
    return null;
  }

  let parameterIndex = 0;
  let schedules = [...(data.monitor_schedules || [])];
  if (/\bms\.monitor_id\s*=\s*\?/i.test(sql)) {
    const monitorId = Number(params[parameterIndex++]);
    schedules = schedules.filter((schedule) => Number(schedule.monitor_id) === monitorId);
  }
  if (/\bm\.monitor_category\s*=\s*\?/i.test(sql)) {
    const category = String(params[parameterIndex++] || "");
    schedules = schedules.filter((schedule) =>
      (data.monitors || []).some((monitor) =>
        Number(monitor.monitor_id) === Number(schedule.monitor_id) &&
        monitor.monitor_category === category
      )
    );
  }
  if (/\bms\.status\s*=\s*\?/i.test(sql)) {
    const status = String(params[parameterIndex++] || "");
    schedules = schedules.filter((schedule) => schedule.status === status);
  }
  if (/DATE\s*\(\s*ms\.start_at\s*\)\s*=\s*\?/i.test(sql)) {
    const date = String(params[parameterIndex++] || "");
    schedules = schedules.filter((schedule) =>
      String(schedule.start_at || "").slice(0, 10) === date
    );
  }

  schedules.sort((left, right) =>
    String(right.start_at || "").localeCompare(String(left.start_at || "")) ||
    Number(right.schedule_id) - Number(left.schedule_id)
  );

  return schedules.flatMap((schedule) => {
    const monitor = (data.monitors || []).find(
      (item) => Number(item.monitor_id) === Number(schedule.monitor_id)
    );
    const project = (data.projects || []).find(
      (item) => Number(item.project_id) === Number(schedule.project_id)
    );
    const user = (data.users || []).find(
      (item) => Number(item.user_id) === Number(schedule.created_by)
    );
    if (!monitor || !project || !user) return [];

    return [{
      schedule_id: schedule.schedule_id,
      monitor_id: schedule.monitor_id,
      project_id: schedule.project_id,
      created_by: schedule.created_by,
      status: schedule.status,
      notes: schedule.notes,
      start_at_iso: fallbackDateTimeIso(schedule.start_at),
      end_at_iso: fallbackDateTimeIso(schedule.end_at),
      created_at_iso: fallbackDateTimeIso(schedule.created_at),
      monitor_name: monitor.monitor_name,
      monitor_category: monitor.monitor_category,
      location: monitor.location,
      project_name: project.name,
      created_by_username: user.username,
    }];
  });
}

function fallbackSchedulerMonitorsQuery(sql) {
  if (!/^SELECT\s+m\.monitor_id,\s*m\.monitor_name/i.test(sql) ||
      !/\bFROM\s+monitors\s+m\b/i.test(sql) ||
      !/\bmonitor_playlist_items\s+mpi\b/i.test(sql)) {
    return null;
  }

  const categoryOrder = ["environmental", "social", "governance"];
  return [...(data.monitors || [])]
    .sort((left, right) => {
      const categoryDifference =
        categoryOrder.indexOf(left.monitor_category) -
        categoryOrder.indexOf(right.monitor_category);
      return categoryDifference || Number(left.monitor_id) - Number(right.monitor_id);
    })
    .map((monitor) => {
      const activeItem = (data.monitor_playlist_items || [])
        .filter((item) =>
          Number(item.monitor_id) === Number(monitor.monitor_id) &&
          (item.is_active === true || Number(item.is_active) === 1)
        )
        .sort((left, right) =>
          Number(left.display_order) - Number(right.display_order) ||
          Number(left.playlist_item_id) - Number(right.playlist_item_id)
        )[0];
      const project = activeItem
        ? (data.projects || []).find(
            (item) => Number(item.project_id) === Number(activeItem.project_id)
          )
        : null;

      return {
        monitor_id: monitor.monitor_id,
        monitor_name: monitor.monitor_name,
        monitor_key: monitor.monitor_key,
        pairing_code: monitor.pairing_code,
        pairing_expires_at_iso: fallbackDateTimeIso(monitor.pairing_expires_at),
        monitor_category: monitor.monitor_category,
        location: monitor.location,
        status: monitor.status,
        is_paired: Boolean(monitor.is_paired),
        device_hostname: monitor.device_hostname,
        last_ip_address: monitor.last_ip_address,
        mac_address: monitor.mac_address,
        agent_version: monitor.agent_version,
        browser_status: monitor.browser_status,
        wake_on_wlan_enabled: Boolean(monitor.wake_on_wlan_enabled),
        last_wake_requested_at_iso: fallbackDateTimeIso(monitor.last_wake_requested_at),
        last_heartbeat_at_iso: fallbackDateTimeIso(monitor.last_heartbeat_at),
        last_connected_at_iso: fallbackDateTimeIso(monitor.last_connected_at),
        current_project_id: project?.project_id || null,
        current_project_name: project?.name || null,
      };
    });
}

function fallbackAdminUserQuery(sql, params) {
  if (/^SELECT\s+COUNT\s*\(\s*\*\s*\)\s+AS\s+total_users\s+FROM\s+users\s+u\b/i.test(sql)) {
    return [{ total_users: filterAdminUsers(sql, params).length }];
  }

  if (/^SELECT\s+COUNT\s*\(\s*\*\s*\)\s+AS\s+total\b/i.test(sql) &&
      /\bSUM\s*\(\s*role\s*=\s*'admin'\s*\)/i.test(sql)) {
    const users = data.users || [];
    const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return [{
      total: users.length,
      admins: users.filter((user) => user.role === "admin").length,
      producers: users.filter((user) => user.role === "producer").length,
      recent: users.filter((user) => {
        const createdAt = new Date(String(user.created_at || "").replace(" ", "T") + "Z");
        return !Number.isNaN(createdAt.getTime()) && createdAt.getTime() >= recentCutoff;
      }).length,
    }];
  }

  if (/^SELECT\s+u\.user_id,\s*u\.username,\s*u\.email,\s*u\.role/i.test(sql) &&
      /\bFROM\s+users\s+u\b/i.test(sql) &&
      /\bLEFT\s+JOIN\b/i.test(sql) &&
      /\bproject_stats\b/i.test(sql)) {
    const users = filterAdminUsers(sql, params);
    const order = /\bORDER\s+BY\s+u\.(username|created_at|updated_at)\s*(ASC|DESC)?/i.exec(sql);
    if (order) {
      const field = order[1].toLowerCase();
      const direction = /^DESC$/i.test(order[2] || "") ? -1 : 1;
      users.sort((left, right) => {
        const comparison = String(left[field] || "").localeCompare(String(right[field] || ""));
        return comparison === 0
          ? Number(right.user_id) - Number(left.user_id)
          : comparison * direction;
      });
    }

    const limitIndex = Math.max(0, params.length - 2);
    const limit = Number(params[limitIndex]) || 10;
    const offset = Number(params[limitIndex + 1]) || 0;
    return users.slice(offset, offset + limit).map(mapFallbackAdminUser);
  }

  if (/^SELECT\s+u\.user_id,\s*u\.username,\s*u\.email,\s*u\.role/i.test(sql) &&
      /\bFROM\s+users\s+u\b/i.test(sql) &&
      /\bWHERE\s+u\.user_id\s*=\s*\?/i.test(sql)) {
    return filterAdminUsers(sql, params).map(mapFallbackAdminUser).slice(0, 1);
  }

  return null;
}

async function query(sql, params = []) {
  loadData();
  const normalized = String(sql).trim();
  if (/^SELECT/i.test(normalized)) {
    const scheduleOverlap = fallbackScheduleOverlapQuery(normalized, params);
    if (scheduleOverlap) return [scheduleOverlap, []];
    const contentSchedules = fallbackContentSchedulesQuery(normalized, params);
    if (contentSchedules) return [contentSchedules, []];
    const schedulerMonitors = fallbackSchedulerMonitorsQuery(normalized);
    if (schedulerMonitors) return [schedulerMonitors, []];
    const adminUserRows = fallbackAdminUserQuery(normalized, params);
    if (adminUserRows) return [adminUserRows, []];
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
      if (table === "monitor_schedules") {
        const schedules = data.monitor_schedules;
        const maximumId = schedules.reduce(
          (maximum, schedule) => Math.max(maximum, Number(schedule.schedule_id) || 0),
          0
        );
        if (row.schedule_id == null) row.schedule_id = maximumId + 1;
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        row.created_at ||= now;
        row.updated_at ||= now;
      }
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
