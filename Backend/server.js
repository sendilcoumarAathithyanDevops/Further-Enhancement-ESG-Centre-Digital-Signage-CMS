const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const db = require("./db");
const { registerSchedulerDisplayFeatures } = require("./schedulerDisplay");
const {
  sendSignupVerificationEmail,
  sendEmailChangeVerificationEmail,
  sendPasswordResetEmail
} = require("./mailer");

const http = require("http");
const { Server } = require("socket.io");
const os = require("os");
const templateRoutes = require("./routes/templateRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const configuredSessionSecret = process.env.SESSION_SECRET?.trim();
const hasConfiguredSessionSecret =
  configuredSessionSecret &&
  !configuredSessionSecret.startsWith("replace-with-");

if (process.env.NODE_ENV === "production" && !hasConfiguredSessionSecret) {
  throw new Error("SESSION_SECRET must be configured in production.");
}

const sessionSecret = hasConfiguredSessionSecret
  ? configuredSessionSecret
  : crypto.randomBytes(32).toString("hex");

if (!hasConfiguredSessionSecret) {
  console.warn(
    "SESSION_SECRET is not configured; using a temporary development secret. Sessions will reset when the server restarts."
  );
}

const UPLOAD_ROOT = path.join(__dirname, "uploads");
const BACKGROUND_SETTINGS_MARKER = "__BACKGROUND_SETTINGS__";
const TRANSITION_SETTINGS_MARKER = "__TRANSITION_SETTINGS__";
const VALID_TRANSITION_TYPES = new Set([
  "none",
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",
  "zoom",
]);
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const CORS_ORIGIN = CLIENT_ORIGINS.length === 1 ? CLIENT_ORIGINS[0] : CLIENT_ORIGINS;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Screen connected:", socket.id);

  socket.on("register-monitor", async ({ tokenCode }) => {
    try {
      console.log("Register monitor received:", tokenCode);

      const [rows] = await db.query(
        `
        SELECT 
          monitor_id,
          monitor_name,
          monitor_category,
          pairing_code
        FROM monitors
        WHERE pairing_code = ?
        LIMIT 1
        `,
        [tokenCode]
      );

      if (rows.length === 0) {
        console.log("Invalid monitor token:", tokenCode);

        socket.emit("monitor-register-failed", {
          message: "Invalid monitor token code",
        });

        return;
      }

      const monitor = rows[0];

      socket.monitorId = monitor.monitor_id;

      socket.join(`monitor_${monitor.monitor_id}`);

      await db.query(
        `
        UPDATE monitors
        SET status = 'online',
            last_connected_at = UTC_TIMESTAMP()
        WHERE monitor_id = ?
        `,
        [monitor.monitor_id]
      );

      io.emit("monitor-status-updated", {
        monitorId: monitor.monitor_id,
        status: "online",
      });

      socket.emit("monitor-registered", {
        monitorId: monitor.monitor_id,
        monitorName: monitor.monitor_name,
        category: monitor.monitor_category,
      });

      console.log(`${monitor.monitor_name} joined monitor_${monitor.monitor_id}`);
    } catch (error) {
      console.error("Register monitor error:", error);
    }
  });

  socket.on("monitor-heartbeat", async ({ tokenCode } = {}) => {
    try {
      if (!tokenCode) return;
      const [rows] = await db.query(
        `SELECT monitor_id FROM monitors WHERE pairing_code = ? LIMIT 1`,
        [tokenCode]
      );
      if (rows.length === 0) return;
      socket.monitorId = rows[0].monitor_id;
      socket.join(`monitor_${rows[0].monitor_id}`);
      await db.query(
        `UPDATE monitors
         SET status = 'online', last_connected_at = UTC_TIMESTAMP()
         WHERE monitor_id = ?`,
        [rows[0].monitor_id]
      );
    } catch (error) {
      console.error("Monitor heartbeat error:", error);
    }
  });

  socket.on("disconnect", async () => {
    console.log("Screen disconnected:", socket.id);

    if (socket.monitorId) {
      const [result] = await db.query(
        `UPDATE monitors
         SET status = 'offline'
         WHERE monitor_id = ?
           AND (
             is_paired = FALSE
             OR last_heartbeat_at IS NULL
             OR last_heartbeat_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 SECOND)
           )`,
        [socket.monitorId]
      );

      if (result.affectedRows > 0) {
        io.emit("monitor-status-updated", {
          monitorId: socket.monitorId,
          status: "offline",
        });
      }
    }
  });
});

const UPLOAD_CONFIG = {
  images: {
    extensions: new Set([".jpg", ".jpeg", ".png", ".webp"]),
    mimeTypes: new Set(["image/jpeg", "image/png", "image/webp"]),
    maxFileSize: 15 * 1024 * 1024,
    maxFiles: 20,
  },
  backgrounds: {
    extensions: new Set([".jpg", ".jpeg", ".png", ".webp"]),
    mimeTypes: new Set(["image/jpeg", "image/png", "image/webp"]),
    maxFileSize: 20 * 1024 * 1024,
    maxFiles: 1,
  },
  videos: {
    extensions: new Set([".mp4", ".webm"]),
    mimeTypes: new Set(["video/mp4", "video/webm"]),
    maxFileSize: 1024 * 1024 * 1024,
    maxFiles: 1,
  },
  avatars: {
    extensions: new Set([".jpg", ".jpeg", ".png", ".webp"]),
    mimeTypes: new Set(["image/jpeg", "image/png", "image/webp"]),
    maxFileSize: 5 * 1024 * 1024,
    maxFiles: 1,
  },
  documents: {
    extensions: new Set([
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".txt",
      ".csv",
      ".json",
      ".md",
    ]),
    mimeTypes: new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/json",
      "text/markdown",
    ]),
    maxFileSize: 25 * 1024 * 1024,
    maxFiles: 1,
  },
};

for (const folder of Object.keys(UPLOAD_CONFIG)) {
  fs.mkdirSync(path.join(UPLOAD_ROOT, folder), { recursive: true });
}

// ========================
// MIDDLEWARE
// ========================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60,
      sameSite: "lax",
    },
  })
);

app.use(
  "/uploads",
  express.static(UPLOAD_ROOT, {
    fallthrough: true,
    index: false,
    maxAge: "1h",
  })
);

app.use("/api/templates", templateRoutes);


const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Returns { token, tokenHash, expiresAt } — `token` goes in the emailed link,
// only `tokenHash` (sha256) is ever stored in the database.
function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  return { token, tokenHash, expiresAt };
}

// ========================
// RESET PASSWORD
// ========================
function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  return {
    token,
    tokenHash,
    expiresAt,
  };
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "You must be logged in to continue.",
    });
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "You must be logged in to continue.",
    });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Administrator access is required.",
    });
  }

  return next();
}

function parseJsonValue(value, fallback = {}) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toInteger(value, fallback, minimum = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return parsed;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function cleanUploadPath(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/uploads/")) return null;
  if (trimmed.includes("..") || trimmed.includes("\\")) return null;
  return trimmed.slice(0, 500);
}

function collectStyleMediaPaths(style, targetSet) {
  if (!style || typeof style !== "object") return;

  if (Array.isArray(style.imagePaths)) {
    for (const item of style.imagePaths) {
      const safePath = cleanUploadPath(item);
      if (safePath) targetSet.add(safePath);
    }
  }
}

function collectMediaPathsFromPages(pages) {
  const paths = new Set();

  for (const page of Array.isArray(pages) ? pages : []) {
    const backgroundPath = cleanUploadPath(page.backgroundImagePath);
    if (backgroundPath) paths.add(backgroundPath);

    for (const component of Array.isArray(page.components) ? page.components : []) {
      const filePath = cleanUploadPath(component.filePath);
      if (filePath) paths.add(filePath);
      collectStyleMediaPaths(component.style, paths);
    }
  }

  return paths;
}

function uploadPathToDisk(uploadPath) {
  const safePath = cleanUploadPath(uploadPath);
  if (!safePath) return null;

  const relativePath = safePath.replace(/^\/uploads\//, "");
  const absolutePath = path.resolve(UPLOAD_ROOT, relativePath);
  const rootWithSeparator = `${path.resolve(UPLOAD_ROOT)}${path.sep}`;

  if (!absolutePath.startsWith(rootWithSeparator)) return null;
  return absolutePath;
}

async function isMediaPathReferenced(uploadPath) {
  const [[canvasReference]] = await db.query(
    `SELECT COUNT(*) AS reference_count
     FROM canvases
     WHERE background_image_path = ?`,
    [uploadPath]
  );

  if (Number(canvasReference.reference_count) > 0) return true;

  const [[componentReference]] = await db.query(
    `SELECT COUNT(*) AS reference_count
     FROM components
     WHERE file_path = ?
        OR JSON_SEARCH(style_json, 'one', ?) IS NOT NULL`,
    [uploadPath, uploadPath]
  );

  return Number(componentReference.reference_count) > 0;
}

async function removeUploadIfUnreferenced(uploadPath) {
  try {
    const absolutePath = uploadPathToDisk(uploadPath);
    if (!absolutePath) return false;
    if (await isMediaPathReferenced(uploadPath)) return false;

    await fs.promises.unlink(absolutePath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    return true;
  } catch (error) {
    console.error(`Unable to clean up upload ${uploadPath}:`, error);
    return false;
  }
}

async function cleanupRemovedMedia(oldPaths, newPaths) {
  const removedPaths = [...oldPaths].filter((oldPath) => !newPaths.has(oldPath));
  await Promise.all(removedPaths.map(removeUploadIfUnreferenced));
}

function createUploadMiddleware(kind, fieldName, multiple) {
  const config = UPLOAD_CONFIG[kind];

  const storage = multer.diskStorage({
    destination(req, file, callback) {
      const userDirectory = path.join(
        UPLOAD_ROOT,
        kind,
        String(req.session.user.user_id)
      );
      fs.mkdirSync(userDirectory, { recursive: true });
      callback(null, userDirectory);
    },
    filename(req, file, callback) {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    },
  });

  const uploader = multer({
    storage,
    limits: {
      fileSize: config.maxFileSize,
      files: config.maxFiles,
    },
    fileFilter(req, file, callback) {
      const extension = path.extname(file.originalname).toLowerCase();
      const allowed =
        config.extensions.has(extension) && config.mimeTypes.has(file.mimetype);

      if (!allowed) {
        const error = new Error(`Unsupported ${kind} file type.`);
        error.code = "UNSUPPORTED_FILE_TYPE";
        return callback(error);
      }

      return callback(null, true);
    },
  });

  const handler = multiple
    ? uploader.array(fieldName, config.maxFiles)
    : uploader.single(fieldName);

  return (req, res, next) => {
    handler(req, res, (error) => {
      if (!error) return next();

      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? `The selected file exceeds the ${Math.round(
            config.maxFileSize / (1024 * 1024)
          )} MB limit.`
          : error.message || "Unable to upload the selected file.";

      return res.status(400).json({ success: false, message });
    });
  };
}

function getUploadedPublicPath(kind, userId, file) {
  return `/uploads/${kind}/${userId}/${file.filename}`;
}

const VALID_CATEGORIES = new Set(["environmental", "social", "governance"]);
const VALID_COMPONENT_TYPES = new Set(["text", "image", "video", "shape", "iframe"]);

function validateProjectPayload(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" ? body.category.toLowerCase() : "";
  const pages = Array.isArray(body.pages) ? body.pages : [];

  if (!name) return "Project name is required.";
  if (name.length > 150) return "Project name must be 150 characters or fewer.";
  if (!description) return "Project description is required.";
  if (!VALID_CATEGORIES.has(category)) return "A valid project category is required.";
  if (pages.length === 0) return "The project must contain at least one page.";
  if (pages.length > 50) return "A project cannot contain more than 50 pages.";

  for (const [index, page] of pages.entries()) {
    const pageName = typeof page.name === "string" ? page.name.trim() : "";
    if (!pageName) return `Page ${index + 1} must have a name.`;
    if (pageName.length > 150) {
      return `Page ${index + 1} name must be 150 characters or fewer.`;
    }
    if (page.components !== undefined && !Array.isArray(page.components)) {
      return `Page ${index + 1} has an invalid components value.`;
    }
    if ((page.components || []).length > 200) {
      return `Page ${index + 1} cannot contain more than 200 widgets.`;
    }
  }

  return null;
}

function mapComponentRow(row) {
  return {
    componentId: row.component_id,
    type: row.type,
    contentText: row.content_text,
    filePath: row.file_path,
    externalUrl: row.external_url,
    positionX: row.position_x,
    positionY: row.position_y,
    width: row.width,
    height: row.height,
    rotation: Number(row.rotation || 0),
    layerOrder: row.layer_order,
    style: parseJsonValue(row.style_json, {}),
  };
}

function mapCanvasRow(row, components = [], backgroundSettings = {}, transitionSettings = {}) {
  return {
    canvasId: row.canvas_id,
    name: row.name,
    order: row.canvas_order,
    width: row.width,
    height: row.height,
    backgroundColor: row.background_color,
    backgroundImagePath: row.background_image_path,
    durationSeconds: row.duration_seconds || 10,
    backgroundSettings,
    transitionSettings: {
      type: VALID_TRANSITION_TYPES.has(transitionSettings.type)
        ? transitionSettings.type
        : "none",
    },
    components,
  };
}

function splitCanvasRows(components) {
  const componentsByCanvasId = new Map();
  const backgroundSettingsByCanvasId = new Map();
  const transitionSettingsByCanvasId = new Map();

  for (const row of components) {
    const style = parseJsonValue(row.style_json, {});

    if (
      row.type === "shape" &&
      row.content_text === BACKGROUND_SETTINGS_MARKER &&
      style.widgetKind === "backgroundSettings"
    ) {
      backgroundSettingsByCanvasId.set(row.canvas_id, style);
      continue;
    }

    if (
      row.type === "shape" &&
      row.content_text === TRANSITION_SETTINGS_MARKER &&
      style.widgetKind === "transitionSettings"
    ) {
      transitionSettingsByCanvasId.set(row.canvas_id, style);
      continue;
    }

    const existing = componentsByCanvasId.get(row.canvas_id) || [];
    existing.push(mapComponentRow(row));
    componentsByCanvasId.set(row.canvas_id, existing);
  }

  return { componentsByCanvasId, backgroundSettingsByCanvasId, transitionSettingsByCanvasId };
}

async function insertPages(connection, projectId, pages) {
  for (const [pageIndex, page] of pages.entries()) {
    const width = 1920;
    const height = 1080;
    const pageName = page.name.trim();
    const backgroundColor =
      typeof page.backgroundColor === "string" && page.backgroundColor.trim()
        ? page.backgroundColor.trim().slice(0, 20)
        : "#FFFFFF";
    const backgroundImagePath = cleanUploadPath(page.backgroundImagePath);

    const [canvasResult] = await connection.query(
      `INSERT INTO canvases
        (project_id, name, canvas_order, width, height, background_color, background_image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        pageName,
        pageIndex + 1,
        width,
        height,
        backgroundColor,
        backgroundImagePath,
      ]
    );

    const canvasId = canvasResult.insertId;
    const backgroundSettings =
      page.backgroundSettings && typeof page.backgroundSettings === "object"
        ? {
          widgetKind: "backgroundSettings",
          backgroundFit: ["cover", "contain", "fill"].includes(
            page.backgroundSettings.backgroundFit
          )
            ? page.backgroundSettings.backgroundFit
            : "cover",
          imageOpacity: clamp(
            toNumber(page.backgroundSettings.imageOpacity, 1),
            0,
            1
          ),
          colorOpacity: clamp(
            toNumber(page.backgroundSettings.colorOpacity, 1),
            0,
            1
          ),
        }
        : {
          widgetKind: "backgroundSettings",
          backgroundFit: "cover",
          imageOpacity: 1,
          colorOpacity: 1,
        };

    await connection.query(
      `INSERT INTO components
        (canvas_id, type, content_text, file_path, external_url,
         position_x, position_y, width, height, rotation, layer_order, style_json)
       VALUES (?, 'shape', ?, NULL, NULL, 0, 0, 1920, 1080, 0, 1, ?)`,
      [canvasId, BACKGROUND_SETTINGS_MARKER, JSON.stringify(backgroundSettings)]
    );

    const transitionSettings = {
      widgetKind: "transitionSettings",
      type: VALID_TRANSITION_TYPES.has(page.transitionSettings?.type)
        ? page.transitionSettings.type
        : "none",
    };

    await connection.query(
      `INSERT INTO components
        (canvas_id, type, content_text, file_path, external_url,
         position_x, position_y, width, height, rotation, layer_order, style_json)
       VALUES (?, 'shape', ?, NULL, NULL, 0, 0, 1920, 1080, 0, 1, ?)`,
      [canvasId, TRANSITION_SETTINGS_MARKER, JSON.stringify(transitionSettings)]
    );

    const components = Array.isArray(page.components) ? page.components : [];

    for (const [componentIndex, component] of components.entries()) {
      const type = VALID_COMPONENT_TYPES.has(component.type) ? component.type : "text";
      const style =
        component.style && typeof component.style === "object" ? component.style : {};
      const componentWidth = clamp(toInteger(component.width, 300, 1), 20, width);
      const componentHeight = clamp(toInteger(component.height, 200, 1), 20, height);
      const positionX = clamp(
        toInteger(component.positionX, 0),
        0,
        Math.max(0, width - componentWidth)
      );
      const positionY = clamp(
        toInteger(component.positionY, 0),
        0,
        Math.max(0, height - componentHeight)
      );

      await connection.query(
        `INSERT INTO components
          (canvas_id, type, content_text, file_path, external_url,
           position_x, position_y, width, height, rotation, layer_order, style_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          canvasId,
          type,
          typeof component.contentText === "string"
            ? component.contentText.slice(0, 10000)
            : null,
          cleanUploadPath(component.filePath),
          typeof component.externalUrl === "string" && component.externalUrl.trim()
            ? component.externalUrl.trim().slice(0, 500)
            : null,
          positionX,
          positionY,
          componentWidth,
          componentHeight,
          toNumber(component.rotation, 0),
          toInteger(component.layerOrder, componentIndex + 2, 1),
          JSON.stringify(style),
        ]
      );
    }
  }
}

async function getProjectMediaPaths(connection, projectId) {
  const paths = new Set();

  const [canvases] = await connection.query(
    `SELECT canvas_id, background_image_path
     FROM canvases
     WHERE project_id = ?`,
    [projectId]
  );

  for (const canvas of canvases) {
    const safePath = cleanUploadPath(canvas.background_image_path);
    if (safePath) paths.add(safePath);
  }

  const canvasIds = canvases.map((canvas) => canvas.canvas_id);
  if (canvasIds.length === 0) return paths;

  const placeholders = canvasIds.map(() => "?").join(",");
  const [components] = await connection.query(
    `SELECT file_path, style_json
     FROM components
     WHERE canvas_id IN (${placeholders})`,
    canvasIds
  );

  for (const component of components) {
    const safePath = cleanUploadPath(component.file_path);
    if (safePath) paths.add(safePath);
    collectStyleMediaPaths(parseJsonValue(component.style_json, {}), paths);
  }

  return paths;
}

// ========================
// LOGIN
// ========================

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter username and password.",
      });
    }

    const [rows] = await db.query(
      `SELECT user_id, username, email, password_hash, role, avatar_path, email_verified
      FROM users
      WHERE username = ? OR email = ?
      LIMIT 1`,
      [username, username]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    req.session.user = {
    user_id: user.user_id,
    username: user.username,
    email: user.email,
    role: user.role,
    email_verified: Boolean(user.email_verified),
    avatar_path: user.avatar_path || null,
  };
    return res.json({
      success: true,
      message: "Login successful.",
      redirect: user.role === "admin" ? "/admin-dashboard" : "/dashboard",
      user: req.session.user,
    });
  } catch (err) {
    console.error("Login error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error during login.",
    });
  }
});

// ========================
// SIGNUP
// ========================

app.post("/signup", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      confirmPassword
    } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all fields.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const [existing] = await db.query(
      `
      SELECT user_id
      FROM users
      WHERE username = ?
      OR email = ?
      LIMIT 1
      `,
      [
        username,
        email
      ]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const {
      token,
      tokenHash,
      expiresAt
    } = createEmailVerificationToken();

    await db.query(
      `
      INSERT INTO users
      (
        username,
        email,
        password_hash,
        role,
        email_verified,
        email_verification_token_hash,
        email_verification_expires_at
      )
      VALUES (?, ?, ?, ?, 0, ?, ?)
      `,
      [
        username,
        email,
        hashedPassword,
        "producer",
        tokenHash,
        expiresAt
      ]
    );

    res.status(201).json({
      success: true,
      message:
        "Account created successfully. Please check your email to verify your account."
    });

    sendSignupVerificationEmail(
      email,
      token
    )
    .catch((mailErr) => {
      console.error(
        "Signup verification email error:",
        mailErr
      );
    });



  } catch (err) {
    console.error(
      "Signup error:",
      err
    );

    res.status(500).json({
      success: false,
      message:
        "Server error during signup."
    });

  }
});

// ========================
// FORGET PASSWORD
// ========================

app.post("/api/forgot-password", async (req, res) => {

  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim()
        : "";

    if (!email) {

      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });

    }

    const [rows] = await db.query(
      `
      SELECT
        user_id,
        email
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    if (rows.length === 0) {

      return res.json({
        success: true,
        message:
          "If that email exists, a reset link has been sent.",
      });

    }

    const user = rows[0];

    const {
      token,
      tokenHash,
      expiresAt,
    } = createPasswordResetToken();

    await db.query(
      `
      UPDATE users
      SET
        reset_token_hash = ?,
        reset_token_expires_at = ?
      WHERE user_id = ?
      `,
      [
        tokenHash,
        expiresAt,
        user.user_id,
      ]
    );

    await sendPasswordResetEmail(
      user.email,
      token
    );

    res.json({
      success: true,
      message:
        "If that email exists, a reset link has been sent.",

    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server error.",
    });

  }

});

// ========================
// RESET PASSWORD
// ========================

app.post("/api/reset-password", async (req, res) => {

  try {
    const {
      token,
      password,
      confirmPassword
    } = req.body;


    if (!token || !password || !confirmPassword) {

      return res.status(400).json({
        success: false,
        message: "Missing fields."
      });

    }

    if (password !== confirmPassword) {

      return res.status(400).json({
        success: false,
        message: "Passwords do not match."
      });

    }

    // hash incoming token
    const tokenHash =
      crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    const [rows] = await db.query(
      `
      SELECT user_id
      FROM users
      WHERE reset_token_hash = ?
      AND reset_token_expires_at > NOW()
      LIMIT 1
      `,
      [
        tokenHash
      ]
    );

    if (rows.length === 0) {

      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link."
      });

    }

    const userId = rows[0].user_id;
    const newPasswordHash =
      await bcrypt.hash(password, 10);

    await db.query(
      `
      UPDATE users
      SET
      password_hash=?,
      reset_token_hash=NULL,
      reset_token_expires_at=NULL
      WHERE user_id=?
      `,
      [
        newPasswordHash,
        userId
      ]
    );

    res.json({
      success: true,
      message:
        "Password updated successfully."
    });

  } catch (err) {
    console.error(
      "Reset password error:",
      err
    );

    res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
});

// ========================
// CHECK AUTH / LOGOUT
// ========================

app.get("/check-auth", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      loggedIn: false,
      user: null,
    });
  }

  return res.json({
    success: true,
    loggedIn: true,
    user: req.session.user, // includes role
  });
});

app.post("/ai-support/chat", async (req, res) => {
  const user = req.session.user;
  if (!user || !["producer", "admin"].includes(user.role)) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      success: false,
      message: "A message is required.",
    });
  }

  const validMessages = messages
    .filter((message) =>
      message &&
      ["user", "assistant"].includes(message.role) &&
      typeof message.content === "string" &&
      message.content.trim()
    )
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));

  if (!validMessages.length) {
    return res.status(400).json({
      success: false,
      message: "A valid message is required.",
    });
  }

  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${ollamaUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_SUPPORT_MODEL || "bonsai-2",
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You are the support assistant for the CMS content management system. Give concise, helpful guidance for producers and administrators. Do not claim to perform actions that require account access.",
          },
          ...validMessages,
        ],
      }),
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "The AI service returned an error.");
    }

    const content = data?.message?.content?.trim();
    if (!content) {
      throw new Error("The AI service returned an empty response.");
    }

    return res.json({ success: true, message: content });
  } catch (error) {
    console.error("AI support chat error:", error);
    const unavailable = error.name === "AbortError";
    return res.status(unavailable ? 504 : 502).json({
      success: false,
      message: unavailable
        ? "The AI assistant timed out. Please try again."
        : "The AI assistant is unavailable. Make sure Ollama is running and the configured model is installed.",
    });
  } finally {
    clearTimeout(timeout);
  }
});


// ========================
// ADMIN DASHBOARD
// ========================

app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  try {
    const [
      userResult,
      projectResult,
      monitorResult,
      recentProjectResult,
      recentUserResult,
      recentMonitorResult,
    ] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(role = 'producer'), 0) AS producers,
          COALESCE(SUM(role = 'admin'), 0) AS admins,
          COALESCE(
            SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)),
            0
          ) AS recent
        FROM users
      `),
      db.query(`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(status = 'draft'), 0) AS draft,
          COALESCE(SUM(status = 'published'), 0) AS published,
          COALESCE(SUM(status = 'archived'), 0) AS archived,
          COALESCE(SUM(category = 'environmental'), 0) AS environmental,
          COALESCE(SUM(category = 'social'), 0) AS social,
          COALESCE(SUM(category = 'governance'), 0) AS governance
        FROM projects
        WHERE is_template = FALSE
      `),
      db.query(`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(status = 'online'), 0) AS online,
          COALESCE(SUM(status = 'offline'), 0) AS offline,
          COALESCE(SUM(status = 'maintenance'), 0) AS maintenance
        FROM monitors
      `),
      db.query(`
        SELECT
          p.project_id,
          p.name,
          p.category,
          p.status,
          p.updated_at,
          u.username AS producer_username,
          COUNT(c.canvas_id) AS page_count
        FROM projects p
        JOIN users u
          ON p.user_id = u.user_id
        LEFT JOIN canvases c
          ON p.project_id = c.project_id
        WHERE p.is_template = FALSE
        GROUP BY
          p.project_id,
          p.name,
          p.category,
          p.status,
          p.updated_at,
          u.username
        ORDER BY p.updated_at DESC, p.project_id DESC
        LIMIT 5
      `),
      db.query(`
        SELECT
          user_id,
          username,
          email,
          role,
          created_at
        FROM users
        ORDER BY created_at DESC, user_id DESC
        LIMIT 5
      `),
      db.query(`
        SELECT
          monitor_id,
          monitor_name,
          monitor_category,
          location,
          status,
          last_connected_at
        FROM monitors
        ORDER BY
          FIELD(status, 'online', 'maintenance', 'offline'),
          COALESCE(last_connected_at, created_at) DESC,
          monitor_id DESC
        LIMIT 8
      `),
    ]);

    const users = userResult[0][0] || {};
    const projects = projectResult[0][0] || {};
    const monitors = monitorResult[0][0] || {};

    const asCount = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return res.json({
      success: true,
      user: {
        userId: req.session.user.user_id,
        username: req.session.user.username,
        role: req.session.user.role,
      },
      dashboard: {
        users: {
          total: asCount(users.total),
          producers: asCount(users.producers),
          admins: asCount(users.admins),
          recent: asCount(users.recent),
        },
        projects: {
          total: asCount(projects.total),
          draft: asCount(projects.draft),
          published: asCount(projects.published),
          archived: asCount(projects.archived),
          environmental: asCount(projects.environmental),
          social: asCount(projects.social),
          governance: asCount(projects.governance),
        },
        monitors: {
          total: asCount(monitors.total),
          online: asCount(monitors.online),
          offline: asCount(monitors.offline),
          maintenance: asCount(monitors.maintenance),
        },
        recentProjects: recentProjectResult[0].map((project) => ({
          projectId: project.project_id,
          name: project.name,
          producerUsername: project.producer_username,
          category: project.category,
          status: project.status,
          pageCount: asCount(project.page_count),
          updatedAt: project.updated_at,
        })),
        recentUsers: recentUserResult[0].map((user) => ({
          userId: user.user_id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.created_at,
        })),
        recentMonitors: recentMonitorResult[0].map((monitor) => ({
          monitorId: monitor.monitor_id,
          name: monitor.monitor_name,
          category: monitor.monitor_category,
          location: monitor.location,
          status: monitor.status,
          lastConnectedAt: monitor.last_connected_at,
        })),
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load the administrator dashboard.",
    });
  }
});

// ========================
// ADMIN USER MANAGEMENT
// ========================

const ADMIN_USER_ROLES = new Set(["admin", "producer"]);
const ADMIN_USER_SORTS = {
  newest: "u.created_at DESC",
  oldest: "u.created_at ASC",
  username_asc: "u.username ASC",
  username_desc: "u.username DESC",
  updated: "u.updated_at DESC",
};

function parsePositiveInteger(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normaliseUserInput(body = {}, { passwordRequired = false } = {}) {
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (username.length < 3 || username.length > 100) {
    return { error: "Username must be between 3 and 100 characters." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    return { error: "Please enter a valid email address." };
  }

  if (!ADMIN_USER_ROLES.has(role)) {
    return { error: "Role must be either administrator or producer." };
  }

  if (passwordRequired || password || confirmPassword) {
    if (password.length < 8 || password.length > 72) {
      return { error: "Password must be between 8 and 72 characters." };
    }

    if (password !== confirmPassword) {
      return { error: "Passwords do not match." };
    }
  }

  return { username, email, role, password };
}

function mapAdminUser(row) {
  return {
    userId: Number(row.user_id),
    username: row.username,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    projectCount: Number(row.project_count || 0),
    canvasCount: Number(row.canvas_count || 0),
    knowledgeBaseCount: Number(row.knowledge_base_count || 0),
  };
}

async function loadAdminUserSummary(connection = db) {
  const [[summary]] = await connection.query(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(role = 'admin'), 0) AS admins,
      COALESCE(SUM(role = 'producer'), 0) AS producers,
      COALESCE(
        SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)),
        0
      ) AS recent
    FROM users
  `);

  return {
    total: Number(summary?.total || 0),
    admins: Number(summary?.admins || 0),
    producers: Number(summary?.producers || 0),
    recent: Number(summary?.recent || 0),
  };
}

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const page = parsePositiveInteger(req.query.page, 1);
    const requestedLimit = parsePositiveInteger(req.query.limit, 10);
    const limit = [10, 20, 50].includes(requestedLimit) ? requestedLimit : 10;
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 255) : "";
    const role = typeof req.query.role === "string" ? req.query.role.trim().toLowerCase() : "";
    const sort = typeof req.query.sort === "string" ? req.query.sort.trim() : "newest";

    if (role && !ADMIN_USER_ROLES.has(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role filter.",
      });
    }

    const orderBy = ADMIN_USER_SORTS[sort] || ADMIN_USER_SORTS.newest;
    const conditions = [];
    const filterParams = [];

    if (search) {
      conditions.push("(u.username LIKE ? OR u.email LIKE ?)");
      const searchPattern = `%${search}%`;
      filterParams.push(searchPattern, searchPattern);
    }

    if (role) {
      conditions.push("u.role = ?");
      filterParams.push(role);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total_users FROM users u ${whereClause}`,
      filterParams
    );

    const totalUsers = Number(countRow?.total_users || 0);
    const totalPages = totalUsers === 0 ? 0 : Math.ceil(totalUsers / limit);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;

    const [users] = await db.query(
      `SELECT
         u.user_id,
         u.username,
         u.email,
         u.role,
         u.created_at,
         u.updated_at,
         COALESCE(project_stats.project_count, 0) AS project_count,
         COALESCE(canvas_stats.canvas_count, 0) AS canvas_count,
         COALESCE(knowledge_stats.knowledge_base_count, 0) AS knowledge_base_count
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS project_count
         FROM projects
         GROUP BY user_id
       ) project_stats ON project_stats.user_id = u.user_id
       LEFT JOIN (
         SELECT p.user_id, COUNT(c.canvas_id) AS canvas_count
         FROM projects p
         LEFT JOIN canvases c ON c.project_id = p.project_id
         GROUP BY p.user_id
       ) canvas_stats ON canvas_stats.user_id = u.user_id
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS knowledge_base_count
         FROM knowledge_base
         GROUP BY user_id
       ) knowledge_stats ON knowledge_stats.user_id = u.user_id
       ${whereClause}
       ORDER BY ${orderBy}, u.user_id DESC
       LIMIT ? OFFSET ?`,
      [...filterParams, limit, offset]
    );

    const summary = await loadAdminUserSummary();

    return res.json({
      success: true,
      users: users.map(mapAdminUser),
      summary,
      currentUser: {
        userId: Number(req.session.user.user_id),
        username: req.session.user.username,
        email: req.session.user.email,
        role: req.session.user.role,
      },
      pagination: {
        page: safePage,
        limit,
        totalUsers,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Admin users list error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load user accounts.",
    });
  }
});

app.get("/api/admin/users/summary", requireAdmin, async (req, res) => {
  try {
    return res.json({
      success: true,
      summary: await loadAdminUserSummary(),
    });
  } catch (error) {
    console.error("Admin users summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load user statistics.",
    });
  }
});

app.get("/api/admin/users/:userId", requireAdmin, async (req, res) => {
  try {
    const userId = parsePositiveInteger(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const [rows] = await db.query(
      `SELECT
         u.user_id,
         u.username,
         u.email,
         u.role,
         u.created_at,
         u.updated_at,
         (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.user_id) AS project_count,
         (
           SELECT COUNT(c.canvas_id)
           FROM projects p
           LEFT JOIN canvases c ON c.project_id = p.project_id
           WHERE p.user_id = u.user_id
         ) AS canvas_count,
         (
           SELECT COUNT(*)
           FROM knowledge_base kb
           WHERE kb.user_id = u.user_id
         ) AS knowledge_base_count
       FROM users u
       WHERE u.user_id = ?
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    return res.json({
      success: true,
      user: mapAdminUser(rows[0]),
    });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load user details.",
    });
  }
});

app.post("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const input = normaliseUserInput(req.body, { passwordRequired: true });

    if (input.error) {
      return res.status(400).json({ success: false, message: input.error });
    }

    const [duplicates] = await db.query(
      `SELECT user_id, username, email
       FROM users
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [input.username, input.email]
    );

    if (duplicates.length > 0) {
      const duplicate = duplicates[0];
      const message =
        duplicate.username.toLowerCase() === input.username.toLowerCase()
          ? "That username is already in use."
          : "That email address is already in use.";

      return res.status(409).json({ success: false, message });
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const [result] = await db.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      [input.username, input.email, passwordHash, input.role]
    );

    return res.status(201).json({
      success: true,
      message: "User account created successfully.",
      user: {
        userId: Number(result.insertId),
        username: input.username,
        email: input.email,
        role: input.role,
      },
    });
  } catch (error) {
    console.error("Admin create user error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "The username or email address is already in use.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create the user account.",
    });
  }
});

app.put("/api/admin/users/:userId", requireAdmin, async (req, res) => {
  const userId = parsePositiveInteger(req.params.userId);

  if (!userId) {
    return res.status(400).json({ success: false, message: "Invalid user ID." });
  }

  const input = normaliseUserInput(req.body);
  if (input.error) {
    return res.status(400).json({ success: false, message: input.error });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [targetRows] = await connection.query(
      `SELECT user_id, username, email, role
       FROM users
       WHERE user_id = ?
       FOR UPDATE`,
      [userId]
    );

    if (targetRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const target = targetRows[0];
    const currentUserId = Number(req.session.user.user_id);

    if (userId === currentUserId && target.role === "admin" && input.role !== "admin") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "You cannot demote your own administrator account.",
      });
    }

    const [duplicates] = await connection.query(
      `SELECT user_id, username, email
       FROM users
       WHERE (username = ? OR email = ?)
         AND user_id <> ?
       LIMIT 1`,
      [input.username, input.email, userId]
    );

    if (duplicates.length > 0) {
      await connection.rollback();
      const duplicate = duplicates[0];
      const message =
        duplicate.username.toLowerCase() === input.username.toLowerCase()
          ? "That username is already in use."
          : "That email address is already in use.";
      return res.status(409).json({ success: false, message });
    }

    if (target.role === "admin" && input.role !== "admin") {
      const [adminRows] = await connection.query(
        `SELECT user_id FROM users WHERE role = 'admin' FOR UPDATE`
      );

      if (adminRows.length <= 1) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: "The final administrator account cannot be removed or demoted.",
        });
      }
    }

    await connection.query(
      `UPDATE users
       SET username = ?, email = ?, role = ?
       WHERE user_id = ?`,
      [input.username, input.email, input.role, userId]
    );

    await connection.commit();

    if (userId === currentUserId) {
      req.session.user = {
        ...req.session.user,
        username: input.username,
        email: input.email,
        role: input.role,
      };
    }

    return res.json({
      success: true,
      message: "User account updated successfully.",
      user: {
        userId,
        username: input.username,
        email: input.email,
        role: input.role,
      },
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error("Admin update user error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "The username or email address is already in use.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update the user account.",
    });
  } finally {
    connection.release();
  }
});

app.put("/api/admin/users/:userId/password", requireAdmin, async (req, res) => {
  try {
    const userId = parsePositiveInteger(req.params.userId);

    if (!userId) {
      return res.status(400).json({ success: false, message: "Invalid user ID." });
    }

    const password = typeof req.body.password === "string" ? req.body.password : "";
    const confirmPassword =
      typeof req.body.confirmPassword === "string" ? req.body.confirmPassword : "";

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 72 characters.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const [users] = await db.query(
      `SELECT user_id FROM users WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(
      `UPDATE users
       SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL
       WHERE user_id = ?`,
      [passwordHash, userId]
    );

    return res.json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error("Admin reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to reset the password.",
    });
  }
});

app.delete("/api/admin/users/:userId", requireAdmin, async (req, res) => {
  const userId = parsePositiveInteger(req.params.userId);

  if (!userId) {
    return res.status(400).json({ success: false, message: "Invalid user ID." });
  }

  const currentUserId = Number(req.session.user.user_id);
  if (userId === currentUserId) {
    return res.status(409).json({
      success: false,
      message: "You cannot delete your own account.",
    });
  }

  const connection = await db.getConnection();
  const mediaPaths = new Set();

  try {
    await connection.beginTransaction();

    const [targetRows] = await connection.query(
      `SELECT user_id, username, email, role
       FROM users
       WHERE user_id = ?
       FOR UPDATE`,
      [userId]
    );

    if (targetRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const target = targetRows[0];

    if (target.role === "admin") {
      const [adminRows] = await connection.query(
        `SELECT user_id FROM users WHERE role = 'admin' FOR UPDATE`
      );

      if (adminRows.length <= 1) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: "The final administrator account cannot be removed or demoted.",
        });
      }
    }

    const [[impact]] = await connection.query(
      `SELECT
         (SELECT COUNT(*) FROM projects WHERE user_id = ?) AS project_count,
         (
           SELECT COUNT(c.canvas_id)
           FROM projects p
           LEFT JOIN canvases c ON c.project_id = p.project_id
           WHERE p.user_id = ?
         ) AS canvas_count,
         (SELECT COUNT(*) FROM knowledge_base WHERE user_id = ?) AS knowledge_base_count`,
      [userId, userId, userId]
    );

    const [projectRows] = await connection.query(
      `SELECT project_id FROM projects WHERE user_id = ?`,
      [userId]
    );

    for (const project of projectRows) {
      const projectPaths = await getProjectMediaPaths(connection, project.project_id);
      for (const uploadPath of projectPaths) mediaPaths.add(uploadPath);
    }

    await connection.query(`DELETE FROM users WHERE user_id = ?`, [userId]);
    await connection.commit();

    await Promise.all([...mediaPaths].map(removeUploadIfUnreferenced));

    return res.json({
      success: true,
      message: "User account deleted successfully.",
      deletedUser: {
        userId,
        username: target.username,
        email: target.email,
        role: target.role,
      },
      deletedRelatedRecords: {
        projects: Number(impact?.project_count || 0),
        canvases: Number(impact?.canvas_count || 0),
        knowledgeBaseFiles: Number(impact?.knowledge_base_count || 0),
      },
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error("Admin delete user error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete the user account.",
    });
  } finally {
    connection.release();
  }
});


app.get("/api/projects", requireAdmin, async (req, res) => {
  try {
    const [projects] = await db.query(`
      SELECT
        p.project_id,
        p.name,
        p.description,
        p.category,
        p.status,
        p.updated_at,
        u.username AS owner
      FROM projects p
      JOIN users u
        ON p.user_id = u.user_id
      WHERE p.status = 'published'
      ORDER BY p.updated_at DESC
    `);

    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to load projects",
    });
  }
});

app.get("/api/preview/projects", requireAuth, async (req, res) => {
  try {
    const categoryFilter =
      typeof req.query.category === "string"
        ? req.query.category.toLowerCase()
        : null;
 
    if (categoryFilter && !VALID_CATEGORIES.has(categoryFilter)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category.",
      });
    }
 
    // 1) Published projects (optionally narrowed to one category), all users.
    //    To preview ONLY the logged-in user's work, add:  AND p.user_id = ?
    //    and push req.session.user.user_id into projectParams.
    //    To include drafts, drop the  AND p.status = 'published'  line.
    const projectParams = [];
    let categoryClause = "";
 
    if (categoryFilter) {
      categoryClause = "AND p.category = ?";
      projectParams.push(categoryFilter);
    }
 
    const [projects] = await db.query(
      `SELECT
         p.project_id,
         p.name,
         p.description,
         p.category,
         p.status,
         p.updated_at
       FROM projects p
       WHERE p.is_template = FALSE
         AND p.status = 'published'
         ${categoryClause}
       ORDER BY p.updated_at DESC`,
      projectParams
    );
 
    if (projects.length === 0) {
      return res.json({ success: true, projects: [] });
    }
 
    const projectIds = projects.map((project) => project.project_id);
    const projectPlaceholders = projectIds.map(() => "?").join(",");
 
    // 2) Every canvas (page) belonging to those projects, in display order.
    const [canvases] = await db.query(
      `
        SELECT
            c.canvas_id,
            c.project_id,
            c.name,
            c.canvas_order,
            c.width,
            c.height,
            c.background_color,
            c.background_image_path,

            COALESCE(mpp.duration_seconds, 10) AS duration_seconds

        FROM canvases c

        LEFT JOIN monitor_playlist_items mpi
            ON c.project_id = mpi.project_id

        LEFT JOIN monitor_playlist_pages mpp
            ON mpi.playlist_item_id = mpp.playlist_item_id
            AND c.canvas_id = mpp.canvas_id

        WHERE c.project_id IN (${projectPlaceholders})

        ORDER BY 
            c.canvas_order ASC,
            c.canvas_id ASC
        `,
      projectIds
    );

    const canvasIds = canvases.map((canvas) => canvas.canvas_id);
 
    // 3) Every component for those canvases, split into widgets vs background.
    let componentsByCanvasId = new Map();
    let backgroundSettingsByCanvasId = new Map();
    let transitionSettingsByCanvasId = new Map();

    if (canvasIds.length > 0) {
      const canvasPlaceholders = canvasIds.map(() => "?").join(",");
      const [components] = await db.query(
        `SELECT
           component_id,
           canvas_id,
           type,
           content_text,
           file_path,
           external_url,
           position_x,
           position_y,
           width,
           height,
           rotation,
           layer_order,
           style_json
         FROM components
         WHERE canvas_id IN (${canvasPlaceholders})
         ORDER BY layer_order ASC, component_id ASC`,
        canvasIds
      );

      ({ componentsByCanvasId, backgroundSettingsByCanvasId, transitionSettingsByCanvasId } =
        splitCanvasRows(components));
    }

    // Group canvases under their project for assembly.
    const canvasesByProjectId = new Map();
    for (const canvas of canvases) {
      const list = canvasesByProjectId.get(canvas.project_id) || [];
      list.push(canvas);
      canvasesByProjectId.set(canvas.project_id, list);
    }

    const responseProjects = projects.map((project) => ({
      projectId: project.project_id,
      name: project.name,
      description: project.description,
      category: project.category,
      pages: (canvasesByProjectId.get(project.project_id) || []).map((canvas) =>
        mapCanvasRow(
          canvas,
          componentsByCanvasId.get(canvas.canvas_id) || [],
          backgroundSettingsByCanvasId.get(canvas.canvas_id) || {},
          transitionSettingsByCanvasId.get(canvas.canvas_id) || {}
        )
      ),
    }));
 
    return res.json({ success: true, projects: responseProjects });
  } catch (err) {
    console.error("Preview projects error:", err);
    return res.status(500).json({
      success: false,
      message: "Unable to load preview projects.",
    });
  }
});


app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");

    res.json({
      success: true,
      message: "Logged out successfully.",
    });
  });
});

// ========================
// MEDIA UPLOADS
// ========================

app.post(
  "/api/uploads/images",
  requireAuth,
  createUploadMiddleware("images", "files", true),
  (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: "Select at least one image." });
    }

    return res.status(201).json({
      success: true,
      files: files.map((file) => ({
        path: getUploadedPublicPath("images", req.session.user.user_id, file),
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      })),
    });
  }
);

app.post(
  "/api/uploads/videos",
  requireAuth,
  createUploadMiddleware("videos", "file", false),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Select a video file." });
    }

    return res.status(201).json({
      success: true,
      file: {
        path: getUploadedPublicPath("videos", req.session.user.user_id, req.file),
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  }
);

app.post(
  "/api/uploads/backgrounds",
  requireAuth,
  createUploadMiddleware("backgrounds", "file", false),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Select a background image.",
      });
    }

    return res.status(201).json({
      success: true,
      file: {
        path: getUploadedPublicPath(
          "backgrounds",
          req.session.user.user_id,
          req.file
        ),
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  }
);

app.post(
  "/api/profile/avatar",
  requireAuth,
  createUploadMiddleware("avatars", "file", false),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "Select an image." });
      }
      const userId = req.session.user.user_id;
      const avatarPath = getUploadedPublicPath("avatars", userId, req.file);
      await db.query(`UPDATE users SET avatar_path = ? WHERE user_id = ?`, [avatarPath, userId]);
      req.session.user.avatar_path = avatarPath;
      return res.json({ success: true, avatarPath });
    } catch (err) {
      console.error("Avatar upload error:", err);
      return res.status(500).json({ success: false, message: "Unable to upload avatar." });
    }
  }
);

app.delete("/api/uploads", requireAuth, async (req, res) => {
  try {
    const uploadPath = cleanUploadPath(req.body.path);
    if (!uploadPath) {
      return res.status(400).json({ success: false, message: "Invalid upload path." });
    }

    const pathParts = uploadPath.split("/").filter(Boolean);
    if (pathParts.length < 4 || pathParts[2] !== String(req.session.user.user_id)) {
      return res.status(403).json({
        success: false,
        message: "You cannot remove this uploaded file.",
      });
    }

    const removed = await removeUploadIfUnreferenced(uploadPath);
    if (!removed) {
      return res.status(409).json({
        success: false,
        message: "The file is still in use or could not be removed.",
      });
    }

    return res.json({ success: true, message: "Uploaded file removed." });
  } catch (error) {
    console.error("Delete upload error:", error);
    return res.status(500).json({ success: false, message: "Unable to remove the file." });
  }
});

app.post(
  "/api/knowledge-base",
  requireAuth,
  createUploadMiddleware("documents", "file", false),
  async (req, res) => {
    try {
      const userId = req.session.user.user_id;
      const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
      const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
      const category = typeof req.body.category === "string" ? req.body.category.trim() : "general";

      if (!title || !content) {
        return res.status(400).json({
          success: false,
          message: "Title and content are required.",
        });
      }

      const file = req.file || null;
      let fileType = null;

      if (file) {
        if (file.mimetype.startsWith("image/")) {
          fileType = "image";
        } else {
          fileType = "file";
        }
      }
      const filePath = file ? getUploadedPublicPath("documents", userId, file) : null;
      const fileSize = file ? file.size : null;

      const [result] = await db.query(
        `INSERT INTO knowledge_base
          (user_id, title, content, category,
          created_at, updated_at,
          file_type, file_path, file_size)
          VALUES (?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)`,
        [userId, title, content, category || "environmental", fileType, filePath, fileSize]
      );

      const [rows] = await db.query(
        `SELECT
           article_id AS articleId,
           user_id AS userId,
           title,
           content,
           category,
           created_at AS createdAt,
           updated_at AS updatedAt,
           file_type AS fileType,
           file_path AS filePath,
           file_size AS fileSize
         FROM knowledge_base
         WHERE article_id = ?
         LIMIT 1`,
        [result.insertId]
      );

      return res.status(201).json({
        success: true,
        article: rows[0] || null,
      });
    } catch (error) {
      console.error("Knowledge base create error:", error);
      return res.status(500).json({
        success: false,
        message: error.sqlMessage || "Unable to save the knowledge base article.",
      });
    }
  }
);

app.get("/api/knowledge-base", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.user_id;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";

    const conditions = ["user_id = ?"];
    const params = [userId];

    if (search) {
      conditions.push("(title LIKE ? OR content LIKE ? OR category LIKE ?)");
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    if (category) {
      conditions.push("category = ?");
      params.push(category);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT
        article_id AS articleId,
        user_id AS userId,
        title,
        content,
        category,
        created_at AS createdAt,
        updated_at AS updatedAt,
        file_type AS fileType,
        file_path AS filePath,
        file_size AS fileSize
      FROM knowledge_base
       ${whereClause}
       ORDER BY created_at DESC, article_id DESC`,
      params
    );

    return res.json({
      success: true,
      articles: rows,
    });
  } catch (error) {
    console.error("Knowledge base list error:", error);
    return res.status(500).json({
      success: false,
      message: error.sqlMessage || "Unable to load knowledge base articles.",
    });
  }
});

app.delete(
  "/api/knowledge-base/:id",
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.session.user.user_id;
      const articleId = req.params.id;

      const [rows] = await db.query(
        `
        SELECT file_path
        FROM knowledge_base
        WHERE article_id = ?
        AND user_id = ?
        LIMIT 1
        `,
        [articleId, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Article not found.",
        });
      }

      await db.query(
        `
        DELETE FROM knowledge_base
        WHERE article_id = ?
        AND user_id = ?
        `,
        [articleId, userId]
      );

      res.json({
        success: true,
        message: "Article deleted.",
      });
    } catch (error) {
      console.error("Delete KB article error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to delete article.",
      });
    }
  }
);

// ========================
// CANVAS PROJECTS
// Existing database mapping:
// projects = one canvas project
// canvases = the project's pages/slides
// components = content inside each page
// ========================

app.get("/api/canvases", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.user_id;

    const [projects] = await db.query(
    `SELECT
      p.project_id, p.name, p.description, p.category, p.status, p.updated_at,
      (p.user_id = ?) AS is_owner,
      u.username AS owner_name,
      MAX(CASE WHEN pc.user_id = ? THEN pc.role END) AS my_collab_role,
      COUNT(DISTINCT c.canvas_id) AS page_count,
      (
        SELECT c2.canvas_id
        FROM canvases c2
        WHERE c2.project_id = p.project_id
        ORDER BY c2.canvas_order ASC, c2.canvas_id ASC
        LIMIT 1
      ) AS first_canvas_id
    FROM projects p
    JOIN users u ON u.user_id = p.user_id
    LEFT JOIN canvases c ON c.project_id = p.project_id
    LEFT JOIN project_collaborators pc ON pc.project_id = p.project_id
    WHERE (p.user_id = ? OR pc.user_id = ?) AND p.is_template = FALSE
    GROUP BY p.project_id, p.name, p.description, p.category, p.status, p.updated_at, u.username
    ORDER BY p.updated_at DESC`,
    [userId, userId, userId, userId]
  );

    const firstCanvasIds = projects
      .map((project) => project.first_canvas_id)
      .filter(Boolean);

    const previewCanvasById = new Map();
    let componentsByCanvasId = new Map();
    let backgroundSettingsByCanvasId = new Map();
    let transitionSettingsByCanvasId = new Map();

    if (firstCanvasIds.length > 0) {
      const placeholders = firstCanvasIds.map(() => "?").join(",");

      const [previewCanvases] = await db.query(
        `SELECT canvas_id, project_id, name, canvas_order, width, height,
                background_color, background_image_path
         FROM canvases
         WHERE canvas_id IN (${placeholders})`,
        firstCanvasIds
      );

      for (const canvas of previewCanvases) {
        previewCanvasById.set(canvas.canvas_id, canvas);
      }

      const [previewComponents] = await db.query(
        `SELECT component_id, canvas_id, type, content_text, file_path, external_url,
                position_x, position_y, width, height, rotation, layer_order, style_json
         FROM components
         WHERE canvas_id IN (${placeholders})
         ORDER BY layer_order ASC, component_id ASC`,
        firstCanvasIds
      );

      ({ componentsByCanvasId, backgroundSettingsByCanvasId, transitionSettingsByCanvasId } = splitCanvasRows(
        previewComponents
      ));
    }

    const responseProjects = projects.map((project) => {
      const previewCanvas = previewCanvasById.get(project.first_canvas_id);

    return {
            projectId: project.project_id,
            name: project.name,
            description: project.description,
            category: project.category,
            status: project.status,
            isOwner: Boolean(project.is_owner),
            ownerName: project.owner_name,
            myRole: project.is_owner ? "owner" : (project.my_collab_role || "viewer"),
            pageCount: Number(project.page_count || 0),
            updatedAt: project.updated_at,
            previewPage: previewCanvas
              ? mapCanvasRow(
                previewCanvas,
                componentsByCanvasId.get(previewCanvas.canvas_id) || [],
                backgroundSettingsByCanvasId.get(previewCanvas.canvas_id) || {},
                transitionSettingsByCanvasId.get(previewCanvas.canvas_id) || {}
              )
              : null,
          };
        });

    return res.json({
      success: true,
      projects: responseProjects,
    });
  } catch (err) {
    console.error("List canvases error:", err);
    return res.status(500).json({
      success: false,
      message: "Unable to load canvas projects.",
    });
  }
});

app.get("/api/canvases/:id", requireProjectAccess("viewer"), async (req, res) => {
  try {
    const projectId = Number.parseInt(req.params.id, 10);

    const [projects] = await db.query(
      `SELECT project_id, name, description, category, status, created_at, updated_at
       FROM projects
       WHERE project_id = ? AND is_template = FALSE
       LIMIT 1`,
      [projectId]
    );

    if (projects.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Canvas project not found.",
      });
    }

    const [canvases] = await db.query(
      `SELECT canvas_id, project_id, name, canvas_order, width, height,
              background_color, background_image_path
       FROM canvases
       WHERE project_id = ?
       ORDER BY canvas_order ASC, canvas_id ASC`,
      [projectId]
    );

    const canvasIds = canvases.map((canvas) => canvas.canvas_id);
    let componentsByCanvasId = new Map();
    let backgroundSettingsByCanvasId = new Map();
    let transitionSettingsByCanvasId = new Map();

    if (canvasIds.length > 0) {
      const placeholders = canvasIds.map(() => "?").join(",");
      const [components] = await db.query(
        `SELECT component_id, canvas_id, type, content_text, file_path, external_url,
                position_x, position_y, width, height, rotation, layer_order, style_json
         FROM components
         WHERE canvas_id IN (${placeholders})
         ORDER BY layer_order ASC, component_id ASC`,
        canvasIds
      );

      ({ componentsByCanvasId, backgroundSettingsByCanvasId, transitionSettingsByCanvasId } = splitCanvasRows(
        components
      ));
    }

    const project = projects[0];

    return res.json({
      success: true,
      role: req.projectRole,
      project: {
        projectId: project.project_id,
        name: project.name,
        description: project.description,
        category: project.category,
        status: project.status,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        pages: canvases.map((canvas) =>
          mapCanvasRow(
            canvas,
            componentsByCanvasId.get(canvas.canvas_id) || [],
            backgroundSettingsByCanvasId.get(canvas.canvas_id) || {},
            transitionSettingsByCanvasId.get(canvas.canvas_id) || {}
          )
        ),
      },
    });
  } catch (err) {
    console.error("Get canvas error:", err);
    return res.status(500).json({
      success: false,
      message: "Unable to load the canvas project.",
    });
  }
});

app.post("/api/canvases", requireAuth, async (req, res) => {
  const validationError = validateProjectPayload(req.body);
  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError,
    });
  }

  const connection = await db.getConnection();

  try {
    const userId = req.session.user.user_id;
    const name = req.body.name.trim();
    const description = req.body.description.trim();
    const category = req.body.category.toLowerCase();

    await connection.beginTransaction();

    const [projectResult] = await connection.query(
      `INSERT INTO projects
        (user_id, name, description, category, status, thumbnail_path,
         is_template, created_from_template_id)
       VALUES (?, ?, ?, ?, 'draft', NULL, FALSE, NULL)`,
      [userId, name, description, category]
    );

    await insertPages(connection, projectResult.insertId, req.body.pages);
    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Canvas project created successfully.",
      projectId: projectResult.insertId,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Create canvas error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to save the canvas project.",
    });
  } finally {
    connection.release();
  }
});

app.put("/api/canvases/:id", requireProjectAccess("editor"), async (req, res) => {
  const projectId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid canvas project ID.",
    });
  }

  const validationError = validateProjectPayload(req.body);
  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError,
    });
  }

  const connection = await db.getConnection();
  let oldMediaPaths = new Set();

  try {
    const userId = req.session.user.user_id;

    await connection.beginTransaction();

    const [ownedProjects] = await connection.query(
      `SELECT project_id
      FROM projects
      WHERE project_id = ? AND is_template = FALSE
      LIMIT 1
      FOR UPDATE`,
      [projectId]
    );

    if (ownedProjects.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Canvas project not found.",
      });
    }

    oldMediaPaths = await getProjectMediaPaths(connection, projectId);

    await connection.query(
      `UPDATE projects
        SET
            name = ?,
            description = ?,
            category = ?,
            updated_at = NOW()
        WHERE project_id = ?`,
      [
        req.body.name.trim(),
        req.body.description.trim(),
        req.body.category.toLowerCase(),
        projectId,
      ]
    );

    // Replacing page and component rows inside one transaction keeps page order,
    // background metadata and widget data consistent. Child component rows are
    // removed by the existing ON DELETE CASCADE foreign key.
    await connection.query("DELETE FROM canvases WHERE project_id = ?", [projectId]);
    await insertPages(connection, projectId, req.body.pages);

    await connection.commit();

    const newMediaPaths = collectMediaPathsFromPages(req.body.pages);
    cleanupRemovedMedia(oldMediaPaths, newMediaPaths).catch((error) => {
      console.error("Post-save media cleanup error:", error);
    });

    return res.json({
      success: true,
      message: "Canvas project updated successfully.",
      projectId,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Update canvas error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to update the canvas project.",
    });
  } finally {
    connection.release();
  }
});

// ========================
// PUBLISH PROJECT
// ========================
app.post("/api/canvases/:id/publish", requireAuth, async (req, res) => {
  try {
    const projectId = Number.parseInt(req.params.id, 10);
    const userId = req.session.user.user_id;

    const [rows] = await db.query(
      `SELECT project_id, status
       FROM projects
       WHERE project_id = ? AND user_id = ?
       LIMIT 1`,
      [projectId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    const currentStatus = rows[0].status;

    const newStatus =
      currentStatus === "published"
        ? "draft"
        : "published";

    await db.query(
      `UPDATE projects
       SET status = ?, updated_at = NOW()
       WHERE project_id = ?`,
      [newStatus, projectId]
    );

    res.json({
      success: true,
      status: newStatus,
      message:
        newStatus === "published"
          ? "Project published successfully."
          : "Project unpublished successfully.",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to update project status.",
    });
  }
});

// ========================
// DELETE PROJECT
// ========================
app.delete("/api/canvases/:id", requireAuth, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const projectId = Number.parseInt(req.params.id, 10);
    const userId = req.session.user.user_id;

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid canvas project ID.",
      });
    }

    await connection.beginTransaction();

    // 🔒 Check ownership first
    const [rows] = await connection.query(
      `SELECT project_id FROM projects WHERE project_id = ? AND user_id = ? LIMIT 1`,
      [projectId, userId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    await connection.query(`DELETE FROM components WHERE canvas_id IN (
      SELECT canvas_id FROM canvases WHERE project_id = ?
    )`, [projectId]);

    await connection.query(`DELETE FROM canvases WHERE project_id = ?`, [
      projectId,
    ]);

    await connection.query(`DELETE FROM projects WHERE project_id = ?`, [
      projectId,
    ]);

    await connection.commit();

    return res.json({
      success: true,
      message: "Canvas project deleted successfully.",
      projectId,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Delete canvas error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to delete canvas project.",
    });
  } finally {
    connection.release();
  }
});


// ========================
// GET CURRENT USER
// ========================

app.get("/api/user", requireAuth, async (req, res) => {
  try {
    // Read fresh from the database instead of trusting the session snapshot
    // taken at login — email/verification status can change while logged in
    // (e.g. via the email-verification link, which may be opened elsewhere).
    const [rows] = await db.query(
      `SELECT user_id, username, email, role, avatar_path, email_verified
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [req.session.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    const freshUser = rows[0];

    req.session.user.username = freshUser.username;
    req.session.user.email = freshUser.email;
    req.session.user.role = freshUser.role;
    req.session.user.avatar_path = freshUser.avatar_path || null;
    req.session.user.email_verified = Boolean(freshUser.email_verified);

    res.json({
      success: true,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ success: false, message: "Server error while loading account." });
  }
});

// ========================
// VERIFY EMAIL
// ========================

// Public — the user may click this link from their inbox before ever logging in.
app.get("/api/verify-email", async (req, res) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";

    if (!token) {
      return res.status(400).json({ success: false, message: "Missing verification token." });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const [rows] = await db.query(
      `SELECT user_id, email, pending_email, email_verification_expires_at
       FROM users
       WHERE email_verification_token_hash = ?
       LIMIT 1`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "This verification link is invalid or has already been used.",
      });
    }

    const record = rows[0];
    const expiresAt = record.email_verification_expires_at ? new Date(record.email_verification_expires_at) : null;

    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "This verification link has expired. Please request a new one.",
      });
    }

    const resultEmail = record.pending_email || record.email;

    await db.query(
      `UPDATE users
       SET email = ?, pending_email = NULL, email_verified = 1,
           email_verification_token_hash = NULL, email_verification_expires_at = NULL
       WHERE user_id = ?`,
      [resultEmail, record.user_id]
    );

    // Keep the current tab in sync if this link was opened in the same logged-in session.
    if (req.session.user && Number(req.session.user.user_id) === Number(record.user_id)) {
      req.session.user.email = resultEmail;
      req.session.user.email_verified = true;
    }

    return res.json({
      success: true,
      message: record.pending_email
        ? "Your new email address has been verified."
        : "Your email address has been verified.",
      email: resultEmail,
    });
  } catch (err) {
    console.error("Verify email error:", err);
    return res.status(500).json({ success: false, message: "Server error while verifying email." });
  }
});

// Resend a verification link for either the account's own email (if unverified)
// or a pending email-change request, whichever applies.
app.post("/api/resend-verification", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.user_id;

    const [rows] = await db.query(
      `SELECT email, pending_email, email_verified FROM users WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    const { email, pending_email: pendingEmail, email_verified: emailVerified } = rows[0];

    if (!pendingEmail && emailVerified) {
      return res.status(400).json({ success: false, message: "Your email is already verified." });
    }

    const { token, tokenHash, expiresAt } = createEmailVerificationToken();

    await db.query(
      `UPDATE users
       SET email_verification_token_hash = ?, email_verification_expires_at = ?
       WHERE user_id = ?`,
      [tokenHash, expiresAt, userId]
    );

    const targetEmail = pendingEmail || email;
    if (pendingEmail) {
      await sendEmailChangeVerificationEmail(targetEmail, token);
    } else {
      await sendSignupVerificationEmail(targetEmail, token);
    }

    return res.json({
      success: true,
      message: `Verification email sent to ${targetEmail}.`,
    });
  } catch (err) {
    console.error("Resend verification error:", err);
    return res.status(500).json({ success: false, message: "Unable to resend verification email." });
  }
});

// ========================
// PROFILE: REQUEST EMAIL CHANGE
// ========================

app.post("/api/profile/request-email-change", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.user_id;
    const newEmail = typeof req.body.newEmail === "string" ? req.body.newEmail.trim() : "";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    const [[currentUser]] = await db.query(
      `SELECT email FROM users WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    if (currentUser && currentUser.email.toLowerCase() === newEmail.toLowerCase()) {
      return res.status(400).json({ success: false, message: "That is already your current email address." });
    }

    const [existing] = await db.query(
      `SELECT user_id FROM users WHERE email = ? AND user_id != ? LIMIT 1`,
      [newEmail, userId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "That email address is already in use." });
    }

    const { token, tokenHash, expiresAt } = createEmailVerificationToken();

    await db.query(
      `UPDATE users
       SET pending_email = ?, email_verification_token_hash = ?, email_verification_expires_at = ?
       WHERE user_id = ?`,
      [newEmail, tokenHash, expiresAt, userId]
    );

    await sendEmailChangeVerificationEmail(newEmail, token);

    return res.json({
      success: true,
      message: `Verification email sent to ${newEmail}. Click the link there to confirm the change.`,
    });
  } catch (err) {
    console.error("Request email change error:", err);
    return res.status(500).json({ success: false, message: "Unable to start the email change." });
  }
});

// ========================
// GET IP ADDRESS
// ========================

app.get("/api/admin/client-ip", (req, res) => {
    const interfaces = os.networkInterfaces();

    let localIP = "Unknown";

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (
                iface.family === "IPv4" &&
                !iface.internal
            ) {
                localIP = iface.address;
                break;
            }
        }

        if (localIP !== "Unknown") break;
    }

    res.json({
        success: true,
        ip: localIP
    });
});

// ========================
// TEST ROUTE
// ========================

app.get("/", (req, res) => {
  res.send("Backend server is running");
});

// ========================
// DISPLAY / MONITOR ROUTES
// ========================

function generatePairingCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

// Get all monitors with playlist summary
app.get("/monitors", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        m.monitor_id,
        m.monitor_name,
        m.monitor_key,
        m.pairing_code,
        m.monitor_category,
        m.location,
        m.status,
        m.last_connected_at,

        COUNT(mpi.playlist_item_id) AS playlist_count,

        GROUP_CONCAT(
          p.name
          ORDER BY mpi.display_order
          SEPARATOR ', '
        ) AS assigned_projects

      FROM monitors m

      LEFT JOIN monitor_playlist_items mpi
        ON m.monitor_id = mpi.monitor_id
        AND mpi.is_active = TRUE

      LEFT JOIN projects p
        ON mpi.project_id = p.project_id

      GROUP BY
        m.monitor_id,
        m.monitor_name,
        m.monitor_key,
        m.pairing_code,
        m.monitor_category,
        m.location,
        m.status,
        m.last_connected_at

      ORDER BY 
        FIELD(m.monitor_category, 'environmental', 'governance', 'social'),
        m.monitor_id
    `);

    return res.json({
      success: true,
      monitors: rows,
    });
  } catch (err) {
    console.error("Get monitors error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error while getting monitors.",
    });
  }
});

// Create new monitor/display
app.post("/monitors", requireAdmin, async (req, res) => {
  try {
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required.",
      });
    }

    if (!["environmental", "governance", "social"].includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category.",
      });
    }

    const [countRows] = await db.query(
      "SELECT COUNT(*) AS total FROM monitors WHERE monitor_category = ?",
      [category]
    );

    const nextNumber = countRows[0].total + 1;

    const monitorName = `${category}_monitor_${nextNumber}`;
    const monitorKey = monitorName;
    const pairingCode = generatePairingCode();

    await db.query(
      `
      INSERT INTO monitors 
      (monitor_name, monitor_key, pairing_code, pairing_expires_at,
       monitor_category, location, status, is_paired)
      VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR), ?, ?, ?, FALSE)
      `,
      [
        monitorName,
        monitorKey,
        pairingCode,
        category,
        `${category} Display Area`,
        "offline",
      ]
    );

    return res.json({
      success: true,
      message: "Display created successfully.",
    });
  } catch (err) {
    console.error("Create monitor error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error while creating monitor.",
    });
  }
});

// Get published projects for playlist modal
app.get("/api/display-manager/projects", requireAdmin, async (req, res) => {
  try {
    const { category } = req.query;

    if (!category || !["environmental", "governance", "social"].includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Valid category is required.",
      });
    }

    const [projects] = await db.query(
      `
      SELECT
        p.project_id,
        p.name,
        p.description,
        p.category,
        p.status,
        
        COUNT(c.canvas_id) AS page_count,

        JSON_ARRAYAGG(
          JSON_OBJECT(
            'canvas_id', c.canvas_id,
            'canvas_order', c.canvas_order,
            'name', c.name
          )
        ) AS pages,
        mpi.monitor_id AS assigned_monitor_id,
        m.monitor_name AS assigned_monitor_name
      FROM projects p

      LEFT JOIN canvases c
        ON p.project_id = c.project_id

      LEFT JOIN monitor_playlist_items mpi
        ON p.project_id = mpi.project_id
        AND mpi.is_active = TRUE

      LEFT JOIN monitors m
        ON mpi.monitor_id = m.monitor_id

      WHERE p.is_template = FALSE
        AND p.status = 'published'
        AND p.category = ?

      GROUP BY
        p.project_id,
        p.name,
        p.description,
        p.category,
        p.status,
        mpi.monitor_id,
        m.monitor_name

      ORDER BY p.updated_at DESC
      `,
      [category]
    );

    // Convert JSON string to object
    const formattedProjects = projects.map((project) => {

      let pages = [];

      if (project.pages) {
        pages = typeof project.pages === "string"
          ? JSON.parse(project.pages)
          : project.pages;
      }


      // Remove empty pages caused by LEFT JOIN
      pages = pages.filter(
        (page) => page.canvas_id !== null
      );


      return {
        ...project,
        pages
      };

    });

    return res.json({
      success: true,
      projects: formattedProjects,
    });
  } catch (err) {
    console.error("Get display manager projects error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to load projects.",
    });
  }
});


// Get one monitor playlist
app.get("/api/monitors/:monitorId/playlist", requireAdmin, async (req, res) => {
  try {
    const monitorId = Number.parseInt(req.params.monitorId, 10);

    if (!Number.isInteger(monitorId) || monitorId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid monitor ID.",
      });
    }

    const [monitorRows] = await db.query(
      `
      SELECT monitor_id, monitor_name, monitor_category
      FROM monitors
      WHERE monitor_id = ?
      LIMIT 1
      `,
      [monitorId]
    );

    if (monitorRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found.",
      });
    }

    const [playlist] = await db.query(
      `
      SELECT
        mpi.playlist_item_id,
        mpi.monitor_id,
        mpi.project_id,
        mpi.display_order,
        mpi.project_loop_count,
        mpi.slide_duration_seconds,
        p.name,
        p.description,
        p.category,
        p.status,
        COUNT(c.canvas_id) AS page_count
      FROM monitor_playlist_items mpi
      JOIN projects p
        ON mpi.project_id = p.project_id
      LEFT JOIN canvases c
        ON p.project_id = c.project_id
      WHERE mpi.monitor_id = ?
        AND mpi.is_active = TRUE
      GROUP BY
        mpi.playlist_item_id,
        mpi.monitor_id,
        mpi.project_id,
        mpi.display_order,
        mpi.project_loop_count,
        mpi.slide_duration_seconds,
        p.name,
        p.description,
        p.category,
        p.status
      ORDER BY mpi.display_order ASC
      `,
      [monitorId]
    );

    for (const item of playlist) {

      const [pages] = await db.query(
        `
    SELECT
        mpp.playlist_page_id,
        mpp.canvas_id,
        mpp.page_order,
        mpp.duration_seconds,
        c.name
    FROM monitor_playlist_pages mpp
    JOIN canvases c
        ON mpp.canvas_id = c.canvas_id
    WHERE mpp.playlist_item_id = ?
    ORDER BY mpp.page_order ASC
    `,
        [item.playlist_item_id]
      );

      item.pages = pages;

    }

    return res.json({
      success: true,
      monitor: monitorRows[0],
      playlist,
    });
  } catch (err) {
    console.error("Get playlist error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to load monitor playlist.",
    });
  }
});

// Save monitor playlist
app.put("/api/monitors/:monitorId/playlist", requireAdmin, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const monitorId = Number.parseInt(req.params.monitorId, 10);
    const { items } = req.body;

    if (!Number.isInteger(monitorId) || monitorId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid monitor ID.",
      });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "Playlist items must be an array.",
      });
    }

    await connection.beginTransaction();

    const [monitorRows] = await connection.query(
      `
      SELECT monitor_id, monitor_category
      FROM monitors
      WHERE monitor_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [monitorId]
    );

    if (monitorRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Monitor not found.",
      });
    }

    const monitor = monitorRows[0];

    const projectIds = items.map((item) => Number.parseInt(item.projectId, 10));

    const hasInvalidProjectId = projectIds.some(
      (id) => !Number.isInteger(id) || id <= 0
    );

    if (hasInvalidProjectId) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid project selected.",
      });
    }

    const uniqueProjectIds = [...new Set(projectIds)];

    if (uniqueProjectIds.length !== projectIds.length) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Same project cannot be added twice to the same playlist.",
      });
    }

    if (uniqueProjectIds.length > 0) {
      const placeholders = uniqueProjectIds.map(() => "?").join(",");

      const [projectRows] = await connection.query(
        `
        SELECT project_id, category, status, is_template
        FROM projects
        WHERE project_id IN (${placeholders})
        `,
        uniqueProjectIds
      );

      if (projectRows.length !== uniqueProjectIds.length) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: "One or more projects were not found.",
        });
      }

      for (const project of projectRows) {
        if (project.is_template) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: "Template projects cannot be assigned to displays.",
          });
        }

        if (project.status !== "published") {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: "Only published projects can be added to a playlist.",
          });
        }

        if (project.category !== monitor.monitor_category) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: "Project category must match the monitor category.",
          });
        }
      }
    }

    // Prevent project from being used by another monitor
    if (uniqueProjectIds.length > 0) {
      const placeholders = uniqueProjectIds.map(() => "?").join(",");

      const [existingAssignments] = await connection.query(
        `
    SELECT
      mpi.project_id,
      m.monitor_name
    FROM monitor_playlist_items mpi
    JOIN monitors m
      ON mpi.monitor_id = m.monitor_id
    WHERE mpi.project_id IN (${placeholders})
      AND mpi.monitor_id <> ?
      AND mpi.is_active = TRUE
    LIMIT 1
    `,
        [...uniqueProjectIds, monitorId]
      );

      if (existingAssignments.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: `This project is already assigned to ${existingAssignments[0].monitor_name}.`,
        });
      }
    }

    await connection.query(
      `
      DELETE FROM monitor_playlist_items
      WHERE monitor_id = ?
      `,
      [monitorId]
    );

    for (const [index, item] of items.entries()) {
      const projectId = Number.parseInt(item.projectId, 10);
      const loopCount = Number.parseInt(item.projectLoopCount, 10);
      const slideDuration = Number.parseInt(item.slideDurationSeconds, 10);

      const [insertResult] = await connection.query(
        `
INSERT INTO monitor_playlist_items
(
    monitor_id,
    project_id,
    display_order,
    project_loop_count,
    slide_duration_seconds,
    is_active
)
VALUES (?, ?, ?, ?, ?, TRUE)
`,
        [
          monitorId,
          projectId,
          index + 1,
          Number.isInteger(loopCount) && loopCount > 0 ? loopCount : 1,
          Number.isInteger(slideDuration) && slideDuration > 0 ? slideDuration : 10,
        ]
      );

      const playlistItemId = insertResult.insertId;

      const frontendPages = item.pages || [];

      for (const page of frontendPages) {

        await connection.query(
          `
      INSERT INTO monitor_playlist_pages
      (
          playlist_item_id,
          canvas_id,
          page_order,
          duration_seconds
      )
      VALUES (?, ?, ?, ?)
      `,
          [
            playlistItemId,
            page.canvasId,
            page.pageOrder,
            page.durationSeconds || 10
          ]
        );
      }
    }

    await connection.commit();

    const io = req.app.get("io");

    io.to(`monitor_${monitorId}`).emit("playlist-updated", {
      monitorId,
      message: "Playlist updated",
      updatedAt: new Date(),
    });

    return res.json({
      success: true,
      message: "Playlist saved successfully.",
    });
  } catch (err) {
    await connection.rollback();

    console.error("Save playlist error:", err);

    return res.status(500).json({
      success: false,
      message: "Unable to save monitor playlist.",
    });
  } finally {
    connection.release();
  }
});

app.post("/api/monitors/:monitorId/push", requireAdmin, async (req, res) => {
  try {
    const { monitorId } = req.params;

    const io = req.app.get("io");

    io.to(`monitor_${monitorId}`).emit("playlist-updated", {
      monitorId,
      message: "Manual push triggered",
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      message: "Display pushed to selected monitor.",
    });
  } catch (error) {
    console.error("Push monitor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to push display.",
    });
  }
});

// Get monitor display content by token code
app.get("/api/monitor-display/:tokenCode", async (req, res) => {
  try {
    const { tokenCode } = req.params;

    const [monitorRows] = await db.query(
      `
      SELECT 
        monitor_id,
        monitor_name,
        monitor_category,
        pairing_code,
        status
      FROM monitors
      WHERE pairing_code = ?
      LIMIT 1
      `,
      [tokenCode]
    );

    if (monitorRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Monitor not found.",
      });
    }

    const monitor = monitorRows[0];

    const [playlistRows] = await db.query(
      `
      SELECT
        mpi.playlist_item_id,
        mpi.monitor_id,
        mpi.project_id,
        mpi.display_order,
        p.name AS project_name,
        p.description,
        p.category,
        p.status
      FROM monitor_playlist_items mpi
      JOIN projects p
        ON mpi.project_id = p.project_id
      WHERE mpi.monitor_id = ?
        AND mpi.is_active = TRUE
        AND p.status = 'published'
      ORDER BY mpi.display_order ASC
      `,
      [monitor.monitor_id]
    );

    const playlist = [];

    for (const item of playlistRows) {
      const [canvasRows] = await db.query(
        `
      SELECT
        c.canvas_id,
        c.project_id,
        c.name,
        c.canvas_order,
        c.width,
        c.height,
        c.background_color,
        c.background_image_path,
        mpp.duration_seconds
      FROM canvases c
      LEFT JOIN monitor_playlist_pages mpp
        ON c.canvas_id = mpp.canvas_id
        AND mpp.playlist_item_id = ?
      WHERE c.project_id = ?
      ORDER BY c.canvas_order ASC
  `,
        [item.playlist_item_id, item.project_id]
      );

      const canvasIds = canvasRows.map((canvas) => canvas.canvas_id);

      let componentsByCanvasId = new Map();
      let backgroundSettingsByCanvasId = new Map();
      let transitionSettingsByCanvasId = new Map();

      if (canvasIds.length > 0) {
        const placeholders = canvasIds.map(() => "?").join(",");

        const [componentRows] = await db.query(
          `
          SELECT
            component_id,
            canvas_id,
            type,
            content_text,
            file_path,
            external_url,
            position_x,
            position_y,
            width,
            height,
            rotation,
            layer_order,
            style_json
          FROM components
          WHERE canvas_id IN (${placeholders})
          ORDER BY layer_order ASC, component_id ASC
          `,
          canvasIds
        );

        ({ componentsByCanvasId, backgroundSettingsByCanvasId, transitionSettingsByCanvasId } =
          splitCanvasRows(componentRows));
      }

      playlist.push({
        projectId: item.project_id,
        projectName: item.project_name,
        description: item.description,
        category: item.category,
        displayOrder: item.display_order,
        pages: canvasRows.map((canvas) =>
          mapCanvasRow(
            canvas,
            componentsByCanvasId.get(canvas.canvas_id) || [],
            backgroundSettingsByCanvasId.get(canvas.canvas_id) || {},
            transitionSettingsByCanvasId.get(canvas.canvas_id) || {}
          )
        ),
      });
    }

    res.json({
      success: true,
      monitor: {
        monitorId: monitor.monitor_id,
        monitorName: monitor.monitor_name,
        category: monitor.monitor_category,
        tokenCode: monitor.pairing_code,
        status: monitor.status,
      },
      playlist,
    });
  } catch (error) {
    console.error("Monitor display error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load monitor display.",
    });
  }
});

// Delete monitor display
app.delete("/monitors/:id", requireAdmin, async (req, res) => {
    try {
        const monitorId = parseInt(req.params.id, 10);

        if (!Number.isInteger(monitorId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid monitor ID",
            });
        }

        // delete playlist items (ONLY if table exists)
        await db.query(
            "DELETE FROM monitor_playlist_items WHERE monitor_id = ?",
            [monitorId]
        );

        // delete monitor
        await db.query(
            "DELETE FROM monitors WHERE monitor_id = ?",
            [monitorId]
        );

        res.json({
            success: true,
            message: "Display deleted successfully.",
        });

    } catch (err) {
        console.error("DELETE ERROR:", err);

        res.status(500).json({
            success: false,
            message: err.sqlMessage || err.message,
        });
    }
});

app.delete("/api/profile/avatar", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.user_id;
    await db.query(`UPDATE users SET avatar_path = NULL WHERE user_id = ?`, [userId]);
    req.session.user.avatar_path = null;
    return res.json({ success: true });
  } catch (err) {
    console.error("Avatar revert error:", err);
    return res.status(500).json({ success: false, message: "Unable to reset avatar." });
  }
});

// ===== Collaborator feature =====
const ROLE_RANK = { viewer: 1, editor: 2 };

function requireProjectAccess(minRole = "viewer") {
  return async (req, res, next) => {
    try {
      const projectId = Number.parseInt(req.params.canvasId || req.params.id, 10);
      const userId = req.session.user?.user_id;
      const globalRole = req.session.user?.role;

      if (!userId) {
        return res.status(401).json({ success: false, message: "Not logged in." });
      }
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid project ID." });
      }

      // Admins bypass collaborator checks
      if (globalRole === "admin") {
        req.projectRole = "admin";
        return next();
      }

      const [[project]] = await db.query(
        "SELECT user_id AS ownerId FROM projects WHERE project_id = ?",
        [projectId]
      );
      if (!project) {
        return res.status(404).json({ success: false, message: "Project not found." });
      }

      if (project.ownerId === userId) {
        req.projectRole = "owner";
        return next();
      }

      const [[collab]] = await db.query(
        "SELECT role FROM project_collaborators WHERE project_id = ? AND user_id = ?",
        [projectId, userId]
      );
      if (!collab || ROLE_RANK[collab.role] < ROLE_RANK[minRole]) {
        return res.status(403).json({ success: false, message: "You do not have access to this project." });
      }
      req.projectRole = collab.role;
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error checking project access." });
    }
  };
}

// List collaborators
app.get("/api/canvases/:canvasId/collaborators", requireProjectAccess("viewer"), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.user_id AS id, u.username AS name, u.email, pc.role
       FROM project_collaborators pc
       JOIN users u ON u.user_id = pc.user_id
       WHERE pc.project_id = ?`,
      [req.params.canvasId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to load collaborators." });
  }
});

// Add collaborator by email (owner/admin only)
app.post("/api/canvases/:canvasId/collaborators", requireProjectAccess("editor"), async (req, res) => {
  try {
    if (req.projectRole !== "owner" && req.projectRole !== "admin") {
      return res.status(403).json({ success: false, message: "Only the project owner can add collaborators." });
    }

    const { email, role = "viewer" } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, message: "Email is required." });
    }
    if (!["editor", "viewer"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }

    const [[user]] = await db.query(
      "SELECT user_id, role FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "No user found with that email." });
    }
    if (user.user_id === req.session.user.user_id) {
      return res.status(400).json({ success: false, message: "You already own this project." });
    }
    if (user.role !== "producer") {
      return res.status(400).json({ success: false, message: "Only producer accounts can be added as collaborators." });
    }

    await db.query(
      `INSERT INTO project_collaborators (project_id, user_id, role)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [req.params.canvasId, user.user_id, role]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to add collaborator." });
  }
});

// Remove collaborator (owner/admin only)
app.delete("/api/canvases/:canvasId/collaborators/:userId", requireProjectAccess("editor"), async (req, res) => {
  try {
    if (req.projectRole !== "owner" && req.projectRole !== "admin") {
      return res.status(403).json({ success: false, message: "Only the project owner can remove collaborators." });
    }
    await db.query(
      "DELETE FROM project_collaborators WHERE project_id = ? AND user_id = ?",
      [req.params.canvasId, req.params.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to remove collaborator." });
  }
});
// ===== End collaborator feature =====

registerSchedulerDisplayFeatures({ app, io, db, requireAdmin });

app.get("/api/database/status", requireAdmin, (req, res) => {
  res.json({
    success: true,
    database: db.getStatus(),
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
