const { isValidTimeZone, parseRepeatDays } = require("./scheduleRecurrence");

const MAX_UPCOMING_SCHEDULES = 50;

function isUpcomingSchedulesRequest(message) {
  return (
    typeof message === "string" &&
    /\b(?:schedule|schedules|scheduled)\b/i.test(message) &&
    /\b(?:upcoming|coming up|next|future|any|all|what|show|list)\b/i.test(message)
  );
}

async function loadUpcomingSchedules(db) {
  const [rows] = await db.query(`
    SELECT
      ms.schedule_id,
      ms.status,
      ms.repeat_days,
      ms.time_zone,
      DATE_FORMAT(ms.start_at, '%Y-%m-%dT%H:%i:%sZ') AS start_at_iso,
      DATE_FORMAT(ms.end_at, '%Y-%m-%dT%H:%i:%sZ') AS end_at_iso,
      m.monitor_name,
      p.name AS project_name
    FROM monitor_schedules ms
    JOIN monitors m ON m.monitor_id = ms.monitor_id
    JOIN projects p ON p.project_id = ms.project_id
    WHERE (
      (ms.status = 'scheduled' AND ms.start_at >= UTC_TIMESTAMP())
      OR (ms.status = 'active' AND ms.end_at >= UTC_TIMESTAMP())
    )
    ORDER BY ms.start_at ASC, ms.schedule_id ASC
    LIMIT 51
  `);
  return rows;
}

function formatScheduleDateTime(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "time unavailable";
  return new Intl.DateTimeFormat("en-SG", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatUpcomingSchedules(rows, viewerTimeZone) {
  const fallbackTimeZone = isValidTimeZone(viewerTimeZone)
    ? viewerTimeZone
    : "UTC";
  const schedules = rows.slice(0, MAX_UPCOMING_SCHEDULES).map((row) => {
    const timeZone = isValidTimeZone(row.time_zone)
      ? row.time_zone
      : fallbackTimeZone;
    const repeatDays = parseRepeatDays(row.repeat_days) || [];
    return {
      scheduleId: row.schedule_id,
      project: row.project_name,
      display: row.monitor_name,
      status: row.status,
      start: formatScheduleDateTime(row.start_at_iso, timeZone),
      end: formatScheduleDateTime(row.end_at_iso, timeZone),
      timeZone,
      repeatDays,
    };
  });
  const truncated = rows.length > MAX_UPCOMING_SCHEDULES;

  if (schedules.length === 0) {
    return {
      message: "There are no upcoming or currently active content schedules.",
      schedules,
      truncated,
    };
  }

  const details = schedules.map((schedule) => {
    const recurrence = schedule.repeatDays.length
      ? `; weekly on ${schedule.repeatDays
          .map((day) => day[0].toUpperCase() + day.slice(1))
          .join(", ")}`
      : "";
    return `- ${schedule.project} on ${schedule.display}: ${schedule.start} to ${schedule.end} (${schedule.status}${recurrence}; ${schedule.timeZone})`;
  });

  return {
    message: `Upcoming and active content schedules${truncated ? " (showing the first 50)" : ""}:\n${details.join("\n")}`,
    schedules,
    truncated,
  };
}

module.exports = {
  formatUpcomingSchedules,
  isUpcomingSchedulesRequest,
  loadUpcomingSchedules,
};
