const crypto = require("crypto");
const dgram = require("dgram");
const os = require("os");

const VALID_CATEGORIES = new Set(["environmental", "social", "governance"]);
const VALID_SCHEDULE_STATUSES = new Set([
  "scheduled",
  "active",
  "completed",
  "cancelled",
]);
const VALID_COMMANDS = new Set([
  "launch-display",
  "restart-browser",
  "reload-project",
  "sleep-pc",
]);

const COMMAND_DB_TYPES = {
  "launch-display": "launch_display",
  "restart-browser": "restart_browser",
  "reload-project": "reload_project",
  "sleep-pc": "sleep_pc",
};

const COMMAND_EVENT_NAMES = {
  acknowledged: "command-acknowledged",
  completed: "command-completed",
  failed: "command-failed",
};

const HEARTBEAT_TIMEOUT_MS = 90_000;
const COMMAND_TIMEOUT_MS = 20_000;
const WAKE_TIMEOUT_MS = 90_000;
const WAKE_RATE_LIMIT_MS = 15_000;
const SCHEDULER_INTERVAL_MS = 30_000;

function positiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanText(value, maximumLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maximumLength);
}

function normalizeCategory(value) {
  const category = cleanText(value, 30).toLowerCase();
  return VALID_CATEGORIES.has(category) ? category : null;
}

function hashDeviceToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function generatePairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () =>
    alphabet.charAt(crypto.randomInt(0, alphabet.length))
  ).join("");
}

function generateDeviceToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function toSqlUtc(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isoExpression(column, alias) {
  return `DATE_FORMAT(${column}, '%Y-%m-%dT%H:%i:%sZ') AS ${alias}`;
}

function safeIp(value) {
  const ip = cleanText(value, 45);
  return ip || null;
}

function safeMac(value) {
  const mac = cleanText(value, 17).toUpperCase();
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac) ? mac : null;
}

function deviceBearerToken(req) {
  const header = String(req.headers.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

function monitorRoom(monitorId) {
  return `monitor_${monitorId}`;
}

function ipv4ToInteger(address) {
  const parts = String(address || "").split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts.reduce((total, part) => ((total << 8) | part) >>> 0, 0);
}

function integerToIpv4(value) {
  return [24, 16, 8, 0]
    .map((shift) => (value >>> shift) & 255)
    .join(".");
}

function interfaceBroadcastAddresses() {
  const addresses = new Set(["255.255.255.255"]);
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.internal || entry.family !== "IPv4") continue;
      const address = ipv4ToInteger(entry.address);
      const netmask = ipv4ToInteger(entry.netmask);
      if (address === null || netmask === null) continue;
      addresses.add(integerToIpv4((address | (~netmask >>> 0)) >>> 0));
    }
  }
  return [...addresses];
}

function buildMagicPacket(macAddress) {
  const normalized = safeMac(macAddress);
  if (!normalized) return null;
  const macBytes = Buffer.from(normalized.replaceAll(":", ""), "hex");
  return Buffer.concat([Buffer.alloc(6, 0xff), ...Array.from({ length: 16 }, () => macBytes)]);
}

async function sendWakeMagicPacket(macAddress) {
  const packet = buildMagicPacket(macAddress);
  if (!packet) {
    const error = new Error("The display does not have a valid Wi-Fi MAC address.");
    error.statusCode = 409;
    throw error;
  }

  const destinations = interfaceBroadcastAddresses();
  await new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    let settled = false;
    let pending = destinations.length;
    let successfulSends = 0;
    let lastError = null;

    const finish = (error) => {
      if (settled) return;
      if (error) lastError = error;
      else successfulSends += 1;
      pending -= 1;
      if (pending > 0) return;
      settled = true;
      socket.close();
      if (successfulSends > 0) resolve();
      else reject(lastError || new Error("Unable to send the Wake-on-WLAN packet."));
    };

    socket.once("error", (error) => {
      if (settled) return;
      settled = true;
      socket.close();
      reject(error);
    });

    socket.bind(() => {
      try {
        socket.setBroadcast(true);
        for (const destination of destinations) {
          socket.send(packet, 0, packet.length, 9, destination, finish);
        }
      } catch (error) {
        if (!settled) {
          settled = true;
          socket.close();
          reject(error);
        }
      }
    });
  });
}

function registerSchedulerDisplayFeatures({ app, io, db, requireAdmin }) {
  const agentSocketByMonitor = new Map();
  const commandTimeoutByRequest = new Map();
  const wakeTimeoutByRequest = new Map();
  const lastWakeRequestedByMonitor = new Map();

  async function verifyDevice(monitorId, rawToken) {
    const id = positiveInteger(monitorId);
    if (!id || !rawToken) return null;

    const [rows] = await db.query(
      `SELECT monitor_id, monitor_name, monitor_category, pairing_code,
              is_paired, device_token_hash
       FROM monitors
       WHERE monitor_id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0 || !rows[0].is_paired || !rows[0].device_token_hash) {
      return null;
    }

    const candidateHash = hashDeviceToken(rawToken);
    const storedHash = String(rows[0].device_token_hash);
    const candidateBuffer = Buffer.from(candidateHash, "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");

    if (
      candidateBuffer.length !== storedBuffer.length ||
      !crypto.timingSafeEqual(candidateBuffer, storedBuffer)
    ) {
      return null;
    }

    return rows[0];
  }

  function emitCommandStatus(monitorId, payload) {
    io.emit("command-status-updated", {
      monitorId,
      ...payload,
    });
  }

  async function updateCommand(requestId, monitorId, status, message) {
    const statusColumns = {
      acknowledged: "acknowledged_at = UTC_TIMESTAMP()",
      completed: "completed_at = UTC_TIMESTAMP()",
      failed: "completed_at = UTC_TIMESTAMP()",
      timed_out: "completed_at = UTC_TIMESTAMP()",
    };

    const extra = statusColumns[status] ? `, ${statusColumns[status]}` : "";
    await db.query(
      `UPDATE monitor_commands
       SET status = ?, message = ?${extra}
       WHERE request_id = ? AND monitor_id = ?`,
      [status, cleanText(message, 500) || null, requestId, monitorId]
    );

    emitCommandStatus(monitorId, {
      requestId,
      status,
      message: cleanText(message, 500),
    });
  }

  function clearCommandTimeout(requestId) {
    const timeout = commandTimeoutByRequest.get(requestId);
    if (timeout) clearTimeout(timeout);
    commandTimeoutByRequest.delete(requestId);
  }

  async function issueAgentCommand({ monitorId, command, requestedBy }) {
    if (!VALID_COMMANDS.has(command)) {
      const error = new Error("Unsupported display command.");
      error.statusCode = 400;
      throw error;
    }

    const [monitorRows] = await db.query(
      `SELECT monitor_id, monitor_name, status, is_paired,
              ${isoExpression("last_heartbeat_at", "last_heartbeat_at_iso")}
       FROM monitors
       WHERE monitor_id = ?
       LIMIT 1`,
      [monitorId]
    );

    if (monitorRows.length === 0) {
      const error = new Error("Display not found.");
      error.statusCode = 404;
      throw error;
    }

    const monitor = monitorRows[0];
    const socketId = agentSocketByMonitor.get(monitorId);
    const agentSocket = socketId ? io.sockets.sockets.get(socketId) : null;

    if (!monitor.is_paired || !agentSocket?.connected) {
      const error = new Error(
        "The display PC is offline or has not been paired with the Display Agent."
      );
      error.statusCode = 409;
      throw error;
    }

    const requestId = crypto.randomUUID();
    const [result] = await db.query(
      `INSERT INTO monitor_commands
       (monitor_id, requested_by, command_type, request_id, status, message)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [
        monitorId,
        requestedBy,
        COMMAND_DB_TYPES[command],
        requestId,
        "Command queued.",
      ]
    );

    const commandPayload = {
      requestId,
      monitorId,
      command,
      issuedAt: new Date().toISOString(),
    };

    agentSocket.emit("display-command", commandPayload);
    await updateCommand(requestId, monitorId, "sent", "Command sent to display PC.");

    const timeout = setTimeout(async () => {
      try {
        const [rows] = await db.query(
          `SELECT status FROM monitor_commands WHERE request_id = ? LIMIT 1`,
          [requestId]
        );
        if (
          rows.length > 0 &&
          ["pending", "sent", "acknowledged"].includes(rows[0].status)
        ) {
          await updateCommand(
            requestId,
            monitorId,
            "timed_out",
            "The display PC did not complete the command in time."
          );
        }
      } catch (error) {
        console.error("Command timeout update failed:", error);
      } finally {
        commandTimeoutByRequest.delete(requestId);
      }
    }, COMMAND_TIMEOUT_MS);

    commandTimeoutByRequest.set(requestId, timeout);

    return {
      commandId: result.insertId,
      requestId,
      monitorId,
      command,
      status: "sent",
    };
  }

  async function completePendingWake(monitorId) {
    const [rows] = await db.query(
      `SELECT request_id
       FROM monitor_commands
       WHERE monitor_id = ?
         AND command_type = 'wake_pc'
         AND status = 'waiting_for_reconnect'
       ORDER BY command_id DESC
       LIMIT 1`,
      [monitorId]
    );

    if (rows.length === 0) return false;
    const requestId = rows[0].request_id;
    const timeout = wakeTimeoutByRequest.get(requestId);
    if (timeout) clearTimeout(timeout);
    wakeTimeoutByRequest.delete(requestId);
    await db.query(
      `UPDATE monitors SET wake_on_wlan_enabled = TRUE WHERE monitor_id = ?`,
      [monitorId]
    );
    await updateCommand(
      requestId,
      monitorId,
      "completed",
      "Display PC heartbeat resumed. Wake-on-WLAN was confirmed."
    );

    return true;
  }

  io.on("connection", (socket) => {
    socket.on("agent-register", async (payload = {}) => {
      try {
        const monitor = await verifyDevice(payload.monitorId, payload.deviceToken);

        if (!monitor) {
          socket.emit("agent-authentication-failed", {
            message: "Invalid display identity or device token.",
          });
          return;
        }

        socket.isDisplayAgent = true;
        socket.agentMonitorId = monitor.monitor_id;
        socket.join(monitorRoom(monitor.monitor_id));
        agentSocketByMonitor.set(monitor.monitor_id, socket.id);

        await db.query(
          `UPDATE monitors
           SET status = 'online',
               last_connected_at = UTC_TIMESTAMP(),
               last_heartbeat_at = UTC_TIMESTAMP(),
               device_hostname = ?,
               last_ip_address = ?,
               mac_address = COALESCE(?, mac_address),
               agent_version = ?,
               browser_status = ?
           WHERE monitor_id = ?`,
          [
            cleanText(payload.hostname, 255) || null,
            safeIp(payload.ipAddress),
            safeMac(payload.macAddress),
            cleanText(payload.agentVersion, 50) || null,
            cleanText(payload.browserStatus, 30) || "stopped",
            monitor.monitor_id,
          ]
        );

        const wakeScreenAfterReconnect = await completePendingWake(monitor.monitor_id);

        io.emit("monitor-status-updated", {
          monitorId: monitor.monitor_id,
          status: "online",
          lastHeartbeatAt: new Date().toISOString(),
        });

        socket.emit("agent-authenticated", {
          monitorId: monitor.monitor_id,
          monitorName: monitor.monitor_name,
          category: monitor.monitor_category,
          displayPath: `/display/${monitor.pairing_code}`,
          heartbeatIntervalMs: 20_000,
          wakeScreenAfterReconnect: Boolean(wakeScreenAfterReconnect),
        });
      } catch (error) {
        console.error("Display Agent registration error:", error);
        socket.emit("agent-authentication-failed", {
          message: "Unable to authenticate the Display Agent.",
        });
      }
    });

    socket.on("agent-heartbeat", async (payload = {}) => {
      if (!socket.isDisplayAgent || !socket.agentMonitorId) return;

      try {
        await db.query(
          `UPDATE monitors
           SET status = 'online',
               last_connected_at = UTC_TIMESTAMP(),
               last_heartbeat_at = UTC_TIMESTAMP(),
               device_hostname = COALESCE(?, device_hostname),
               last_ip_address = COALESCE(?, last_ip_address),
               mac_address = COALESCE(?, mac_address),
               agent_version = COALESCE(?, agent_version),
               browser_status = COALESCE(?, browser_status)
           WHERE monitor_id = ?`,
          [
            cleanText(payload.hostname, 255) || null,
            safeIp(payload.ipAddress),
            safeMac(payload.macAddress),
            cleanText(payload.agentVersion, 50) || null,
            cleanText(payload.browserStatus, 30) || null,
            socket.agentMonitorId,
          ]
        );

        const wakeScreenAfterHeartbeat = await completePendingWake(socket.agentMonitorId);
        if (wakeScreenAfterHeartbeat) {
          socket.emit("wake-screen-requested", { reason: "wake heartbeat resumed" });
        }

        io.emit("monitor-status-updated", {
          monitorId: socket.agentMonitorId,
          status: "online",
          browserStatus: cleanText(payload.browserStatus, 30),
          lastHeartbeatAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Agent heartbeat error:", error);
      }
    });

    Object.entries(COMMAND_EVENT_NAMES).forEach(([status, eventName]) => {
      socket.on(eventName, async (payload = {}) => {
        if (!socket.isDisplayAgent || !socket.agentMonitorId) return;
        const requestId = cleanText(payload.requestId, 100);
        if (!requestId) return;

        try {
          await updateCommand(
            requestId,
            socket.agentMonitorId,
            status,
            payload.message || `Command ${status}.`
          );

          if (status === "completed") {
            const [commandRows] = await db.query(
              `SELECT command_type FROM monitor_commands
               WHERE request_id = ? AND monitor_id = ? LIMIT 1`,
              [requestId, socket.agentMonitorId]
            );
            if (commandRows[0]?.command_type === "sleep_pc") {
              await db.query(
                `UPDATE monitors SET status = 'offline' WHERE monitor_id = ?`,
                [socket.agentMonitorId]
              );
              io.emit("monitor-status-updated", {
                monitorId: socket.agentMonitorId,
                status: "offline",
              });
            }
          }

          if (["completed", "failed"].includes(status)) {
            clearCommandTimeout(requestId);
          }
        } catch (error) {
          console.error(`Unable to record ${eventName}:`, error);
        }
      });
    });

    socket.on("disconnect", () => {
      if (socket.agentMonitorId) {
        const storedSocketId = agentSocketByMonitor.get(socket.agentMonitorId);
        if (storedSocketId === socket.id) {
          agentSocketByMonitor.delete(socket.agentMonitorId);
        }
      }
    });
  });

  app.post("/api/display-agent/pair", async (req, res) => {
    try {
      const pairingCode = cleanText(req.body.pairingCode, 50).toUpperCase();
      const requestedMonitorId = positiveInteger(req.body.monitorId);

      if (!pairingCode) {
        return res.status(400).json({
          success: false,
          message: "A pairing code is required.",
        });
      }

      const parameters = [pairingCode];
      let monitorIdClause = "";
      if (requestedMonitorId) {
        monitorIdClause = " AND monitor_id = ?";
        parameters.push(requestedMonitorId);
      }

      const [rows] = await db.query(
        `SELECT monitor_id, monitor_name, monitor_category, pairing_code,
                pairing_expires_at, is_paired
         FROM monitors
         WHERE UPPER(pairing_code) = ?${monitorIdClause}
         LIMIT 1`,
        parameters
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "The pairing code is invalid.",
        });
      }

      const monitor = rows[0];

      if (monitor.is_paired) {
        return res.status(409).json({
          success: false,
          message:
            "This display is already paired. Reset pairing from the Scheduler before pairing another PC.",
        });
      }

      if (
        monitor.pairing_expires_at &&
        new Date(monitor.pairing_expires_at).getTime() < Date.now()
      ) {
        return res.status(410).json({
          success: false,
          message: "The pairing code has expired. Generate a new code from the Scheduler.",
        });
      }

      const deviceToken = generateDeviceToken();
      await db.query(
        `UPDATE monitors
         SET is_paired = TRUE,
             paired_at = UTC_TIMESTAMP(),
             device_token_hash = ?,
             device_hostname = ?,
             last_ip_address = ?,
             mac_address = ?,
             agent_version = ?,
             browser_status = 'stopped',
             status = 'offline'
         WHERE monitor_id = ? AND is_paired = FALSE`,
        [
          hashDeviceToken(deviceToken),
          cleanText(req.body.hostname, 255) || null,
          safeIp(req.body.ipAddress),
          safeMac(req.body.macAddress),
          cleanText(req.body.agentVersion, 50) || null,
          monitor.monitor_id,
        ]
      );

      return res.status(201).json({
        success: true,
        message: "Display PC paired successfully.",
        device: {
          monitorId: monitor.monitor_id,
          monitorName: monitor.monitor_name,
          category: monitor.monitor_category,
          deviceToken,
          displayPath: `/display/${monitor.pairing_code}`,
        },
      });
    } catch (error) {
      console.error("Pair display agent error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to pair the display PC.",
      });
    }
  });

  app.post("/api/display-agent/authenticate", async (req, res) => {
    try {
      const monitor = await verifyDevice(req.body.monitorId, req.body.deviceToken);
      if (!monitor) {
        return res.status(401).json({
          success: false,
          message: "Invalid display identity or device token.",
        });
      }

      return res.json({
        success: true,
        device: {
          monitorId: monitor.monitor_id,
          monitorName: monitor.monitor_name,
          category: monitor.monitor_category,
          displayPath: `/display/${monitor.pairing_code}`,
        },
      });
    } catch (error) {
      console.error("Display agent authentication error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to authenticate the display PC.",
      });
    }
  });

  app.get("/api/display-agent/current-assignment", async (req, res) => {
    try {
      const monitorId = positiveInteger(req.headers["x-monitor-id"] || req.query.monitorId);
      const monitor = await verifyDevice(monitorId, deviceBearerToken(req));

      if (!monitor) {
        return res.status(401).json({
          success: false,
          message: "Invalid display identity or device token.",
        });
      }

      const [projects] = await db.query(
        `SELECT p.project_id, p.name, p.category
         FROM monitor_playlist_items mpi
         JOIN projects p ON p.project_id = mpi.project_id
         WHERE mpi.monitor_id = ?
           AND mpi.is_active = TRUE
           AND p.status = 'published'
         ORDER BY mpi.display_order ASC
         LIMIT 1`,
        [monitorId]
      );

      return res.json({
        success: true,
        monitor: {
          monitorId: monitor.monitor_id,
          monitorName: monitor.monitor_name,
          displayPath: `/display/${monitor.pairing_code}`,
        },
        project: projects[0] || null,
      });
    } catch (error) {
      console.error("Current assignment error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load the current display assignment.",
      });
    }
  });

  app.get("/api/admin/scheduler/summary", requireAdmin, async (req, res) => {
    try {
      const [[monitorStats], [scheduleStats]] = await Promise.all([
        db.query(
          `SELECT COUNT(*) AS total_displays,
                  SUM(status = 'online') AS online_displays,
                  SUM(status <> 'online') AS offline_displays
           FROM monitors`
        ),
        db.query(
          `SELECT SUM(DATE(start_at) = UTC_DATE() AND status <> 'cancelled') AS scheduled_today,
                  SUM(status = 'active') AS currently_active
           FROM monitor_schedules`
        ),
      ]);

      return res.json({
        success: true,
        summary: {
          totalDisplays: Number(monitorStats[0]?.total_displays || 0),
          onlineDisplays: Number(monitorStats[0]?.online_displays || 0),
          offlineDisplays: Number(monitorStats[0]?.offline_displays || 0),
          scheduledToday: Number(scheduleStats[0]?.scheduled_today || 0),
          currentlyActive: Number(scheduleStats[0]?.currently_active || 0),
        },
      });
    } catch (error) {
      console.error("Scheduler summary error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load the scheduler summary.",
      });
    }
  });

  app.get("/api/admin/scheduler/monitors", requireAdmin, async (req, res) => {
    try {
      const [monitors] = await db.query(
        `SELECT m.monitor_id, m.monitor_name, m.monitor_key, m.pairing_code,
                ${isoExpression("m.pairing_expires_at", "pairing_expires_at_iso")},
                m.monitor_category, m.location, m.status, m.is_paired,
                m.device_hostname, m.last_ip_address, m.mac_address,
                m.agent_version, m.browser_status, m.wake_on_wlan_enabled,
                ${isoExpression("m.last_wake_requested_at", "last_wake_requested_at_iso")},
                ${isoExpression("m.last_heartbeat_at", "last_heartbeat_at_iso")},
                ${isoExpression("m.last_connected_at", "last_connected_at_iso")},
                p.project_id AS current_project_id,
                p.name AS current_project_name
         FROM monitors m
         LEFT JOIN monitor_playlist_items mpi
           ON mpi.playlist_item_id = (
             SELECT mpi2.playlist_item_id
             FROM monitor_playlist_items mpi2
             WHERE mpi2.monitor_id = m.monitor_id AND mpi2.is_active = TRUE
             ORDER BY mpi2.display_order ASC, mpi2.playlist_item_id ASC
             LIMIT 1
           )
         LEFT JOIN projects p ON p.project_id = mpi.project_id
         ORDER BY FIELD(m.monitor_category, 'environmental', 'social', 'governance'),
                  m.monitor_id ASC`
      );

      const [scheduleRows, commandRows] = await Promise.all([
        db.query(
          `SELECT ms.schedule_id, ms.monitor_id, ms.project_id, ms.status,
                  ${isoExpression("ms.start_at", "start_at_iso")},
                  ${isoExpression("ms.end_at", "end_at_iso")},
                  p.name AS project_name
           FROM monitor_schedules ms
           JOIN projects p ON p.project_id = ms.project_id
           WHERE ms.status IN ('scheduled', 'active')
           ORDER BY ms.monitor_id, ms.start_at ASC`
        ),
        db.query(
          `SELECT mc.command_id, mc.monitor_id, mc.request_id, mc.command_type,
                  mc.status, mc.message,
                  ${isoExpression("mc.created_at", "created_at_iso")}
           FROM monitor_commands mc
           JOIN (
             SELECT monitor_id, MAX(command_id) AS latest_command_id
             FROM monitor_commands
             GROUP BY monitor_id
           ) latest ON latest.latest_command_id = mc.command_id`
        ),
      ]);

      const schedulesByMonitor = new Map();
      for (const schedule of scheduleRows[0]) {
        const list = schedulesByMonitor.get(schedule.monitor_id) || [];
        list.push(schedule);
        schedulesByMonitor.set(schedule.monitor_id, list);
      }

      const commandsByMonitor = new Map(
        commandRows[0].map((command) => [command.monitor_id, command])
      );

      return res.json({
        success: true,
        monitors: monitors.map((monitor) => {
          const schedules = schedulesByMonitor.get(monitor.monitor_id) || [];
          return {
            ...monitor,
            is_paired: Boolean(monitor.is_paired),
            active_schedule:
              schedules.find((schedule) => schedule.status === "active") || null,
            next_schedule:
              schedules.find((schedule) => schedule.status === "scheduled") || null,
            latest_command: commandsByMonitor.get(monitor.monitor_id) || null,
          };
        }),
      });
    } catch (error) {
      console.error("Scheduler monitors error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load display PCs.",
      });
    }
  });

  app.get("/api/admin/schedules", requireAdmin, async (req, res) => {
    try {
      const conditions = [];
      const parameters = [];

      const monitorId = positiveInteger(req.query.monitorId);
      const category = normalizeCategory(req.query.category);
      const status = cleanText(req.query.status, 20).toLowerCase();
      const date = cleanText(req.query.date, 10);

      if (monitorId) {
        conditions.push("ms.monitor_id = ?");
        parameters.push(monitorId);
      }
      if (category) {
        conditions.push("m.monitor_category = ?");
        parameters.push(category);
      }
      if (status && VALID_SCHEDULE_STATUSES.has(status)) {
        conditions.push("ms.status = ?");
        parameters.push(status);
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        conditions.push("DATE(ms.start_at) = ?");
        parameters.push(date);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const [rows] = await db.query(
        `SELECT ms.schedule_id, ms.monitor_id, ms.project_id, ms.created_by,
                ms.status, ms.notes,
                ${isoExpression("ms.start_at", "start_at_iso")},
                ${isoExpression("ms.end_at", "end_at_iso")},
                ${isoExpression("ms.created_at", "created_at_iso")},
                m.monitor_name, m.monitor_category, m.location,
                p.name AS project_name,
                u.username AS created_by_username
         FROM monitor_schedules ms
         JOIN monitors m ON m.monitor_id = ms.monitor_id
         JOIN projects p ON p.project_id = ms.project_id
         JOIN users u ON u.user_id = ms.created_by
         ${whereClause}
         ORDER BY ms.start_at DESC, ms.schedule_id DESC`,
        parameters
      );

      return res.json({ success: true, schedules: rows });
    } catch (error) {
      console.error("Get schedules error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load schedules.",
      });
    }
  });

  async function validateScheduleInput(connection, body, excludedScheduleId = null) {
    const monitorId = positiveInteger(body.monitorId);
    const projectId = positiveInteger(body.projectId);
    const startAt = toSqlUtc(body.startAt);
    const endAt = toSqlUtc(body.endAt);
    const notes = cleanText(body.notes, 500) || null;

    if (!monitorId || !projectId || !startAt || !endAt) {
      const error = new Error("Display, project, start time and end time are required.");
      error.statusCode = 400;
      throw error;
    }

    if (new Date(body.endAt).getTime() <= new Date(body.startAt).getTime()) {
      const error = new Error("The end time must be after the start time.");
      error.statusCode = 400;
      throw error;
    }

    const [monitorRows] = await connection.query(
      `SELECT monitor_id, monitor_category FROM monitors WHERE monitor_id = ? LIMIT 1`,
      [monitorId]
    );
    if (monitorRows.length === 0) {
      const error = new Error("Display not found.");
      error.statusCode = 404;
      throw error;
    }

    const [projectRows] = await connection.query(
      `SELECT project_id, category, status, is_template
       FROM projects WHERE project_id = ? LIMIT 1`,
      [projectId]
    );
    if (projectRows.length === 0) {
      const error = new Error("Project not found.");
      error.statusCode = 404;
      throw error;
    }

    const project = projectRows[0];
    if (project.status !== "published" || project.is_template) {
      const error = new Error("Only published, non-template projects can be scheduled.");
      error.statusCode = 400;
      throw error;
    }
    if (project.category !== monitorRows[0].monitor_category) {
      const error = new Error("The project category must match the display category.");
      error.statusCode = 409;
      throw error;
    }

    const overlapParameters = [monitorId, endAt, startAt];
    let excludedClause = "";
    if (excludedScheduleId) {
      excludedClause = " AND schedule_id <> ?";
      overlapParameters.push(excludedScheduleId);
    }

    const [overlapRows] = await connection.query(
      `SELECT schedule_id
       FROM monitor_schedules
       WHERE monitor_id = ?
         AND status IN ('scheduled', 'active')
         AND start_at < ?
         AND end_at > ?${excludedClause}
       LIMIT 1`,
      overlapParameters
    );
    if (overlapRows.length > 0) {
      const error = new Error("This display already has an overlapping schedule.");
      error.statusCode = 409;
      throw error;
    }

    return { monitorId, projectId, startAt, endAt, notes };
  }

  app.post("/api/admin/schedules", requireAdmin, async (req, res) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const input = await validateScheduleInput(connection, req.body);

      const [result] = await connection.query(
        `INSERT INTO monitor_schedules
         (monitor_id, project_id, created_by, start_at, end_at, status, notes)
         VALUES (?, ?, ?, ?, ?, 'scheduled', ?)`,
        [
          input.monitorId,
          input.projectId,
          req.session.user.user_id,
          input.startAt,
          input.endAt,
          input.notes,
        ]
      );
      await connection.commit();

      io.emit("scheduler-data-updated", {
        monitorId: input.monitorId,
        scheduleId: result.insertId,
      });

      return res.status(201).json({
        success: true,
        message: "Schedule created successfully.",
        scheduleId: result.insertId,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Create schedule error:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : "Unable to create the schedule.",
      });
    } finally {
      connection.release();
    }
  });

  app.put("/api/admin/schedules/:scheduleId", requireAdmin, async (req, res) => {
    const scheduleId = positiveInteger(req.params.scheduleId);
    if (!scheduleId) {
      return res.status(400).json({ success: false, message: "Invalid schedule ID." });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [existingRows] = await connection.query(
        `SELECT schedule_id, status FROM monitor_schedules
         WHERE schedule_id = ? LIMIT 1 FOR UPDATE`,
        [scheduleId]
      );
      if (existingRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: "Schedule not found." });
      }
      if (existingRows[0].status !== "scheduled") {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: "Only upcoming schedules can be edited.",
        });
      }

      const input = await validateScheduleInput(connection, req.body, scheduleId);
      await connection.query(
        `UPDATE monitor_schedules
         SET monitor_id = ?, project_id = ?, start_at = ?, end_at = ?, notes = ?
         WHERE schedule_id = ?`,
        [
          input.monitorId,
          input.projectId,
          input.startAt,
          input.endAt,
          input.notes,
          scheduleId,
        ]
      );
      await connection.commit();
      io.emit("scheduler-data-updated", { monitorId: input.monitorId, scheduleId });

      return res.json({ success: true, message: "Schedule updated successfully." });
    } catch (error) {
      await connection.rollback();
      console.error("Update schedule error:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : "Unable to update the schedule.",
      });
    } finally {
      connection.release();
    }
  });

  app.post(
    "/api/admin/schedules/:scheduleId/cancel",
    requireAdmin,
    async (req, res) => {
      const scheduleId = positiveInteger(req.params.scheduleId);
      if (!scheduleId) {
        return res.status(400).json({ success: false, message: "Invalid schedule ID." });
      }

      try {
        const [result] = await db.query(
          `UPDATE monitor_schedules
           SET status = 'cancelled'
           WHERE schedule_id = ? AND status = 'scheduled'`,
          [scheduleId]
        );
        if (result.affectedRows === 0) {
          return res.status(409).json({
            success: false,
            message: "Only an upcoming schedule can be cancelled.",
          });
        }
        io.emit("scheduler-data-updated", { scheduleId });
        return res.json({ success: true, message: "Schedule cancelled." });
      } catch (error) {
        console.error("Cancel schedule error:", error);
        return res.status(500).json({ success: false, message: "Unable to cancel the schedule." });
      }
    }
  );

  app.delete("/api/admin/schedules/:scheduleId", requireAdmin, async (req, res) => {
    const scheduleId = positiveInteger(req.params.scheduleId);
    if (!scheduleId) {
      return res.status(400).json({ success: false, message: "Invalid schedule ID." });
    }

    try {
      const [result] = await db.query(
        `DELETE FROM monitor_schedules
         WHERE schedule_id = ? AND status IN ('scheduled', 'cancelled', 'completed')`,
        [scheduleId]
      );
      if (result.affectedRows === 0) {
        return res.status(409).json({
          success: false,
          message: "An active schedule cannot be deleted.",
        });
      }
      io.emit("scheduler-data-updated", { scheduleId });
      return res.json({ success: true, message: "Schedule deleted." });
    } catch (error) {
      console.error("Delete schedule error:", error);
      return res.status(500).json({ success: false, message: "Unable to delete the schedule." });
    }
  });

  async function setMonitorProject(connection, monitorId, projectId) {
    await connection.query(
      `DELETE FROM monitor_playlist_items WHERE monitor_id = ?`,
      [monitorId]
    );
    await connection.query(
      `INSERT INTO monitor_playlist_items
       (monitor_id, project_id, display_order, project_loop_count,
        slide_duration_seconds, is_active)
       VALUES (?, ?, 1, 1, 10, TRUE)`,
      [monitorId, projectId]
    );
  }

  async function validateMonitorProject(connection, monitorId, projectId) {
    const [rows] = await connection.query(
      `SELECT m.monitor_id, m.monitor_category,
              p.project_id, p.category, p.status, p.is_template
       FROM monitors m
       JOIN projects p ON p.project_id = ?
       WHERE m.monitor_id = ?
       LIMIT 1`,
      [projectId, monitorId]
    );
    if (rows.length === 0) {
      const error = new Error("Display or project not found.");
      error.statusCode = 404;
      throw error;
    }
    const row = rows[0];
    if (row.status !== "published" || row.is_template) {
      const error = new Error("Only published, non-template projects can be displayed.");
      error.statusCode = 400;
      throw error;
    }
    if (row.monitor_category !== row.category) {
      const error = new Error("The project category must match the display category.");
      error.statusCode = 409;
      throw error;
    }
  }

  app.post("/api/admin/monitors/:monitorId/push", requireAdmin, async (req, res) => {
    const monitorId = positiveInteger(req.params.monitorId);
    const projectId = positiveInteger(req.body.projectId);
    if (!monitorId || !projectId) {
      return res.status(400).json({
        success: false,
        message: "A valid display and project are required.",
      });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await validateMonitorProject(connection, monitorId, projectId);
      await setMonitorProject(connection, monitorId, projectId);
      await connection.commit();

      io.to(monitorRoom(monitorId)).emit("project-updated", {
        monitorId,
        projectId,
        updatedAt: new Date().toISOString(),
      });
      io.to(monitorRoom(monitorId)).emit("playlist-updated", {
        monitorId,
        updatedAt: new Date().toISOString(),
      });

      let command = null;
      try {
        command = await issueAgentCommand({
          monitorId,
          command: "reload-project",
          requestedBy: req.session.user.user_id,
        });
      } catch (commandError) {
        if (commandError.statusCode !== 409) throw commandError;
      }

      io.emit("scheduler-data-updated", { monitorId, projectId });
      return res.json({
        success: true,
        message: command
          ? "Project assigned and reload command sent."
          : "Project assigned. It will load when the display PC reconnects.",
        command,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Immediate push error:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : "Unable to push the project.",
      });
    } finally {
      connection.release();
    }
  });

  for (const [route, command] of [
    ["launch", "launch-display"],
    ["restart-browser", "restart-browser"],
    ["sleep", "sleep-pc"],
  ]) {
    app.post(
      `/api/admin/monitors/:monitorId/${route}`,
      requireAdmin,
      async (req, res) => {
        const monitorId = positiveInteger(req.params.monitorId);
        if (!monitorId) {
          return res.status(400).json({ success: false, message: "Invalid display ID." });
        }

        try {
          const result = await issueAgentCommand({
            monitorId,
            command,
            requestedBy: req.session.user.user_id,
          });
          return res.status(202).json({
            success: true,
            message: "Command sent to the display PC.",
            command: result,
          });
        } catch (error) {
          console.error(`Issue ${command} error:`, error);
          return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : "Unable to send the command.",
          });
        }
      }
    );
  }

  app.post(
    "/api/admin/monitors/:monitorId/wake",
    requireAdmin,
    async (req, res) => {
      const monitorId = positiveInteger(req.params.monitorId);
      if (!monitorId) {
        return res.status(400).json({ success: false, message: "Invalid display ID." });
      }

      try {
        const [rows] = await db.query(
          `SELECT monitor_id, monitor_name, status, is_paired, mac_address,
                  last_wake_requested_at
           FROM monitors
           WHERE monitor_id = ?
           LIMIT 1`,
          [monitorId]
        );

        if (rows.length === 0) {
          return res.status(404).json({ success: false, message: "Display not found." });
        }

        const monitor = rows[0];
        if (monitor.status === "online") {
          return res.status(409).json({
            success: false,
            message: "The display PC is already online.",
          });
        }
        if (!monitor.is_paired) {
          return res.status(409).json({
            success: false,
            message: "Pair the display PC before testing Wake-on-WLAN.",
          });
        }

        const macAddress = safeMac(monitor.mac_address);
        if (!macAddress) {
          return res.status(409).json({
            success: false,
            message: "The display does not have a valid stored Wi-Fi MAC address.",
          });
        }

        const previousRequest = Math.max(
          Number(lastWakeRequestedByMonitor.get(monitorId) || 0),
          monitor.last_wake_requested_at
            ? new Date(monitor.last_wake_requested_at).getTime()
            : 0
        );
        if (Date.now() - previousRequest < WAKE_RATE_LIMIT_MS) {
          return res.status(429).json({
            success: false,
            message: "Please wait before sending another Wake-on-WLAN request.",
          });
        }

        const requestId = crypto.randomUUID();
        const [result] = await db.query(
          `INSERT INTO monitor_commands
           (monitor_id, requested_by, command_type, request_id, status, message)
           VALUES (?, ?, 'wake_pc', ?, 'pending', ?)`,
          [
            monitorId,
            req.session.user.user_id,
            requestId,
            "Preparing Wake-on-WLAN packet.",
          ]
        );

        try {
          await sendWakeMagicPacket(macAddress);
        } catch (sendError) {
          await updateCommand(
            requestId,
            monitorId,
            "failed",
            sendError.message || "Unable to send the Wake-on-WLAN packet."
          );
          throw sendError;
        }

        lastWakeRequestedByMonitor.set(monitorId, Date.now());
        await db.query(
          `UPDATE monitors SET last_wake_requested_at = UTC_TIMESTAMP() WHERE monitor_id = ?`,
          [monitorId]
        );
        await updateCommand(
          requestId,
          monitorId,
          "waiting_for_reconnect",
          "Wake packet sent. Waiting for the display PC heartbeat."
        );

        const timeout = setTimeout(async () => {
          try {
            const [commandRows] = await db.query(
              `SELECT status FROM monitor_commands WHERE request_id = ? LIMIT 1`,
              [requestId]
            );
            if (commandRows[0]?.status === "waiting_for_reconnect") {
              await updateCommand(
                requestId,
                monitorId,
                "timed_out",
                "Wake-on-WLAN was not confirmed because no heartbeat resumed within 90 seconds."
              );
            }
          } catch (error) {
            console.error("Wake timeout update failed:", error);
          } finally {
            wakeTimeoutByRequest.delete(requestId);
          }
        }, WAKE_TIMEOUT_MS);
        timeout.unref?.();
        wakeTimeoutByRequest.set(requestId, timeout);

        return res.status(202).json({
          success: true,
          status: "waiting_for_reconnect",
          message: "Wake packet sent. Waiting for the display PC heartbeat.",
          command: {
            commandId: result.insertId,
            requestId,
            monitorId,
            command: "wake-pc",
            status: "waiting_for_reconnect",
          },
        });
      } catch (error) {
        console.error("Wake display error:", error);
        return res.status(error.statusCode || 500).json({
          success: false,
          message: error.statusCode
            ? error.message
            : "Unable to send the Wake-on-WLAN request.",
        });
      }
    }
  );

  app.post(
    "/api/admin/monitors/:monitorId/reset-pairing",
    requireAdmin,
    async (req, res) => {
      const monitorId = positiveInteger(req.params.monitorId);
      if (!monitorId) {
        return res.status(400).json({ success: false, message: "Invalid display ID." });
      }

      try {
        const pairingCode = generatePairingCode();
        const [result] = await db.query(
          `UPDATE monitors
           SET pairing_code = ?,
               pairing_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR),
               is_paired = FALSE,
               paired_at = NULL,
               device_token_hash = NULL,
               device_hostname = NULL,
               last_ip_address = NULL,
               mac_address = NULL,
               agent_version = NULL,
               browser_status = NULL,
               last_heartbeat_at = NULL,
               wake_on_wlan_enabled = FALSE,
               last_wake_requested_at = NULL,
               status = 'offline'
           WHERE monitor_id = ?`,
          [pairingCode, monitorId]
        );
        if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, message: "Display not found." });
        }

        const existingSocketId = agentSocketByMonitor.get(monitorId);
        const existingSocket = existingSocketId
          ? io.sockets.sockets.get(existingSocketId)
          : null;
        existingSocket?.disconnect(true);
        agentSocketByMonitor.delete(monitorId);

        io.emit("monitor-status-updated", { monitorId, status: "offline" });
        return res.json({
          success: true,
          message: "Pairing was reset. The new code expires in 24 hours.",
          pairingCode,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      } catch (error) {
        console.error("Reset pairing error:", error);
        return res.status(500).json({ success: false, message: "Unable to reset pairing." });
      }
    }
  );

  async function activateSchedules() {
    const now = toSqlUtc(new Date());
    try {
      await db.query(
        `UPDATE monitor_schedules
         SET status = 'completed'
         WHERE status = 'active' AND end_at <= ?`,
        [now]
      );

      const [dueRows] = await db.query(
        `SELECT schedule_id, monitor_id, project_id
         FROM monitor_schedules
         WHERE status = 'scheduled'
           AND start_at <= ?
           AND end_at > ?
         ORDER BY start_at ASC, schedule_id ASC`,
        [now, now]
      );

      for (const due of dueRows) {
        const connection = await db.getConnection();
        try {
          await connection.beginTransaction();
          const [lockedRows] = await connection.query(
            `SELECT schedule_id, monitor_id, project_id, status
             FROM monitor_schedules
             WHERE schedule_id = ?
             LIMIT 1 FOR UPDATE`,
            [due.schedule_id]
          );
          if (lockedRows.length === 0 || lockedRows[0].status !== "scheduled") {
            await connection.rollback();
            continue;
          }

          await connection.query(
            `UPDATE monitor_schedules
             SET status = 'completed'
             WHERE monitor_id = ? AND status = 'active'`,
            [due.monitor_id]
          );
          await connection.query(
            `UPDATE monitor_schedules SET status = 'active' WHERE schedule_id = ?`,
            [due.schedule_id]
          );
          await setMonitorProject(connection, due.monitor_id, due.project_id);
          await connection.commit();

          io.to(monitorRoom(due.monitor_id)).emit("schedule-updated", {
            monitorId: due.monitor_id,
            projectId: due.project_id,
            scheduleId: due.schedule_id,
            updatedAt: new Date().toISOString(),
          });
          io.to(monitorRoom(due.monitor_id)).emit("playlist-updated", {
            monitorId: due.monitor_id,
            updatedAt: new Date().toISOString(),
          });
          io.emit("scheduler-data-updated", {
            monitorId: due.monitor_id,
            scheduleId: due.schedule_id,
          });
        } catch (error) {
          await connection.rollback();
          console.error(`Unable to activate schedule ${due.schedule_id}:`, error);
        } finally {
          connection.release();
        }
      }
    } catch (error) {
      console.error("Schedule activation cycle failed:", error);
    }
  }

  async function markStaleAgentsOffline() {
    try {
      const cutoff = toSqlUtc(new Date(Date.now() - HEARTBEAT_TIMEOUT_MS));
      const [rows] = await db.query(
        `SELECT monitor_id
         FROM monitors
         WHERE status = 'online'
           AND is_paired = TRUE
           AND (last_heartbeat_at IS NULL OR last_heartbeat_at < ?)`,
        [cutoff]
      );

      if (rows.length > 0) {
        const ids = rows.map((row) => row.monitor_id);
        const placeholders = ids.map(() => "?").join(",");
        await db.query(
          `UPDATE monitors SET status = 'offline'
           WHERE monitor_id IN (${placeholders})`,
          ids
        );
        for (const monitorId of ids) {
          agentSocketByMonitor.delete(monitorId);
          io.emit("monitor-status-updated", { monitorId, status: "offline" });
        }
      }
    } catch (error) {
      console.error("Offline monitor sweep failed:", error);
    }
  }

  async function expireUnconfirmedWakeRequests() {
    try {
      const cutoff = toSqlUtc(new Date(Date.now() - WAKE_TIMEOUT_MS));
      const [rows] = await db.query(
        `SELECT request_id, monitor_id
         FROM monitor_commands
         WHERE command_type = 'wake_pc'
           AND status = 'waiting_for_reconnect'
           AND created_at < ?`,
        [cutoff]
      );
      for (const row of rows) {
        await updateCommand(
          row.request_id,
          row.monitor_id,
          "timed_out",
          "Wake-on-WLAN was not confirmed because no heartbeat resumed within 90 seconds."
        );
      }
    } catch (error) {
      console.error("Wake request timeout sweep failed:", error);
    }
  }


  function parseJsonArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  const VALID_REPEAT_DAYS = new Set([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]);

  function normalizeRepeatDays(value) {
    const rawDays = parseJsonArray(value);
    const unique = [];
    for (const day of rawDays) {
      const clean = cleanText(day, 20).toLowerCase();
      if (VALID_REPEAT_DAYS.has(clean) && !unique.includes(clean)) {
        unique.push(clean);
      }
    }
    return unique;
  }

  function normalizeClockTime(value) {
    const text = cleanText(value, 8);
    const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  }

  function timeMinute(value) {
    const text = String(value || "");
    const match = /^(\d{2}:\d{2})/.exec(text);
    return match ? match[1] : "";
  }

  function singaporeNowParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Singapore",
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      weekday: String(map.weekday || "").toLowerCase(),
      timeMinute: `${map.hour}:${map.minute}`,
      minuteKey: `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`,
    };
  }

  async function commandCreatedRecently(monitorId, commandType, seconds = 70) {
    const [rows] = await db.query(
      `SELECT command_id
       FROM monitor_commands
       WHERE monitor_id = ?
         AND command_type = ?
         AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? SECOND)
       LIMIT 1`,
      [monitorId, commandType, seconds]
    );
    return rows.length > 0;
  }

  async function issueWakeForMonitor({ monitorId, requestedBy }) {
    const [rows] = await db.query(
      `SELECT monitor_id, monitor_name, status, is_paired, mac_address,
              last_wake_requested_at
       FROM monitors
       WHERE monitor_id = ?
       LIMIT 1`,
      [monitorId]
    );

    if (rows.length === 0) {
      const error = new Error("Display not found.");
      error.statusCode = 404;
      throw error;
    }

    const monitor = rows[0];
    if (monitor.status === "online") {
      const error = new Error("The display PC is already online.");
      error.statusCode = 409;
      throw error;
    }
    if (!monitor.is_paired) {
      const error = new Error("Pair the display PC before testing Wake-on-WLAN.");
      error.statusCode = 409;
      throw error;
    }

    const macAddress = safeMac(monitor.mac_address);
    if (!macAddress) {
      const error = new Error("The display does not have a valid stored Wi-Fi MAC address.");
      error.statusCode = 409;
      throw error;
    }

    const previousRequest = Math.max(
      Number(lastWakeRequestedByMonitor.get(monitorId) || 0),
      monitor.last_wake_requested_at
        ? new Date(monitor.last_wake_requested_at).getTime()
        : 0
    );
    if (Date.now() - previousRequest < WAKE_RATE_LIMIT_MS) {
      const error = new Error("Please wait before sending another Wake-on-WLAN request.");
      error.statusCode = 429;
      throw error;
    }

    const requestId = crypto.randomUUID();
    const [result] = await db.query(
      `INSERT INTO monitor_commands
       (monitor_id, requested_by, command_type, request_id, status, message)
       VALUES (?, ?, 'wake_pc', ?, 'pending', ?)`,
      [monitorId, requestedBy, requestId, "Preparing Wake-on-WLAN packet."]
    );

    try {
      await sendWakeMagicPacket(macAddress);
    } catch (sendError) {
      await updateCommand(
        requestId,
        monitorId,
        "failed",
        sendError.message || "Unable to send the Wake-on-WLAN packet."
      );
      throw sendError;
    }

    lastWakeRequestedByMonitor.set(monitorId, Date.now());
    await db.query(
      `UPDATE monitors SET last_wake_requested_at = UTC_TIMESTAMP() WHERE monitor_id = ?`,
      [monitorId]
    );
    await updateCommand(
      requestId,
      monitorId,
      "waiting_for_reconnect",
      "Wake packet sent. Waiting for the display PC heartbeat."
    );

    const timeout = setTimeout(async () => {
      try {
        const [commandRows] = await db.query(
          `SELECT status FROM monitor_commands WHERE request_id = ? LIMIT 1`,
          [requestId]
        );
        if (commandRows[0]?.status === "waiting_for_reconnect") {
          await updateCommand(
            requestId,
            monitorId,
            "timed_out",
            "Wake-on-WLAN was not confirmed because no heartbeat resumed within 90 seconds."
          );
        }
      } catch (error) {
        console.error("Wake timeout update failed:", error);
      } finally {
        wakeTimeoutByRequest.delete(requestId);
      }
    }, WAKE_TIMEOUT_MS);
    timeout.unref?.();
    wakeTimeoutByRequest.set(requestId, timeout);

    return {
      commandId: result.insertId,
      requestId,
      monitorId,
      command: "wake-pc",
      status: "waiting_for_reconnect",
    };
  }

  async function loadBulkCommand({ type, requestedBy }) {
    const [monitorRows] = await db.query(
      `SELECT monitor_id, monitor_name, is_paired, status, mac_address
       FROM monitors
       ORDER BY FIELD(monitor_category, 'environmental', 'social', 'governance'), monitor_id ASC`
    );

    const results = [];
    for (const monitor of monitorRows) {
      try {
        if (type === "sleep") {
          const result = await issueAgentCommand({
            monitorId: monitor.monitor_id,
            command: "sleep-pc",
            requestedBy,
          });
          results.push({
            monitorId: monitor.monitor_id,
            monitorName: monitor.monitor_name,
            success: true,
            status: result.status,
            requestId: result.requestId,
            message: "Sleep command sent.",
          });
        } else if (type === "wake") {
          const result = await issueWakeForMonitor({
            monitorId: monitor.monitor_id,
            requestedBy,
          });
          results.push({
            monitorId: monitor.monitor_id,
            monitorName: monitor.monitor_name,
            success: true,
            status: result.status,
            requestId: result.requestId,
            message: "Wake packet sent.",
          });
        }
      } catch (error) {
        results.push({
          monitorId: monitor.monitor_id,
          monitorName: monitor.monitor_name,
          success: false,
          status: error.statusCode || 500,
          message: error.message || "Command failed.",
        });
      }
    }

    const successful = results.filter((item) => item.success);
    const failed = results.filter((item) => !item.success);

    if (successful.length === 0) {
      const error = new Error(
        type === "sleep"
          ? "No online paired display PCs were available for Sleep All."
          : "No paired display PCs with valid Wi-Fi MAC addresses were available for Wake All."
      );
      error.statusCode = 409;
      error.results = results;
      throw error;
    }

    return {
      successCount: successful.length,
      failureCount: failed.length,
      results,
    };
  }

  async function loadPowerSchedules() {
    const [rows] = await db.query(
      `SELECT dps.power_schedule_id, dps.monitor_id, dps.created_by,
              dps.is_enabled, dps.sleep_time, dps.wake_time, dps.repeat_days,
              dps.notes,
              ${isoExpression("dps.created_at", "created_at_iso")},
              ${isoExpression("dps.updated_at", "updated_at_iso")},
              m.monitor_name, m.monitor_category, m.location,
              u.username AS created_by_username
       FROM display_power_schedules dps
       JOIN monitors m ON m.monitor_id = dps.monitor_id
       JOIN users u ON u.user_id = dps.created_by
       ORDER BY FIELD(m.monitor_category, 'environmental', 'social', 'governance'),
                m.monitor_id ASC, dps.power_schedule_id ASC`
    );

    return rows.map((row) => ({
      ...row,
      is_enabled: Boolean(row.is_enabled),
      sleep_time: timeMinute(row.sleep_time),
      wake_time: timeMinute(row.wake_time),
      repeat_days: normalizeRepeatDays(row.repeat_days),
    }));
  }

  function validatePowerScheduleBody(body) {
    const monitorId = positiveInteger(body.monitorId);
    const sleepTime = normalizeClockTime(body.sleepTime);
    const wakeTime = normalizeClockTime(body.wakeTime);
    const repeatDays = normalizeRepeatDays(body.repeatDays);
    const isEnabled = body.isEnabled === undefined ? true : Boolean(body.isEnabled);

    if (!monitorId) {
      const error = new Error("A valid display is required.");
      error.statusCode = 400;
      throw error;
    }
    if (!sleepTime || !wakeTime) {
      const error = new Error("Valid sleep and wake times are required.");
      error.statusCode = 400;
      throw error;
    }
    if (sleepTime === wakeTime) {
      const error = new Error("Sleep time and wake time cannot be the same.");
      error.statusCode = 400;
      throw error;
    }
    if (repeatDays.length === 0) {
      const error = new Error("Choose at least one repeat day.");
      error.statusCode = 400;
      throw error;
    }

    return {
      monitorId,
      isEnabled,
      sleepTime,
      wakeTime,
      repeatDays,
      notes: cleanText(body.notes, 500) || null,
    };
  }

  app.get("/api/admin/power-scheduler/summary", requireAdmin, async (req, res) => {
    try {
      const [[monitorStats], schedules] = await Promise.all([
        db.query(
          `SELECT COUNT(*) AS total_displays,
                  SUM(status = 'online') AS online_displays,
                  SUM(status <> 'online') AS offline_displays
           FROM monitors`
        ),
        loadPowerSchedules(),
      ]);
      const today = singaporeNowParts().weekday;
      const enabledToday = schedules.filter(
        (schedule) => schedule.is_enabled && schedule.repeat_days.includes(today)
      );

      return res.json({
        success: true,
        summary: {
          totalDisplays: Number(monitorStats[0]?.total_displays || 0),
          onlineDisplays: Number(monitorStats[0]?.online_displays || 0),
          sleepingOfflineDisplays: Number(monitorStats[0]?.offline_displays || 0),
          scheduledToSleepToday: enabledToday.length,
          scheduledToWakeToday: enabledToday.length,
        },
      });
    } catch (error) {
      console.error("Power scheduler summary error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load the power scheduler summary.",
      });
    }
  });

  app.get("/api/admin/power-scheduler/monitors", requireAdmin, async (req, res) => {
    try {
      const [monitors] = await db.query(
        `SELECT m.monitor_id, m.monitor_name, m.monitor_key, m.pairing_code,
                ${isoExpression("m.pairing_expires_at", "pairing_expires_at_iso")},
                m.monitor_category, m.location, m.status, m.is_paired,
                m.device_hostname, m.last_ip_address, m.mac_address,
                m.agent_version, m.browser_status, m.wake_on_wlan_enabled,
                ${isoExpression("m.last_wake_requested_at", "last_wake_requested_at_iso")},
                ${isoExpression("m.last_heartbeat_at", "last_heartbeat_at_iso")},
                ${isoExpression("m.last_connected_at", "last_connected_at_iso")},
                p.project_id AS current_project_id,
                p.name AS current_project_name,
                dps.power_schedule_id, dps.is_enabled AS power_schedule_enabled,
                dps.sleep_time, dps.wake_time, dps.repeat_days, dps.notes AS power_schedule_notes
         FROM monitors m
         LEFT JOIN monitor_playlist_items mpi
           ON mpi.playlist_item_id = (
             SELECT mpi2.playlist_item_id
             FROM monitor_playlist_items mpi2
             WHERE mpi2.monitor_id = m.monitor_id AND mpi2.is_active = TRUE
             ORDER BY mpi2.display_order ASC, mpi2.playlist_item_id ASC
             LIMIT 1
           )
         LEFT JOIN projects p ON p.project_id = mpi.project_id
         LEFT JOIN display_power_schedules dps
           ON dps.power_schedule_id = (
             SELECT dps2.power_schedule_id
             FROM display_power_schedules dps2
             WHERE dps2.monitor_id = m.monitor_id
             ORDER BY dps2.power_schedule_id DESC
             LIMIT 1
           )
         ORDER BY FIELD(m.monitor_category, 'environmental', 'social', 'governance'),
                  m.monitor_id ASC`
      );

      const [commandRows] = await db.query(
        `SELECT mc.command_id, mc.monitor_id, mc.request_id, mc.command_type,
                mc.status, mc.message,
                ${isoExpression("mc.created_at", "created_at_iso")}
         FROM monitor_commands mc
         JOIN (
           SELECT monitor_id, MAX(command_id) AS latest_command_id
           FROM monitor_commands
           GROUP BY monitor_id
         ) latest ON latest.latest_command_id = mc.command_id`
      );
      const commandsByMonitor = new Map(
        commandRows.map((command) => [command.monitor_id, command])
      );

      return res.json({
        success: true,
        monitors: monitors.map((monitor) => ({
          ...monitor,
          is_paired: Boolean(monitor.is_paired),
          wake_on_wlan_enabled: Boolean(monitor.wake_on_wlan_enabled),
          power_schedule: monitor.power_schedule_id
            ? {
                power_schedule_id: monitor.power_schedule_id,
                is_enabled: Boolean(monitor.power_schedule_enabled),
                sleep_time: timeMinute(monitor.sleep_time),
                wake_time: timeMinute(monitor.wake_time),
                repeat_days: normalizeRepeatDays(monitor.repeat_days),
                notes: monitor.power_schedule_notes || "",
              }
            : null,
          latest_command: commandsByMonitor.get(monitor.monitor_id) || null,
        })),
      });
    } catch (error) {
      console.error("Power scheduler monitors error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load display PCs.",
      });
    }
  });

  app.get("/api/admin/power-schedules", requireAdmin, async (req, res) => {
    try {
      return res.json({ success: true, schedules: await loadPowerSchedules() });
    } catch (error) {
      console.error("Load power schedules error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load power schedules.",
      });
    }
  });

  app.post("/api/admin/power-schedules", requireAdmin, async (req, res) => {
    try {
      const input = validatePowerScheduleBody(req.body);
      const [monitorRows] = await db.query(
        `SELECT monitor_id FROM monitors WHERE monitor_id = ? LIMIT 1`,
        [input.monitorId]
      );
      if (monitorRows.length === 0) {
        return res.status(404).json({ success: false, message: "Display not found." });
      }

      const [result] = await db.query(
        `INSERT INTO display_power_schedules
         (monitor_id, created_by, is_enabled, sleep_time, wake_time, repeat_days, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.monitorId,
          req.session.user.user_id,
          input.isEnabled,
          input.sleepTime,
          input.wakeTime,
          JSON.stringify(input.repeatDays),
          input.notes,
        ]
      );
      io.emit("scheduler-data-updated", { monitorId: input.monitorId });
      return res.status(201).json({
        success: true,
        message: "Power schedule saved.",
        scheduleId: result.insertId,
      });
    } catch (error) {
      console.error("Create power schedule error:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : "Unable to save the power schedule.",
      });
    }
  });

  app.put("/api/admin/power-schedules/:scheduleId", requireAdmin, async (req, res) => {
    const scheduleId = positiveInteger(req.params.scheduleId);
    if (!scheduleId) {
      return res.status(400).json({ success: false, message: "Invalid schedule ID." });
    }

    try {
      const input = validatePowerScheduleBody(req.body);
      const [result] = await db.query(
        `UPDATE display_power_schedules
         SET monitor_id = ?, is_enabled = ?, sleep_time = ?, wake_time = ?,
             repeat_days = ?, notes = ?
         WHERE power_schedule_id = ?`,
        [
          input.monitorId,
          input.isEnabled,
          input.sleepTime,
          input.wakeTime,
          JSON.stringify(input.repeatDays),
          input.notes,
          scheduleId,
        ]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Power schedule not found." });
      }
      io.emit("scheduler-data-updated", { monitorId: input.monitorId });
      return res.json({ success: true, message: "Power schedule updated." });
    } catch (error) {
      console.error("Update power schedule error:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : "Unable to update the power schedule.",
      });
    }
  });

  app.delete("/api/admin/power-schedules/:scheduleId", requireAdmin, async (req, res) => {
    const scheduleId = positiveInteger(req.params.scheduleId);
    if (!scheduleId) {
      return res.status(400).json({ success: false, message: "Invalid schedule ID." });
    }
    try {
      const [result] = await db.query(
        `DELETE FROM display_power_schedules WHERE power_schedule_id = ?`,
        [scheduleId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Power schedule not found." });
      }
      io.emit("scheduler-data-updated", { scheduleId });
      return res.json({ success: true, message: "Power schedule deleted." });
    } catch (error) {
      console.error("Delete power schedule error:", error);
      return res.status(500).json({ success: false, message: "Unable to delete the power schedule." });
    }
  });

  app.post("/api/admin/monitors/sleep-all", requireAdmin, async (req, res) => {
    try {
      const result = await loadBulkCommand({
        type: "sleep",
        requestedBy: req.session.user.user_id,
      });
      return res.status(202).json({
        success: true,
        message: `Sleep All sent to ${result.successCount} display PC(s). ${result.failureCount} skipped/failed.`,
        ...result,
      });
    } catch (error) {
      console.error("Sleep all error:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : "Unable to send Sleep All.",
        results: error.results || [],
      });
    }
  });

  app.post("/api/admin/monitors/wake-all", requireAdmin, async (req, res) => {
    try {
      const result = await loadBulkCommand({
        type: "wake",
        requestedBy: req.session.user.user_id,
      });
      return res.status(202).json({
        success: true,
        status: "waiting_for_reconnect",
        message: `Wake All sent to ${result.successCount} display PC(s). ${result.failureCount} skipped/failed. Waiting for heartbeat confirmation.`,
        ...result,
      });
    } catch (error) {
      console.error("Wake all error:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : "Unable to send Wake All.",
        results: error.results || [],
      });
    }
  });

  app.post("/api/admin/monitors/:monitorId/sleep-now", requireAdmin, async (req, res) => {
    const monitorId = positiveInteger(req.params.monitorId);
    if (!monitorId) {
      return res.status(400).json({ success: false, message: "Invalid display ID." });
    }
    try {
      const result = await issueAgentCommand({
        monitorId,
        command: "sleep-pc",
        requestedBy: req.session.user.user_id,
      });
      return res.status(202).json({
        success: true,
        message: "Sleep command sent to the display PC.",
        command: result,
      });
    } catch (error) {
      console.error("Sleep now error:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : "Unable to send the sleep command.",
      });
    }
  });

  app.post("/api/admin/monitors/:monitorId/wake-now", requireAdmin, async (req, res) => {
    const monitorId = positiveInteger(req.params.monitorId);
    if (!monitorId) {
      return res.status(400).json({ success: false, message: "Invalid display ID." });
    }
    try {
      const result = await issueWakeForMonitor({
        monitorId,
        requestedBy: req.session.user.user_id,
      });
      return res.status(202).json({
        success: true,
        status: "waiting_for_reconnect",
        message: "Wake packet sent. Waiting for the display PC heartbeat.",
        command: result,
      });
    } catch (error) {
      console.error("Wake now error:", error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : "Unable to send the Wake-on-WLAN request.",
      });
    }
  });

  async function activatePowerSchedules() {
    const now = singaporeNowParts();
    try {
      const schedules = await loadPowerSchedules();
      for (const schedule of schedules) {
        if (!schedule.is_enabled || !schedule.repeat_days.includes(now.weekday)) continue;
        const shouldSleep = schedule.sleep_time === now.timeMinute;
        const shouldWake = schedule.wake_time === now.timeMinute;
        if (!shouldSleep && !shouldWake) continue;

        if (shouldSleep) {
          if (await commandCreatedRecently(schedule.monitor_id, "sleep_pc")) continue;
          try {
            await issueAgentCommand({
              monitorId: schedule.monitor_id,
              command: "sleep-pc",
              requestedBy: schedule.created_by,
            });
          } catch (error) {
            console.error(
              `Scheduled sleep failed for monitor ${schedule.monitor_id}:`,
              error.message
            );
          }
        }

        if (shouldWake) {
          if (await commandCreatedRecently(schedule.monitor_id, "wake_pc")) continue;
          try {
            await issueWakeForMonitor({
              monitorId: schedule.monitor_id,
              requestedBy: schedule.created_by,
            });
          } catch (error) {
            if (error.statusCode !== 409) {
              console.error(
                `Scheduled wake failed for monitor ${schedule.monitor_id}:`,
                error.message
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Power schedule activation cycle failed:", error);
    }
  }

  function serverLanIp() {
    const configured = cleanText(process.env.SERVER_LAN_IP, 45);
    if (configured && configured.toLowerCase() !== "auto") return configured;
    const candidates = [];
    for (const [name, entries] of Object.entries(os.networkInterfaces())) {
      for (const entry of entries || []) {
        if (entry.internal || entry.family !== "IPv4") continue;
        candidates.push({
          name,
          address: entry.address,
          priority: /wi-?fi|wlan|wireless/i.test(name) ? 0 : 1,
        });
      }
    }
    candidates.sort((left, right) => left.priority - right.priority);
    return candidates[0]?.address || "127.0.0.1";
  }

  function startServerDiscoveryBroadcast() {
    if (String(process.env.ENABLE_SERVER_DISCOVERY || "true").toLowerCase() === "false") {
      return null;
    }
    const discoveryPort = Number.parseInt(process.env.DISCOVERY_PORT || "41234", 10);
    const backendPort = Number.parseInt(process.env.BACKEND_PORT || process.env.PORT || "5000", 10);
    const frontendPort = Number.parseInt(process.env.FRONTEND_PORT || "3000", 10);
    const socket = dgram.createSocket("udp4");
    const sendBroadcast = () => {
      const lanIp = serverLanIp();
      const payload = Buffer.from(
        JSON.stringify({
          appName: "RP_ESG_CMS",
          backendUrl: `http://${lanIp}:${backendPort}`,
          displayUrlBase: `http://${lanIp}:${frontendPort}`,
          serverHostname: os.hostname(),
          timestamp: new Date().toISOString(),
        })
      );
      const destinations = interfaceBroadcastAddresses();
      for (const destination of destinations) {
        socket.send(payload, 0, payload.length, discoveryPort, destination, (error) => {
          if (error) console.error("Server discovery broadcast failed:", error.message);
        });
      }
    };

    socket.on("error", (error) => {
      console.error("Server discovery UDP error:", error.message);
    });
    socket.bind(() => {
      socket.setBroadcast(true);
      sendBroadcast();
      console.log(`Server discovery broadcast enabled on UDP ${discoveryPort}.`);
    });
    const timer = setInterval(sendBroadcast, 5_000);
    timer.unref?.();
    return { socket, timer };
  }

  const projectSchedulerEnabled =
    String(process.env.ENABLE_PROJECT_SCHEDULER || "false").toLowerCase() === "true";
  const schedulerTimer = projectSchedulerEnabled
    ? setInterval(activateSchedules, SCHEDULER_INTERVAL_MS)
    : null;
  const powerSchedulerTimer = setInterval(activatePowerSchedules, SCHEDULER_INTERVAL_MS);
  const offlineTimer = setInterval(markStaleAgentsOffline, 30_000);
  const wakeTimeoutSweepTimer = setInterval(expireUnconfirmedWakeRequests, 30_000);
  const discovery = startServerDiscoveryBroadcast();
  schedulerTimer?.unref?.();
  powerSchedulerTimer.unref?.();
  offlineTimer.unref?.();
  wakeTimeoutSweepTimer.unref?.();
  discovery?.timer?.unref?.();

  if (projectSchedulerEnabled) setTimeout(activateSchedules, 2_000).unref?.();
  setTimeout(activatePowerSchedules, 3_000).unref?.();
  setTimeout(markStaleAgentsOffline, 5_000).unref?.();
  setTimeout(expireUnconfirmedWakeRequests, 7_000).unref?.();
}

module.exports = { registerSchedulerDisplayFeatures };
