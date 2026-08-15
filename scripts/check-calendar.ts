import { format, isWeekend, parseISO } from "date-fns";

import {
  DAY_WIDTH,
  WINDOW_DAYS,
  barFor,
  calendarWindow,
  gridBackground,
  isVisible,
  monthBands,
  pageFocus,
  ticks,
  xOf,
} from "../lib/calendar";

let failures = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    failures += 1;
    console.log(`FAIL ${label}\n  got  ${g}\n  want ${w}`);
  } else {
    console.log(`ok   ${label}`);
  }
};

// Fri 2026-08-14.
const focus = parseISO("2026-08-14");

for (const zoom of ["days", "weeks", "months"] as const) {
  const w = calendarWindow(focus, zoom);
  check(`${zoom}: origin is a Monday`, w.origin.getDay(), 1);
  check(`${zoom}: window is whole weeks`, w.days.length % 7, 0);
  check(`${zoom}: day count`, w.days.length, WINDOW_DAYS[zoom]);
  check(
    `${zoom}: timeline width`,
    Math.round(w.timelineWidth),
    Math.round(WINDOW_DAYS[zoom] * DAY_WIDTH[zoom]),
  );
  check(`${zoom}: focus inside window`, w.origin <= focus && focus <= w.rangeEnd, true);
  // Weekend shading assumes indices 5 and 6 of each period are Sat/Sun.
  check(`${zoom}: index 5 is Saturday`, w.days[5].getDay(), 6);
  check(`${zoom}: index 6 is Sunday`, w.days[6].getDay(), 0);
}

const day = calendarWindow(focus, "days");

// --- bar geometry --------------------------------------------------------
check("origin maps to x=0", xOf(format(day.origin, "yyyy-MM-dd"), day), 0);

const oneDay = barFor("2026-08-17", "2026-08-17", day);
check("1-day bar is one column wide", oneDay.width, DAY_WIDTH.days);

const twoWeeks = barFor("2026-08-17", "2026-08-28", day);
check("inclusive span: 17→28 Aug is 12 days", twoWeeks.width, 12 * DAY_WIDTH.days);

const later = barFor("2026-08-18", "2026-08-18", day);
check(
  "consecutive days are adjacent, not overlapping",
  later.left - oneDay.left,
  DAY_WIDTH.days,
);

// A zero-length Review milestone still paints.
check("milestone has non-zero width", barFor("2026-09-04", "2026-09-04", day).width > 0, true);

// --- clipping ------------------------------------------------------------
check("bar before window is hidden", isVisible(barFor("2020-01-01", "2020-01-05", day), day), false);
check("bar after window is hidden", isVisible(barFor("2030-01-01", "2030-01-05", day), day), false);
check("bar inside window is shown", isVisible(barFor("2026-08-17", "2026-08-21", day), day), true);
check(
  "bar straddling the left edge is shown",
  isVisible(barFor(format(day.origin, "yyyy-MM-dd"), "2026-12-01", day), day),
  true,
);

// --- header bands --------------------------------------------------------
const bands = monthBands(day);
check("month bands are contiguous from 0", bands[0].left, 0);
check(
  "month bands tile the timeline exactly",
  Math.round(bands.reduce((sum, b) => sum + b.width, 0)),
  Math.round(day.timelineWidth),
);
check("no duplicate adjacent month labels", new Set(bands.map((b) => b.label)).size, bands.length);

const dayTicks = ticks(day);
check("days zoom: one tick per day", dayTicks.length, day.days.length);
check("days zoom: tick width is one column", dayTicks[0].width, DAY_WIDTH.days);

const weekWin = calendarWindow(focus, "weeks");
const weekTicks = ticks(weekWin);
check("weeks zoom: one tick per week", weekTicks.length, weekWin.days.length / 7);
check("weeks zoom: every tick is a Monday", new Set(weekTicks.map((t) => t.date.getDay())), new Set([1]));
check(
  "weeks zoom: ticks tile the timeline",
  Math.round(weekTicks.reduce((s, t) => s + t.width, 0)),
  Math.round(weekWin.timelineWidth),
);

// --- weekend shading -----------------------------------------------------
const gradient = gridBackground("days");
const d = DAY_WIDTH.days;
check(
  "days zoom paints a weekend band over the last 2/7 of each week",
  gradient.includes(`transparent 0 ${5 * d}px, var(--muted-fill) ${5 * d}px ${7 * d}px`),
  true,
);
check("weeks zoom paints no weekend band", gridBackground("weeks").includes("muted-fill"), false);
check(
  "grid line period matches the column",
  gridBackground("weeks").includes(`transparent 1px ${7 * DAY_WIDTH.weeks}px`),
  true,
);

// Cross-check the gradient's assumption against real dates.
const weekendIndices = day.days
  .slice(0, 14)
  .map((date, i) => ({ i: i % 7, weekend: isWeekend(date) }))
  .filter((x) => x.weekend)
  .map((x) => x.i);
check("real weekends land on indices 5 and 6", [...new Set(weekendIndices)].sort(), [5, 6]);

// --- paging --------------------------------------------------------------
const next = pageFocus(focus, "days", 1);
const prev = pageFocus(focus, "days", -1);
check("paging forward moves half a window", (next.getTime() - focus.getTime()) / 86400000, WINDOW_DAYS.days / 2);
check("paging is symmetric", (focus.getTime() - prev.getTime()) / 86400000, WINDOW_DAYS.days / 2);
check(
  "adjacent pages overlap by half a window (no gap)",
  calendarWindow(next, "days").origin <= calendarWindow(focus, "days").rangeEnd,
  true,
);

console.log(
  failures === 0 ? "\nAll calendar checks passed" : `\n${failures} FAILURES`,
);
process.exit(failures === 0 ? 0 : 1);
