const DEFAULT_FALLBACK_PROJECT_NAME = "Welcome Page";

function isPublishedFallbackProject(project) {
  return Boolean(
    project &&
    project.category === "default" &&
    project.status === "published" &&
    project.is_template !== true &&
    Number(project.is_template) !== 1
  );
}

async function getDisplayFallbackProject(database) {
  const [settings] = await database.query(
    `SELECT project_id
     FROM display_fallback_settings
     WHERE setting_id = ?
     LIMIT 1`,
    [1]
  );

  if (settings.length > 0) {
    const [projects] = await database.query(
      `SELECT project_id, name, category, status, is_template
       FROM projects
       WHERE project_id = ?
       LIMIT 1`,
      [settings[0].project_id]
    );
    const project = projects.find(isPublishedFallbackProject);
    if (!project) {
      throw new Error("The configured fallback project is no longer published in the Default category.");
    }
    return project;
  }

  const [projects] = await database.query(
    `SELECT project_id, name, category, status, is_template
     FROM projects
     WHERE name = ? AND category = ? AND status = ?
     ORDER BY project_id ASC`,
    [DEFAULT_FALLBACK_PROJECT_NAME, "default", "published"]
  );
  return projects.find(isPublishedFallbackProject) || null;
}

async function removeFallbackProjectAssignments(database, projectId) {
  await database.query(
    `SELECT monitor_id
     FROM monitor_playlist_items
     WHERE project_id = ?
     FOR UPDATE`,
    [projectId]
  );
  await database.query(
    `SELECT monitor_id
     FROM monitor_schedules
     WHERE project_id = ? AND status IN ('scheduled', 'active')
     FOR UPDATE`,
    [projectId]
  );
  const [scheduleUpdate] = await database.query(
    `UPDATE monitor_schedules
     SET status = 'cancelled'
     WHERE project_id = ? AND status IN ('scheduled', 'active')`,
    [projectId]
  );
  const [playlistDelete] = await database.query(
    `DELETE FROM monitor_playlist_items
     WHERE project_id = ?`,
    [projectId]
  );

  return {
    removedPlaylistAssignments: Number(playlistDelete.affectedRows || 0),
    cancelledSchedules: Number(scheduleUpdate.affectedRows || 0),
  };
}

module.exports = {
  DEFAULT_FALLBACK_PROJECT_NAME,
  getDisplayFallbackProject,
  isPublishedFallbackProject,
  removeFallbackProjectAssignments,
};
