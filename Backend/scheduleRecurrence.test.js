const test = require("node:test");
const assert = require("node:assert/strict");
const {
  firstWeeklyOccurrence,
  getDateInTimeZone,
  isValidTimeZone,
  nextWeeklyOccurrenceAfter,
  normalizeRepeatDays,
  schedulesOverlap,
} = require("./scheduleRecurrence");

test("normalizes selected weekdays and rejects invalid selections", () => {
  assert.deepEqual(
    normalizeRepeatDays(["friday", "monday", "friday"]),
    ["monday", "friday"]
  );
  assert.equal(normalizeRepeatDays([]), null);
  assert.equal(normalizeRepeatDays(["funday"]), null);
});

test("creates weekly occurrences in the creator's timezone", () => {
  const occurrence = firstWeeklyOccurrence(
    "2026-11-15",
    ["monday"],
    "Asia/Singapore",
    "09:00",
    "10:00"
  );

  assert.equal(occurrence.startAt.toISOString(), "2026-11-16T01:00:00.000Z");
  assert.equal(occurrence.endAt.toISOString(), "2026-11-16T02:00:00.000Z");
  assert.equal(getDateInTimeZone(occurrence.startAt, "Asia/Singapore"), "2026-11-16");
});

test("uses the next selected weekday after an occurrence", () => {
  const schedule = {
    startAt: new Date("2026-11-16T01:00:00.000Z"),
    endAt: new Date("2026-11-16T02:00:00.000Z"),
    repeatDays: ["monday"],
    timeZone: "Asia/Singapore",
    startTime: "09:00",
    endTime: "10:00",
  };
  const next = nextWeeklyOccurrenceAfter(
    schedule,
    new Date("2026-11-16T02:00:00.000Z")
  );

  assert.equal(next.startAt.toISOString(), "2026-11-23T01:00:00.000Z");
});

test("rejects invalid timezones and skips nonexistent daylight-saving times", () => {
  assert.equal(isValidTimeZone("not/a-timezone"), false);
  assert.equal(
    firstWeeklyOccurrence(
      "2026-03-08",
      ["sunday"],
      "America/New_York",
      "02:30",
      "03:30"
    ).startAt.toISOString(),
    "2026-03-15T06:30:00.000Z"
  );
});

test("detects conflicts between recurring schedules", () => {
  const first = {
    startAt: new Date("2026-11-16T01:00:00.000Z"),
    endAt: new Date("2026-11-16T02:00:00.000Z"),
    repeatDays: ["monday"],
    timeZone: "Asia/Singapore",
    startTime: "09:00",
    endTime: "10:00",
  };
  const overlapping = {
    ...first,
    startAt: new Date("2026-11-16T01:30:00.000Z"),
    endAt: new Date("2026-11-16T02:30:00.000Z"),
    startTime: "09:30",
    endTime: "10:30",
  };
  const nonOverlapping = {
    ...first,
    startTime: "10:00",
    endTime: "11:00",
  };

  assert.equal(schedulesOverlap(first, overlapping), true);
  assert.equal(schedulesOverlap(first, nonOverlapping), false);
});
