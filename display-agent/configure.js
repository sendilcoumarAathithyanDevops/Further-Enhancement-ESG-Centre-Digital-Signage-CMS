const fs = require("fs");
const os = require("os");
const path = require("path");
const dgram = require("dgram");
const readline = require("readline/promises");
const { stdin, stdout } = require("process");

const CONFIG_PATH = path.join(__dirname, "config.json");
const AGENT_VERSION = "1.2.1";
const DISCOVERY_APP_NAME = "RP_ESG_CMS";

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
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

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    await response.text();
    throw new Error(`Server returned a non-JSON response (${response.status}).`);
  }
  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Pairing failed.");
  }
  return data;
}

function listenForServerDiscovery(port, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const timeout = setTimeout(() => {
      try { socket.close(); } catch {}
      reject(new Error("No RP ESG CMS server discovery broadcast was received."));
    }, timeoutMs);

    socket.on("message", (message) => {
      try {
        const payload = JSON.parse(message.toString("utf8"));
        if (payload.appName !== DISCOVERY_APP_NAME) return;
        if (!payload.backendUrl || !payload.displayUrlBase) return;
        clearTimeout(timeout);
        try { socket.close(); } catch {}
        resolve({
          serverUrl: normalizeUrl(payload.backendUrl),
          displayUrlBase: normalizeUrl(payload.displayUrlBase),
          serverHostname: payload.serverHostname || "unknown",
        });
      } catch {}
    });

    socket.on("error", (error) => {
      clearTimeout(timeout);
      try { socket.close(); } catch {}
      reject(error);
    });

    socket.bind(port, "0.0.0.0", () => {
      console.log(`Listening for server discovery on UDP ${port} for ${Math.round(timeoutMs / 1000)}s...`);
    });
  });
}

async function pairWithServer({ serverUrl, pairingCode, identity }) {
  const response = await fetch(`${serverUrl}/api/display-agent/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      pairingCode,
      hostname: os.hostname(),
      ipAddress: identity.ipAddress,
      macAddress: identity.macAddress,
      agentVersion: AGENT_VERSION,
    }),
  });
  return parseResponse(response);
}

async function main() {
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  try {
    console.log("\nRP ESG Centre Display Agent configuration\n");
    let serverUrl = normalizeUrl(
      await prompt.question("Backend server URL (example http://192.168.1.100:5000, leave blank to auto-discover): ")
    );
    let displayUrlBase = normalizeUrl(
      await prompt.question("React display URL base (example http://192.168.1.100:3000, leave blank to auto-discover): ")
    );
    const pairingCode = String(await prompt.question("One-time pairing code shown in Scheduler: "))
      .trim()
      .toUpperCase();
    const chromePath = String(
      await prompt.question("Chrome path (leave blank to detect the standard Windows location): ")
    ).trim();
    const sleepAnswer = String(
      await prompt.question("Enable real Windows sleep commands on this PC? Type YES to enable: ")
    )
      .trim()
      .toUpperCase();
    const discoveryAnswer = String(
      await prompt.question("Enable automatic server IP discovery? Press Enter for YES, type NO to disable: ")
    )
      .trim()
      .toUpperCase();

    const discoveryPort = 41234;
    const autoDiscoverServer = discoveryAnswer !== "NO";

    if (!pairingCode) {
      throw new Error("Pairing code is required.");
    }

    const identity = networkIdentity();
    console.log(
      `Detected network adapter: ${identity.name || "unknown"} | ${identity.ipAddress || "no IP"} | ${identity.macAddress || "no MAC"}`
    );

    if ((!serverUrl || !displayUrlBase) && autoDiscoverServer) {
      const discovered = await listenForServerDiscovery(discoveryPort);
      console.log(`Discovered server ${discovered.serverHostname}: ${discovered.serverUrl}`);
      serverUrl = discovered.serverUrl;
      displayUrlBase = discovered.displayUrlBase;
    }

    if (!serverUrl || !displayUrlBase) {
      throw new Error("Server URL and display URL base are required when discovery is disabled or unavailable.");
    }

    let data;
    try {
      data = await pairWithServer({ serverUrl, pairingCode, identity });
    } catch (error) {
      if (!autoDiscoverServer) throw error;
      console.log(`Pairing through saved URL failed: ${error.message}`);
      const discovered = await listenForServerDiscovery(discoveryPort);
      console.log(`Discovered server ${discovered.serverHostname}: ${discovered.serverUrl}`);
      serverUrl = discovered.serverUrl;
      displayUrlBase = discovered.displayUrlBase;
      data = await pairWithServer({ serverUrl, pairingCode, identity });
    }

    const config = {
      serverUrl,
      displayUrlBase,
      monitorId: data.device.monitorId,
      deviceToken: data.device.deviceToken,
      displayPath: data.device.displayPath,
      chromePath: chromePath || "",
      autoLaunch: true,
      allowSleep: sleepAnswer === "YES",
      autoDiscoverServer,
      discoveryPort,
    };

    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });

    console.log(`\nPaired with: ${data.device.monitorName}`);
    console.log(`Configuration saved to: ${CONFIG_PATH}`);
    console.log(config.allowSleep ? "Remote sleep is enabled for this PC." : "Remote sleep remains disabled. Re-run configuration to enable it.");
    console.log(config.autoDiscoverServer ? "Automatic server IP discovery is enabled." : "Automatic server IP discovery is disabled.");
    console.log("Run npm start to start the Display Agent.\n");
  } finally {
    prompt.close();
  }
}

main().catch((error) => {
  console.error(`\nConfiguration failed: ${error.message}\n`);
  process.exitCode = 1;
});
