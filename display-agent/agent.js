const fs = require("fs");
const os = require("os");
const path = require("path");
const dgram = require("dgram");
const { spawn, execFile } = require("child_process");
const { io } = require("socket.io-client");

const CONFIG_PATH = path.join(__dirname, "config.json");
const PROFILE_PATH = path.join(__dirname, ".chrome-kiosk-profile");
const SLEEP_HELPER_PATH = path.join(__dirname, "sleep-helper.ps1");
const WAKE_SCREEN_HELPER_PATH = path.join(__dirname, "wake-screen-helper.ps1");
const AGENT_VERSION = "1.2.1";
const DISCOVERY_APP_NAME = "RP_ESG_CMS";
const COMMANDS = new Set([
  "launch-display",
  "restart-browser",
  "reload-project",
  "sleep-pc",
]);

let config;
let socket = null;
let browserProcess = null;
let browserStatus = "stopped";
let displayPath = "";
let heartbeatTimer = null;
let discoverySocket = null;
let reconnectingToDiscoveredServer = false;
let wakeScreenInFlight = false;
let lastWakeScreenRunAt = 0;

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`config.json does not exist. Run "npm run configure" in ${__dirname}.`);
  }

  const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  for (const key of ["serverUrl", "displayUrlBase", "monitorId", "deviceToken"]) {
    if (!parsed[key]) throw new Error(`Missing ${key} in config.json.`);
  }

  parsed.serverUrl = normalizeUrl(parsed.serverUrl);
  parsed.displayUrlBase = normalizeUrl(parsed.displayUrlBase);
  parsed.discoveryPort = Number.parseInt(parsed.discoveryPort || "41234", 10);
  parsed.autoDiscoverServer = parsed.autoDiscoverServer !== false;
  return parsed;
}

function saveConfig(nextConfig) {
  config = {
    ...config,
    ...nextConfig,
    serverUrl: normalizeUrl(nextConfig.serverUrl || config.serverUrl),
    displayUrlBase: normalizeUrl(nextConfig.displayUrlBase || config.displayUrlBase),
  };
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function networkIdentity() {
  const candidates = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.internal || entry.family !== "IPv4") continue;
      const validMac = entry.mac && entry.mac !== "00:00:00:00:00:00";
      const isEthernet = /ethernet|realtek|gbe|lan|pci/i.test(name);
      const isWifi = /wi-?fi|wlan|wireless/i.test(name);
      candidates.push({
        name,
        ipAddress: entry.address,
        macAddress: validMac ? entry.mac.toUpperCase() : null,
        priority: isEthernet ? 0 : isWifi ? 1 : 2,
      });
    }
  }

  candidates.sort((left, right) => left.priority - right.priority);
  return candidates[0] || { ipAddress: null, macAddress: null };
}

function findChrome() {
  const candidates = [
    config.chromePath,
    process.env.PROGRAMFILES &&
      path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] &&
      path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean);

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("Google Chrome was not found. Run npm run configure and enter chrome.exe's full path.");
  }
  return found;
}

function displayUrl() {
  const selectedPath = displayPath || config.displayPath;
  if (!selectedPath) throw new Error("The server did not provide a display path.");
  return `${config.displayUrlBase}${selectedPath.startsWith("/") ? "" : "/"}${selectedPath}`;
}

function stopBrowser() {
  return new Promise((resolve) => {
    if (!browserProcess?.pid) {
      browserProcess = null;
      browserStatus = "stopped";
      resolve();
      return;
    }

    const pid = String(browserProcess.pid);
    const finish = () => {
      browserProcess = null;
      browserStatus = "stopped";
      resolve();
    };

    if (process.platform === "win32") {
      execFile("taskkill.exe", ["/PID", pid, "/T", "/F"], finish);
    } else {
      browserProcess.kill("SIGTERM");
      setTimeout(finish, 500);
    }
  });
}

async function launchBrowser() {
  if (browserProcess && !browserProcess.killed) {
    browserStatus = "running";
    return "Kiosk Chrome is already running.";
  }

  fs.mkdirSync(PROFILE_PATH, { recursive: true });
  const chromePath = findChrome();
  const args = [
    "--kiosk",
    "--no-first-run",
    "--disable-session-crashed-bubble",
    "--disable-infobars",
    `--user-data-dir=${PROFILE_PATH}`,
    displayUrl(),
  ];

  browserStatus = "starting";
  browserProcess = spawn(chromePath, args, {
    detached: false,
    windowsHide: false,
    stdio: "ignore",
  });

  browserProcess.once("spawn", () => {
    browserStatus = "running";
    console.log(`[BROWSER] Kiosk Chrome launched: ${displayUrl()}`);
  });
  browserProcess.once("error", (error) => {
    browserStatus = "failed";
    browserProcess = null;
    console.error("[BROWSER] Chrome launch failed:", error.message);
  });
  browserProcess.once("exit", () => {
    browserStatus = "stopped";
    browserProcess = null;
  });

  return "Kiosk Chrome launched.";
}

async function restartBrowser() {
  await stopBrowser();
  await new Promise((resolve) => setTimeout(resolve, 700));
  await launchBrowser();
  return "Kiosk Chrome restarted.";
}

function runWakeScreenHelper(reason = "agent authenticated") {
  const now = Date.now();
  const cooldownMs = 60_000;

  if (process.platform !== "win32") {
    console.log("[WAKE SCREEN] Skipped because this helper is Windows-only.");
    return Promise.resolve("Wake screen helper skipped on non-Windows platform.");
  }

  if (wakeScreenInFlight || now - lastWakeScreenRunAt < cooldownMs) {
    console.log("[WAKE SCREEN] Skipped because helper is already running or still cooling down.");
    return Promise.resolve("Wake screen helper skipped due to cooldown.");
  }

  if (!fs.existsSync(WAKE_SCREEN_HELPER_PATH)) {
    console.warn("[WAKE SCREEN] wake-screen-helper.ps1 is missing from the Display Agent folder.");
    return Promise.resolve("Wake screen helper is missing.");
  }

  let url;
  try {
    url = displayUrl();
  } catch (error) {
    console.warn("[WAKE SCREEN] Could not resolve display URL yet:", error.message);
    url = "";
  }

  wakeScreenInFlight = true;
  lastWakeScreenRunAt = now;
  console.log(`[WAKE SCREEN] Running helper after ${reason}.`);

  return new Promise((resolve) => {
    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      WAKE_SCREEN_HELPER_PATH,
    ];
    if (url) args.push("-DisplayUrl", url);

    const child = spawn("powershell.exe", args, {
      cwd: __dirname,
      detached: false,
      windowsHide: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (chunk) => {
      const output = chunk.toString().trim();
      if (output) console.log("[WAKE SCREEN STDOUT]", output);
    });

    child.stderr?.on("data", (chunk) => {
      const output = chunk.toString().trim();
      if (output) console.error("[WAKE SCREEN STDERR]", output);
    });

    child.on("error", (error) => {
      wakeScreenInFlight = false;
      console.error("[WAKE SCREEN SPAWN ERROR]", error.message);
      resolve(`Wake screen helper failed to start: ${error.message}`);
    });

    child.on("exit", (code, signal) => {
      wakeScreenInFlight = false;
      console.log("[WAKE SCREEN] Helper exited.", { code, signal });
      resolve("Wake screen helper completed.");
    });
  });
}

async function ensureDisplayVisibleAfterWake(reason = "agent authenticated") {
  await runWakeScreenHelper(reason);

  if (config.autoLaunch === false) return "Automatic launch is disabled.";

  if (browserProcess && !browserProcess.killed) {
    await restartBrowser();
    return "Wake screen helper completed and kiosk Chrome was restarted.";
  }

  await launchBrowser();
  return "Wake screen helper completed and kiosk Chrome was launched.";
}

function requestWindowsSleep() {
  if (process.platform !== "win32") {
    throw new Error("Remote sleep is supported only on Windows in this prototype.");
  }

  if (config.allowSleep !== true) {
    throw new Error("Remote sleep is disabled in config.json. Run npm run configure and explicitly enable it.");
  }

  if (!fs.existsSync(SLEEP_HELPER_PATH)) {
    throw new Error("sleep-helper.ps1 is missing from the Display Agent folder.");
  }

  console.log("[SLEEP] Running helper:", SLEEP_HELPER_PATH);

  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SLEEP_HELPER_PATH],
    {
      cwd: __dirname,
      detached: false,
      windowsHide: false,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  child.stdout?.on("data", (chunk) => {
    const output = chunk.toString().trim();
    if (output) console.log("[SLEEP STDOUT]", output);
  });

  child.stderr?.on("data", (chunk) => {
    const output = chunk.toString().trim();
    if (output) console.error("[SLEEP STDERR]", output);
  });

  child.on("spawn", () => console.log("[SLEEP] PowerShell helper spawned."));
  child.on("error", (error) => console.error("[SLEEP SPAWN ERROR]", error.message));
  child.on("exit", (code, signal) => console.log("[SLEEP] PowerShell helper exited.", { code, signal }));

  return "Windows sleep helper started. Watch the display PC to confirm physical sleep.";
}

async function executeCommand(command) {
  switch (command) {
    case "launch-display":
      return launchBrowser();
    case "restart-browser":
      return restartBrowser();
    case "reload-project":
      if (!browserProcess || browserProcess.killed) {
        await launchBrowser();
        return "Display launched with the latest playlist.";
      }
      await restartBrowser();
      return "Display reloaded with the latest playlist.";
    case "sleep-pc":
      return requestWindowsSleep();
    default:
      throw new Error("Unsupported display command.");
  }
}

function heartbeatPayload() {
  const identity = networkIdentity();
  return {
    hostname: os.hostname(),
    ipAddress: identity.ipAddress,
    macAddress: identity.macAddress,
    agentVersion: AGENT_VERSION,
    browserStatus,
  };
}

async function refreshCurrentAssignment() {
  try {
    const response = await fetch(`${config.serverUrl}/api/display-agent/current-assignment?monitorId=${encodeURIComponent(config.monitorId)}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.deviceToken}`,
        "X-Monitor-ID": String(config.monitorId),
      },
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.monitor?.displayPath) {
      displayPath = data.monitor.displayPath;
      saveConfig({ displayPath });
      console.log("[ASSIGNMENT] Current display path refreshed:", displayPath);
    }
  } catch (error) {
    console.error("[ASSIGNMENT] Unable to refresh current assignment:", error.message);
  }
}

function closeSocket() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  if (socket) {
    socket.removeAllListeners();
    socket.close();
    socket = null;
  }
}

function startDiscovery(reason = "connection failed") {
  if (!config.autoDiscoverServer) return;
  if (discoverySocket || reconnectingToDiscoveredServer) return;

  const port = Number.parseInt(config.discoveryPort || "41234", 10);
  console.log(`[DISCOVERY] Starting server discovery on UDP ${port} because ${reason}.`);

  discoverySocket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  const stopDiscovery = () => {
    if (!discoverySocket) return;
    try { discoverySocket.close(); } catch {}
    discoverySocket = null;
  };

  discoverySocket.on("message", (message) => {
    try {
      const payload = JSON.parse(message.toString("utf8"));
      if (payload.appName !== DISCOVERY_APP_NAME) return;
      if (!payload.backendUrl || !payload.displayUrlBase) return;
      const backendUrl = normalizeUrl(payload.backendUrl);
      const displayUrlBase = normalizeUrl(payload.displayUrlBase);
      if (!backendUrl || !displayUrlBase) return;

      console.log("[DISCOVERY] New server discovered:", backendUrl, displayUrlBase);
      reconnectingToDiscoveredServer = true;
      stopDiscovery();
      saveConfig({ backendUrl, serverUrl: backendUrl, displayUrlBase });
      console.log("[DISCOVERY] config.json updated with the new server IP.");
      setTimeout(() => {
        reconnectingToDiscoveredServer = false;
        connectSocket();
      }, 500);
    } catch (error) {
      console.error("[DISCOVERY] Invalid discovery packet:", error.message);
    }
  });

  discoverySocket.on("error", (error) => {
    console.error("[DISCOVERY] UDP listener error:", error.message);
    stopDiscovery();
  });

  discoverySocket.bind(port, "0.0.0.0", () => {
    console.log("[DISCOVERY] Listening for RP_ESG_CMS server broadcasts...");
  });
}

function connectSocket() {
  closeSocket();
  console.log("[SOCKET] Connecting to", config.serverUrl);
  socket = io(config.serverUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });

  socket.on("connect", () => {
    console.log(`[SOCKET] Connected to server as socket ${socket.id}`);
    socket.emit("agent-register", {
      monitorId: config.monitorId,
      deviceToken: config.deviceToken,
      ...heartbeatPayload(),
    });
  });

  socket.on("agent-authenticated", async (data) => {
    displayPath = data.displayPath || displayPath || config.displayPath;
    saveConfig({ displayPath });
    console.log(`[SOCKET] Authenticated as ${data.monitorName}.`);

    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      console.log("[HEARTBEAT] Sent.");
      socket.emit("agent-heartbeat", heartbeatPayload());
    }, Number(data.heartbeatIntervalMs || 20_000));
    heartbeatTimer.unref?.();
    socket.emit("agent-heartbeat", heartbeatPayload());

    await refreshCurrentAssignment();

    if (config.autoLaunch !== false) {
      try {
        const wakeMessage = await ensureDisplayVisibleAfterWake(
          data.wakeScreenAfterReconnect
            ? "confirmed Wake-on-LAN reconnect"
            : "agent authenticated / reconnect safety check"
        );

        console.log("[WAKE SCREEN]", wakeMessage);
      } catch (error) {
        console.error("[BROWSER] Automatic wake/display launch failed:", error.message);
      }
    }
  });

  socket.on("agent-authentication-failed", (data) => {
    console.error("[SOCKET] Authentication failed:", data?.message || "Invalid device token.");
  });

  socket.on("display-command", async (payload = {}) => {
    console.log("[DISPLAY COMMAND RECEIVED RAW]", payload);
    console.log("[AGENT MONITOR ID]", config.monitorId);

    const requestId = String(payload.requestId || "").trim();
    const command = String(payload.command || "").trim();

    if (!requestId || Number(payload.monitorId) !== Number(config.monitorId)) {
      console.log("[COMMAND IGNORED] Monitor ID mismatch or missing requestId", {
        payloadMonitorId: payload.monitorId,
        agentMonitorId: config.monitorId,
        requestId,
      });
      return;
    }

    if (!COMMANDS.has(command)) {
      console.log("[COMMAND REJECTED] Unknown command:", command);
      socket.emit("command-failed", { requestId, message: "The agent rejected an unknown command." });
      return;
    }

    console.log("[COMMAND ACCEPTED]", command);
    socket.emit("command-acknowledged", {
      requestId,
      message: `${command} acknowledged by the display PC.`,
    });

    try {
      const message = await executeCommand(command);
      console.log("[COMMAND COMPLETED]", command, message);
      socket.emit("command-completed", { requestId, message });
    } catch (error) {
      console.error("[COMMAND FAILED]", command, error.message);
      socket.emit("command-failed", { requestId, message: error.message });
    }
  });

  socket.on("wake-screen-requested", async (payload = {}) => {
    try {
      const wakeMessage = await ensureDisplayVisibleAfterWake(payload.reason || "wake heartbeat resumed");
      console.log("[WAKE SCREEN]", wakeMessage);
    } catch (error) {
      console.error("[WAKE SCREEN] Unable to wake/relaunch display:", error.message);
    }
  });

  socket.on("project-updated", refreshCurrentAssignment);
  socket.on("schedule-updated", refreshCurrentAssignment);
  socket.on("playlist-updated", refreshCurrentAssignment);

  socket.on("disconnect", (reason) => {
    console.log(`[SOCKET] Disconnected from server: ${reason}`);
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (reason !== "io client disconnect") startDiscovery("socket disconnected");
  });

  socket.on("connect_error", (error) => {
    console.error(`[SOCKET] Connection error: ${error.message}`);
    startDiscovery("socket connection failed");
  });
}

function start() {
  config = readConfig();
  displayPath = config.displayPath || "";
  connectSocket();

  const stop = async () => {
    clearInterval(heartbeatTimer);
    closeSocket();
    if (discoverySocket) {
      try { discoverySocket.close(); } catch {}
    }
    await stopBrowser();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

try {
  start();
} catch (error) {
  console.error(`Display Agent failed to start: ${error.message}`);
  process.exitCode = 1;
}
