const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");

const dataFile = path.join(os.tmpdir(), `fallback-store-${process.pid}.json`);
process.env.FALLBACK_DB_FILE = dataFile;
fs.writeFileSync(
  dataFile,
  JSON.stringify({
    projects: [
      { project_id: 12, name: "Welcome Page", category: "default", status: "published", updated_at: "NOW()" },
      { project_id: 13, name: "Draft", status: "draft" },
      { project_id: 14, name: "Environmental Project", category: "environmental", status: "published" },
      { project_id: 15, name: "Alternate Fallback", category: "default", status: "published" },
    ],
    monitors: [
      { monitor_id: 32, monitor_name: "default_monitor_1", monitor_category: "default" },
      { monitor_id: 33, monitor_name: "test_monitor_2", monitor_category: "default" },
      { monitor_id: 34, monitor_name: "environmental_monitor_1", monitor_category: "environmental" },
      { monitor_id: 35, monitor_name: "environmental_monitor_2", monitor_category: "environmental" },
    ],
    canvases: [
      { canvas_id: 105, project_id: 12, canvas_order: 1, name: "Page 1" },
      { canvas_id: 106, project_id: 14, canvas_order: 1, name: "Environmental Page" },
    ],
    monitor_playlist_items: [
      {
        playlist_item_id: 7,
        monitor_id: 32,
        project_id: 13,
        display_order: 2,
        is_active: 0,
      },
    ],
    monitor_playlist_pages: [],
  })
);

const fallbackStore = require("./fallbackStore");
fallbackStore.activate(new Error("isolated fallback-store test"));
const {
  getDisplayFallbackProject,
  removeFallbackProjectAssignments,
} = require("./displayFallback");

after(() => {
  if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
});

test("fallback project ID queries honor IN parameters", async () => {
  const [projects] = await fallbackStore.query(
    "SELECT project_id, status FROM projects WHERE project_id IN (?, ?)",
    [12, 14]
  );
  assert.deepEqual(projects.map((project) => project.project_id), [12, 14]);
});

test("fallback SQL timestamps evaluate NOW instead of storing its expression", async () => {
  await fallbackStore.query(
    "UPDATE projects SET updated_at = NOW() WHERE project_id = ?",
    [12]
  );
  const [projects] = await fallbackStore.query(
    "SELECT project_id, updated_at FROM projects WHERE project_id = ?",
    [12]
  );
  assert.match(projects[0].updated_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test("fallback stores media tags and assigns audit log IDs", async () => {
  await fallbackStore.query(
    `INSERT INTO media_assets
       (media_path, original_name, mime_type, size_bytes, category_tag)
     VALUES (?, ?, ?, ?, ?)`,
    ["/uploads/images/2/image.png", "image.png", "image/png", 2048, "social"]
  );
  const [media] = await fallbackStore.query(
    "SELECT media_path, category_tag FROM media_assets WHERE media_path = ?",
    ["/uploads/images/2/image.png"]
  );
  assert.equal(media[0].category_tag, "social");

  const [insertResult] = await fallbackStore.query(
    `INSERT INTO audit_logs
       (actor_user_id, actor_username, action, resource, ip_address)
     VALUES (?, ?, ?, ?, ?)`,
    [1, "admin", "PATCH", "/api/admin/media", "127.0.0.1"]
  );
  const [logs] = await fallbackStore.query(
    "SELECT audit_log_id, actor_username, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 5"
  );
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const [recentLogs] = await fallbackStore.query(
    "SELECT * FROM audit_logs WHERE created_at >= ? ORDER BY created_at DESC",
    [recentCutoff]
  );
  assert.equal(insertResult.insertId, 1);
  assert.equal(logs[0].audit_log_id, 1);
  assert.equal(logs[0].actor_username, "admin");
  assert.match(logs[0].created_at || "", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(recentLogs.length, 1);
});

test("fallback can save and reload a default-display playlist with page details", async () => {
  const [insertResult] = await fallbackStore.query(
    `INSERT INTO monitor_playlist_items
       (monitor_id, project_id, display_order, project_loop_count, slide_duration_seconds, is_active)
     VALUES (?, ?, ?, ?, ?, TRUE)`,
    [32, 12, 1, 1, 10]
  );
  await fallbackStore.query(
    `INSERT INTO monitor_playlist_pages
       (playlist_item_id, canvas_id, page_order, duration_seconds)
     VALUES (?, ?, ?, ?)`,
    [insertResult.insertId, 105, 1, 15]
  );

  const [playlist] = await fallbackStore.query(
    `SELECT mpi.playlist_item_id, mpi.monitor_id, mpi.project_id,
            mpi.display_order, mpi.project_loop_count, mpi.slide_duration_seconds,
            p.name, p.description, p.category, p.status,
            COUNT(c.canvas_id) AS page_count
     FROM monitor_playlist_items mpi
     JOIN projects p ON mpi.project_id = p.project_id
     LEFT JOIN canvases c ON p.project_id = c.project_id
     WHERE mpi.monitor_id = ? AND mpi.is_active = TRUE
     GROUP BY mpi.playlist_item_id
     ORDER BY mpi.display_order ASC`,
    [32]
  );
  const [pages] = await fallbackStore.query(
    `SELECT mpp.playlist_page_id, mpp.canvas_id, mpp.page_order,
            mpp.duration_seconds, c.name
     FROM monitor_playlist_pages mpp
     JOIN canvases c ON mpp.canvas_id = c.canvas_id
     WHERE mpp.playlist_item_id = ?
     ORDER BY mpp.page_order ASC`,
    [insertResult.insertId]
  );

  assert.equal(playlist.length, 1);
  assert.equal(playlist[0].name, "Welcome Page");
  assert.equal(playlist[0].page_count, 1);
  assert.equal(pages[0].name, "Page 1");
  assert.equal(pages[0].duration_seconds, 15);
});

test("fallback project picker lists a project once when assigned to multiple monitors", async () => {
  for (const monitorId of [34, 35]) {
    await fallbackStore.query(
      `INSERT INTO monitor_playlist_items
         (monitor_id, project_id, display_order, project_loop_count, slide_duration_seconds, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [monitorId, 14, 1, 1, 10]
    );
  }

  const projectQuery =
    `SELECT p.project_id, p.name, p.description, p.category, p.status,
            COUNT(c.canvas_id) AS page_count,
            JSON_ARRAYAGG(JSON_OBJECT(
              'canvas_id', c.canvas_id,
              'canvas_order', c.canvas_order,
              'name', c.name
            )) AS pages
     FROM projects p
     LEFT JOIN canvases c ON p.project_id = c.project_id
     WHERE p.is_template = FALSE
       AND p.status = 'published'
       AND p.category = ?
       AND p.category <> 'default'
     GROUP BY p.project_id, p.name, p.description, p.category, p.status
     ORDER BY p.updated_at DESC`;
  const [projects] = await fallbackStore.query(projectQuery, ["environmental"]);
  const [defaultProjects] = await fallbackStore.query(projectQuery, ["default"]);

  const sharedProjects = projects.filter((project) => project.project_id === 14);
  assert.equal(sharedProjects.length, 1);
  assert.equal(sharedProjects[0].name, "Environmental Project");
  assert.equal(defaultProjects.some((project) => project.category === "default"), false);
});

test("fallback monitor display can resolve the Default Welcome Page when its playlist is empty", async () => {
  const [playlist] = await fallbackStore.query(
    `SELECT mpi.playlist_item_id, mpi.monitor_id, mpi.project_id,
            mpi.display_order, mpi.project_loop_count, mpi.slide_duration_seconds,
            p.name, p.description, p.category, p.status,
            COUNT(c.canvas_id) AS page_count
     FROM monitor_playlist_items mpi
     JOIN projects p ON mpi.project_id = p.project_id
     LEFT JOIN canvases c ON p.project_id = c.project_id
     WHERE mpi.monitor_id = ? AND mpi.is_active = TRUE
     GROUP BY mpi.playlist_item_id`,
    [33]
  );
  assert.equal(playlist.length, 0);

  const [activeSchedules] = await fallbackStore.query(
    `SELECT project_id
     FROM monitor_schedules
     WHERE monitor_id = ? AND status = 'active'
     ORDER BY start_at DESC, schedule_id DESC
     LIMIT 1`,
    [33]
  );
  assert.equal(activeSchedules.length, 0);

  const [fallbackProjects] = await fallbackStore.query(
    `SELECT project_id, name AS project_name, description, category, status
     FROM projects
     WHERE name = ? AND category = ? AND status = 'published'
     ORDER BY project_id ASC
     LIMIT 2`,
    ["Welcome Page", "default"]
  );
  assert.equal(fallbackProjects.length, 1);
  assert.equal(fallbackProjects[0].project_name, "Welcome Page");
});

test("fallback display uses the configured published Default project", async () => {
  const initialFallback = await getDisplayFallbackProject(fallbackStore);
  assert.equal(initialFallback.project_id, 12);

  await fallbackStore.query(
    `INSERT INTO display_fallback_settings (setting_id, project_id)
     VALUES (?, ?)`,
    [1, 15]
  );
  const configuredFallback = await getDisplayFallbackProject(fallbackStore);
  assert.equal(configuredFallback.project_id, 15);
});

test("reserving a fallback removes its playlist assignments and cancels its schedules", async () => {
  for (const monitorId of [34, 35]) {
    await fallbackStore.query(
      `INSERT INTO monitor_playlist_items
         (monitor_id, project_id, display_order, project_loop_count, slide_duration_seconds, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [monitorId, 15, 1, 1, 10]
    );
    await fallbackStore.query(
      `INSERT INTO monitor_schedules
         (monitor_id, project_id, created_by, start_at, end_at, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        monitorId,
        15,
        1,
        "2026-11-28 10:00:00",
        "2026-11-28 11:00:00",
        monitorId === 34 ? "active" : "scheduled",
      ]
    );
  }

  const result = await removeFallbackProjectAssignments(fallbackStore, 15);
  const [playlistItems] = await fallbackStore.query(
    "SELECT playlist_item_id FROM monitor_playlist_items WHERE project_id = ?",
    [15]
  );
  const [schedules] = await fallbackStore.query(
    "SELECT schedule_id, status FROM monitor_schedules WHERE project_id = ?",
    [15]
  );

  assert.equal(result.removedPlaylistAssignments, 2);
  assert.equal(result.cancelledSchedules, 2);
  assert.equal(playlistItems.length, 0);
  assert.deepEqual(schedules.map((schedule) => schedule.status), ["cancelled", "cancelled"]);
});

test("fallback monitor summaries include active playlist names and counts", async () => {
  await fallbackStore.query(
    `INSERT INTO monitor_playlist_items
       (monitor_id, project_id, display_order, project_loop_count, slide_duration_seconds, is_active)
     VALUES (?, ?, ?, ?, ?, TRUE)`,
    [33, 12, 1, 1, 10]
  );

  const [displays] = await fallbackStore.query(
    `SELECT m.monitor_id, m.monitor_name,
            COUNT(mpi.playlist_item_id) AS playlist_count,
            GROUP_CONCAT(p.name ORDER BY mpi.display_order SEPARATOR ', ') AS assigned_projects
     FROM monitors m
     LEFT JOIN monitor_playlist_items mpi
       ON m.monitor_id = mpi.monitor_id AND mpi.is_active = TRUE
     LEFT JOIN projects p ON mpi.project_id = p.project_id
     GROUP BY m.monitor_id`
  );

  const display = displays.find((item) => item.monitor_id === 33);
  assert.equal(display.playlist_count, 1);
  assert.equal(display.assigned_projects, "Welcome Page");
});
