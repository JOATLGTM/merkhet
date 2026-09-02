import {
  addBusinessDays,
  differenceInCalendarDays,
  format,
  isWeekend,
  nextMonday,
  parseISO,
} from "date-fns";

import { DESIGN_PHASES, type DesignPhase } from "@/lib/types";

export function formatCardDate(value: string | null | undefined): string {
  if (!value) return "—";
  return format(parseISO(value), "dd MMM");
}

export function formatFullDate(value: string | null | undefined): string {
  if (!value) return "—";
  return format(parseISO(value), "d MMM yyyy");
}

export function formatRelative(value: string): string {
  const days = differenceInCalendarDays(new Date(), parseISO(value));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export type DateUrgency = "neutral" | "warn" | "alert";

export function dateUrgency(
  value: string | null | undefined,
): DateUrgency {
  if (!value) return "neutral";
  const days = differenceInCalendarDays(parseISO(value), new Date());
  if (days < 0) return "alert";
  if (days <= 14) return "warn";
  return "neutral";
}

export type PhaseSchedule = { planned_start: string; planned_end: string };

const isoDay = (d: Date) => format(d, "yyyy-MM-dd");

/** Weekends push forward — no phase starts or ends on a Saturday. */
const businessDay = (d: Date) => (isWeekend(d) ? nextMonday(d) : d);

/**
 * Turns delegation durations into a phase schedule.
 *
 * Durations are *working* days (`SLICE_4_SCOPE.md` decision 2): a 10-day phase
 * is two working weeks, not a fortnight ending on a Saturday.
 *
 * Review carries no duration — it is a gate that consumes no schedule time
 * (WORKFLOW-2 §3) — so it lands as a zero-width milestone on the preceding
 * phase's end date (decision 3).
 *
 * `locked` holds phases that must not move because they have already been
 * worked. They are walked for their end dates so the chain resumes after them,
 * but are never re-dated (decision 6). A locked phase with no end date simply
 * doesn't advance the cursor.
 *
 * `anchor` is a *floor*, not merely a fallback. On a fresh plan the cursor is
 * empty and the chain simply starts there. On a re-plan after a rejection the
 * completed phases may have ended months ago, and rework must not be scheduled
 * into the past — so a computed start earlier than the anchor is pulled
 * forward to it.
 */
export function deriveSchedule({
  anchor,
  durations,
  locked = {},
}: {
  anchor: string;
  durations: Partial<Record<DesignPhase, number | null>>;
  locked?: Partial<Record<DesignPhase, string | null>>;
}): Partial<Record<DesignPhase, PhaseSchedule>> {
  const out: Partial<Record<DesignPhase, PhaseSchedule>> = {};
  const floor = businessDay(parseISO(anchor));
  let cursor: Date | null = null;

  for (const phase of DESIGN_PHASES) {
    if (Object.hasOwn(locked, phase)) {
      const end = locked[phase];
      if (end) {
        const parsed = parseISO(end);
        if (!cursor || parsed > cursor) cursor = parsed;
      }
      continue;
    }

    if (phase === "review") {
      // Floored like every other phase: if the run of locked phases before it
      // all ended months ago, the milestone belongs today, not back there.
      const at = cursor && cursor > floor ? cursor : floor;
      out[phase] = { planned_start: isoDay(at), planned_end: isoDay(at) };
      continue;
    }

    const days = durations[phase];
    if (days == null || days <= 0) continue;

    const next = cursor ? businessDay(addBusinessDays(cursor, 1)) : floor;
    const start = next < floor ? floor : next;
    // Inclusive: a 1-day phase starts and ends the same day.
    const end = addBusinessDays(start, days - 1);
    out[phase] = { planned_start: isoDay(start), planned_end: isoDay(end) };
    cursor = end;
  }

  return out;
}

/**
 * Working days in `[start, end]`, inclusive — the inverse of the chain above,
 * so a phase dated by hand still carries a `duration_days` the Active → SD
 * gate, `isDelegationComplete` and the workload rate can read. `0` when the
 * span is empty or holds only weekend days.
 */
export function businessDaysBetween(start: string, end: string): number {
  const a = parseISO(start);
  const b = parseISO(end);
  if (b < a) return 0;
  let n = 0;
  for (let d = a; d <= b; d = addBusinessDays(d, 1)) {
    if (isWeekend(d)) {
      // addBusinessDays never lands on a weekend, so only the first day can.
      d = nextMonday(d);
      if (d > b) break;
    }
    n += 1;
  }
  return n;
}

/**
 * Last day of a span of `days` working days starting at `start`, weekend
 * start pushed to Monday — one row of the chain, for typing a duration into
 * a phase that already has a start.
 */
export function endOfSpan(start: string, days: number): string {
  const first = businessDay(parseISO(start));
  return isoDay(addBusinessDays(first, Math.max(1, Math.floor(days)) - 1));
}

/**
 * Why a hand-entered pair is unusable, or null when it is fine. Undated (both
 * null) is fine — a phase may simply not be scheduled yet. Half-dated is not:
 * every consumer treats a row with one date as undated, so the second date
 * would be silently ignored.
 */
export function phaseDateError(
  start: string | null,
  end: string | null,
): string | null {
  if (!start && !end) return null;
  if (!start || !end) return "Set both dates, or neither.";
  if (end < start) return "The end date is before the start.";
  if (businessDaysBetween(start, end) < 1) {
    return "The span has no working day in it.";
  }
  return null;
}

/**
 * Review is a zero-width milestone on the end of Design development
 * (WORKFLOW-2 §3). With explicit dates it is still not entered by hand: it
 * follows DD wherever DD is put.
 */
export function reviewMilestone(
  ddEnd: string | null,
): PhaseSchedule | null {
  return ddEnd ? { planned_start: ddEnd, planned_end: ddEnd } : null;
}

export function heldDaysLabel(since: string | null | undefined): string {
  if (!since) return "Paused";
  const days = Math.max(
    0,
    differenceInCalendarDays(new Date(), parseISO(since)),
  );
  return days === 0 ? "Paused today" : `Paused ${days}d`;
}
