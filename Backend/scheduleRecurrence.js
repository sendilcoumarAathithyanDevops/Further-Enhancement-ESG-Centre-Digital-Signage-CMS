const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const WEEKDAY_ORDER = new Map(
  ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    .map((day, index) => [day, index])
);
const formatterCache = new Map();

function normalizeRepeatDays(value) {
  if (!Array.isArray(value) || value.length === 0) return null;

  const days = [...new Set(value.map((day) => String(day).toLowerCase()))];
  if (days.some((day) => !WEEKDAY_ORDER.has(day))) return null;
  return days.sort((left, right) => WEEKDAY_ORDER.get(left) - WEEKDAY_ORDER.get(right));
}

function parseRepeatDays(value) {
  if (Array.isArray(value)) return normalizeRepeatDays(value);
  if (typeof value !== "string") return null;

  try {
    return normalizeRepeatDays(JSON.parse(value));
  } catch {
    return null;
  }
}

function isValidTimeZone(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    getFormatter(value);
    return true;
  } catch {
    return false;
  }
}

function getFormatter(timeZone) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function getZonedParts(date, timeZone) {
  const values = Object.fromEntries(
    getFormatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function formatLocalDate(parts) {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function getDateInTimeZone(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || !isValidTimeZone(timeZone)) return null;
  return formatLocalDate(getZonedParts(date, timeZone));
}

function addCalendarDays(dateString, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return null;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days)
  );
  return formatLocalDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function dateWeekday(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return null;
  return WEEKDAYS[
    new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    ).getUTCDay()
  ];
}

function parseTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(
    String(value || "")
  );
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: Number(match[3] || 0),
    value: `${match[1]}:${match[2]}`,
  };
}

function localDateTimeToUtc(dateString, time, timeZone) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ""));
  const parsedTime = parseTime(time);
  if (!dateMatch || !parsedTime || !isValidTimeZone(timeZone)) return null;

  const wanted = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: parsedTime.hour,
    minute: parsedTime.minute,
    second: parsedTime.second,
  };
  const wantedAsUtc = Date.UTC(
    wanted.year,
    wanted.month - 1,
    wanted.day,
    wanted.hour,
    wanted.minute,
    wanted.second
  );
  const offsets = [-36, -12, 0, 12, 36];
  const candidates = new Set();

  for (const offsetHours of offsets) {
    const sample = wantedAsUtc + offsetHours * 60 * 60 * 1000;
    const local = getZonedParts(new Date(sample), timeZone);
    const localAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second
    );
    candidates.add(wantedAsUtc - (localAsUtc - sample));
  }

  const matches = [...candidates]
    .filter((candidate) => {
      const local = getZonedParts(new Date(candidate), timeZone);
      return Object.keys(wanted).every((key) => local[key] === wanted[key]);
    })
    .sort((left, right) => left - right);

  return matches.length ? new Date(matches[0]) : null;
}

function makeOccurrence(dateString, startTime, endTime, timeZone) {
  const startAt = localDateTimeToUtc(dateString, startTime, timeZone);
  const endAt = localDateTimeToUtc(dateString, endTime, timeZone);
  if (!startAt || !endAt || endAt <= startAt) return null;
  return { startAt, endAt };
}

function firstWeeklyOccurrence(startDate, repeatDays, timeZone, startTime, endTime) {
  const days = normalizeRepeatDays(repeatDays);
  if (!days || !isValidTimeZone(timeZone)) return null;

  for (let offset = 0; offset <= 14; offset += 1) {
    const date = addCalendarDays(startDate, offset);
    if (days.includes(dateWeekday(date))) {
      const occurrence = makeOccurrence(date, startTime, endTime, timeZone);
      if (occurrence) return occurrence;
    }
  }
  return null;
}

function asDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value !== "string") return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function scheduleValues(schedule) {
  const repeatDays = parseRepeatDays(schedule.repeatDays ?? schedule.repeat_days);
  const timeZone = schedule.timeZone ?? schedule.time_zone;
  const startTime = schedule.startTime ?? schedule.repeat_start_time;
  const endTime = schedule.endTime ?? schedule.repeat_end_time;
  const startAt = asDate(schedule.startAt ?? schedule.start_at_iso ?? schedule.start_at);
  const endAt = asDate(schedule.endAt ?? schedule.end_at_iso ?? schedule.end_at);
  return { repeatDays, timeZone, startTime, endTime, startAt, endAt };
}

function nextWeeklyOccurrenceAtOrAfter(schedule, lowerBound, includeEqual) {
  const values = scheduleValues(schedule);
  if (
    !values.repeatDays ||
    !isValidTimeZone(values.timeZone) ||
    !values.startAt ||
    !values.endAt
  ) {
    return null;
  }

  const lower = asDate(lowerBound);
  const anchor = lower && lower > values.startAt ? lower : values.startAt;
  const localDate = getDateInTimeZone(anchor, values.timeZone);
  if (!localDate) return null;

  for (let offset = 0; offset <= 14; offset += 1) {
    const date = addCalendarDays(localDate, offset);
    if (!values.repeatDays.includes(dateWeekday(date))) continue;
    const occurrence = makeOccurrence(
      date,
      values.startTime,
      values.endTime,
      values.timeZone
    );
    if (!occurrence || occurrence.startAt < values.startAt) continue;

    const comparison = occurrence.startAt.getTime() - anchor.getTime();
    if (comparison > 0 || (includeEqual && comparison === 0)) return occurrence;
  }
  return null;
}

function intervalsOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function weeklyOverlapsInterval(weekly, interval) {
  const intervalStart = asDate(interval.startAt ?? interval.start_at_iso ?? interval.start_at);
  const intervalEnd = asDate(interval.endAt ?? interval.end_at_iso ?? interval.end_at);
  const weeklyValues = scheduleValues(weekly);
  if (!intervalStart || !intervalEnd || !weeklyValues.startAt) return false;

  const lowerBound = new Date(
    Math.max(
      weeklyValues.startAt.getTime(),
      intervalStart.getTime() - 2 * DAY_MS
    )
  );
  let occurrence = nextWeeklyOccurrenceAtOrAfter(weekly, lowerBound, true);
  while (occurrence && occurrence.startAt < intervalEnd) {
    if (
      intervalsOverlap(
        occurrence.startAt,
        occurrence.endAt,
        intervalStart,
        intervalEnd
      )
    ) {
      return true;
    }
    occurrence = nextWeeklyOccurrenceAtOrAfter(
      weekly,
      new Date(occurrence.startAt.getTime() + 1),
      false
    );
  }
  return false;
}

function schedulesOverlap(left, right) {
  const leftValues = scheduleValues(left);
  const rightValues = scheduleValues(right);
  if (!leftValues.startAt || !leftValues.endAt || !rightValues.startAt || !rightValues.endAt) {
    return false;
  }

  if (!leftValues.repeatDays && !rightValues.repeatDays) {
    return intervalsOverlap(
      leftValues.startAt,
      leftValues.endAt,
      rightValues.startAt,
      rightValues.endAt
    );
  }
  if (leftValues.repeatDays && !rightValues.repeatDays) {
    return weeklyOverlapsInterval(left, right);
  }
  if (!leftValues.repeatDays && rightValues.repeatDays) {
    return weeklyOverlapsInterval(right, left);
  }

  const windowStart = new Date(
    Math.max(leftValues.startAt.getTime(), rightValues.startAt.getTime())
  );
  const windowEnd = new Date(windowStart.getTime() + 400 * DAY_MS);
  let leftOccurrence = nextWeeklyOccurrenceAtOrAfter(left, windowStart, true);
  let rightOccurrence = nextWeeklyOccurrenceAtOrAfter(right, windowStart, true);

  while (
    leftOccurrence &&
    rightOccurrence &&
    leftOccurrence.startAt < windowEnd &&
    rightOccurrence.startAt < windowEnd
  ) {
    if (
      intervalsOverlap(
        leftOccurrence.startAt,
        leftOccurrence.endAt,
        rightOccurrence.startAt,
        rightOccurrence.endAt
      )
    ) {
      return true;
    }
    if (leftOccurrence.endAt <= rightOccurrence.startAt) {
      leftOccurrence = nextWeeklyOccurrenceAtOrAfter(
        left,
        new Date(leftOccurrence.startAt.getTime() + 1),
        false
      );
    } else {
      rightOccurrence = nextWeeklyOccurrenceAtOrAfter(
        right,
        new Date(rightOccurrence.startAt.getTime() + 1),
        false
      );
    }
  }
  return false;
}

module.exports = {
  firstWeeklyOccurrence,
  getDateInTimeZone,
  isValidTimeZone,
  normalizeRepeatDays,
  parseRepeatDays,
  schedulesOverlap,
  nextWeeklyOccurrenceAfter(value, after) {
    return nextWeeklyOccurrenceAtOrAfter(value, after, false);
  },
};
