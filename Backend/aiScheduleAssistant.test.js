const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  formatUpcomingSchedules,
  isUpcomingSchedulesRequest,
  loadUpcomingSchedules,
} = require("./aiScheduleAssistant");

test("recognizes upcoming schedule questions without matching unrelated requests", () => {
  assert.equal(isUpcomingSchedulesRequest("What schedules are coming up?"), true);
  assert.equal(isUpcomingSchedulesRequest("Show me what is scheduled next"), true);
  assert.equal(isUpcomingSchedulesRequest("How do I create a schedule?"), false);
  assert.equal(isUpcomingSchedulesRequest("What projects are published?"), false);
});

test("loads future scheduled and in-progress active schedules using a bounded query", async () => {
  let query = "";
  const expectedRows = [{ schedule_id: 7 }];
  const db = {
    query: async (sql) => {
      query = sql;
      return [expectedRows];
    },
  };

  assert.equal(await loadUpcomingSchedules(db), expectedRows);
  assert.match(query, /ms\.status = 'scheduled' AND ms\.start_at >= UTC_TIMESTAMP\(\)/);
  assert.match(query, /ms\.status = 'active' AND ms\.end_at >= UTC_TIMESTAMP\(\)/);
  assert.match(query, /LIMIT 51/);
});

test("formats live schedule details in the schedule or viewer timezone", () => {
  const result = formatUpcomingSchedules(
    [
      {
        schedule_id: 7,
        project_name: "Water Conservation",
        monitor_name: "Lobby Display",
        status: "scheduled",
        start_at_iso: "2026-11-29T02:00:00Z",
        end_at_iso: "2026-11-29T04:00:00Z",
        time_zone: "Asia/Singapore",
        repeat_days: '["monday","wednesday"]',
      },
    ],
    "UTC"
  );

  assert.match(result.message, /Water Conservation on Lobby Display/);
  assert.match(result.message, /29 Nov 2026, 10:00 am to 29 Nov 2026, 12:00 pm/);
  assert.match(result.message, /weekly on Monday, Wednesday; Asia\/Singapore/);
  assert.equal(result.schedules[0].timeZone, "Asia/Singapore");
  assert.equal(result.truncated, false);
});

test("reports when no schedules are upcoming", () => {
  const result = formatUpcomingSchedules([], "UTC");
  assert.equal(
    result.message,
    "There are no upcoming or currently active content schedules."
  );
  assert.deepEqual(result.schedules, []);
});
