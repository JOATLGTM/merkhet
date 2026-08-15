import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";

/**
 * Calendar geometry. Pure arithmetic, deliberately separate from the view so
 * it can be checked without a browser — see `npm run check:calendar`.
 */

export const ZOOMS = ["days", "weeks", "months"] as const;
export const MODES = ["projects", "staff"] as const;
export type Zoom = (typeof ZOOMS)[number];
export type Mode = (typeof MODES)[number];

/**
 * Pixels per calendar day. Every measurement derives from this — column
 * widths, bar geometry, and the grid gradient all read the same number, so a
 * zoom level is one constant rather than a branch in five places.
 */
export const DAY_WIDTH: Record<Zoom, number> = {
  days: 34,
  weeks: 52 / 7,
  months: 26 / 7,
};

/**
 * How much calendar time the window holds. The previous view spanned
 * min-to-max across every project, which at day resolution is a scroll bar
 * measured in tens of thousands of pixels. Bounded window + paging instead.
 */
export const WINDOW_DAYS: Record<Zoom, number> = {
  days: 7 * 12,
  weeks: 7 * 52,
  months: 7 * 156,
};

export type CalendarWindow = {
  zoom: Zoom;
  origin: Date;
  days: Date[];
  dayWidth: number;
  timelineWidth: number;
  rangeEnd: Date;
};

/**
 * A window of whole weeks centred on `focus`. The origin is always a Monday,
 * which is what keeps the weekend gradient aligned to actual Saturdays.
 */
export function calendarWindow(focus: Date, zoom: Zoom): CalendarWindow {
  const windowDays = WINDOW_DAYS[zoom];
  const dayWidth = DAY_WIDTH[zoom];
  const origin = startOfWeek(addDays(focus, -Math.floor(windowDays / 2)), {
    weekStartsOn: 1,
  });
  return {
    zoom,
    origin,
    days: Array.from({ length: windowDays }, (_, i) => addDays(origin, i)),
    dayWidth,
    timelineWidth: windowDays * dayWidth,
    rangeEnd: addDays(origin, windowDays - 1),
  };
}

export function pageFocus(focus: Date, zoom: Zoom, direction: -1 | 1): Date {
  return addDays(focus, direction * Math.floor(WINDOW_DAYS[zoom] / 2));
}

export function xOf(iso: string, w: CalendarWindow): number {
  return differenceInCalendarDays(parseISO(iso), w.origin) * w.dayWidth;
}

export type Bar = { left: number; width: number };

/** Inclusive: a phase ending on the 28th occupies the 28th. */
export function barFor(start: string, end: string, w: CalendarWindow): Bar {
  const span = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  return { left: xOf(start, w), width: Math.max(span * w.dayWidth, 4) };
}

export function isVisible(bar: Bar, w: CalendarWindow): boolean {
  return bar.left + bar.width > 0 && bar.left < w.timelineWidth;
}

export type Band = { label: string; left: number; width: number };

export function monthBands(w: CalendarWindow): Band[] {
  const bands: Band[] = [];
  let i = 0;
  while (i < w.days.length) {
    const month = w.days[i].getMonth();
    let j = i;
    while (j < w.days.length && w.days[j].getMonth() === month) j += 1;
    bands.push({
      label: format(w.days[i], w.zoom === "months" ? "MMM" : "MMMM yyyy"),
      left: i * w.dayWidth,
      width: (j - i) * w.dayWidth,
    });
    i = j;
  }
  return bands;
}

export type Tick = { key: string; date: Date; left: number; width: number };

export function ticks(w: CalendarWindow): Tick[] {
  if (w.zoom === "days") {
    return w.days.map((date, i) => ({
      key: date.toISOString(),
      date,
      left: i * w.dayWidth,
      width: w.dayWidth,
    }));
  }
  return w.days
    .map((date, i) => ({ date, i }))
    .filter(({ i }) => i % 7 === 0)
    .map(({ date, i }) => ({
      key: date.toISOString(),
      date,
      left: i * w.dayWidth,
      width: 7 * w.dayWidth,
    }));
}

/**
 * Grid lines and weekend shading as one painted background rather than a div
 * per column per row — at day resolution that was roughly 11k nodes.
 *
 * Weekends are indices 5 and 6 of each 7-day period, which holds because the
 * origin is pinned to Monday.
 */
export function gridBackground(zoom: Zoom): string {
  const d = DAY_WIDTH[zoom];
  const period = zoom === "days" ? d : 7 * d;
  const line = `repeating-linear-gradient(to right, var(--rule) 0 1px, transparent 1px ${period}px)`;
  if (zoom !== "days") return line;
  const weekend = `repeating-linear-gradient(to right, transparent 0 ${
    5 * d
  }px, var(--muted-fill) ${5 * d}px ${7 * d}px)`;
  return `${line}, ${weekend}`;
}
