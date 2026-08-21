import { endOfWeek, format, startOfWeek } from "date-fns";

import { DESIGN_PHASES, type DesignPhase } from "@/lib/types";

/**
 * Per-staff workload arithmetic (Slice 9).
 *
 * React-free on purpose — the week maths and the rate derivation are the only
 * non-trivial parts of the view, and nothing in this repo checks rendering, so
 * they live here where `npm run check:workload` can exercise them
 * (DECISIONS.md, "Headless-checkable arithmetic").
 *
 * The number this module produces answers the open question `NEXT.md` carried:
 * planned hours are for **capacity planning**. Hours ÷ duration = the weekly
 * load a phase puts on the person holding it.
 */

export type Week = {
  /** Monday, `yyyy-MM-dd`. */
  start: string;
  /** Sunday, `yyyy-MM-dd`. */
  end: string;
};

/**
 * The Monday–Sunday week containing `today`. Monday-first matches the calendar
 * window origin (`lib/calendar.ts`), so "this week" means the same span in both
 * views.
 */
export function weekOf(today: Date): Week {
  return {
    start: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    end: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

/**
 * Hours per week a phase implies: budgeted hours spread evenly over its
 * duration. `duration_days` are *working* days (`SLICE_4_SCOPE.md` decision 2),
 * so a week is five of them.
 *
 * Null when it cannot be derived. Planned hours are optional by design and are
 * always null on Review — a gate consumes no hours — and null must never
 * collapse to `0`: "no hours planned" and "0 h planned" are different states
 * (DECISIONS.md). `0` hours is itself a legitimate budget and returns `0`.
 */
export function weeklyRate(
  plannedHours: number | null,
  durationDays: number | null,
): number | null {
  if (plannedHours == null) return null;
  if (durationDays == null || durationDays <= 0) return null;
  return plannedHours / (durationDays / 5);
}

/** Inclusive overlap. ISO `yyyy-MM-dd` compares correctly as a string. */
export function overlapsWeek(
  plannedStart: string | null,
  plannedEnd: string | null,
  week: Week,
): boolean {
  if (!plannedStart || !plannedEnd) return false;
  return plannedStart <= week.end && plannedEnd >= week.start;
}

/** One decimal at most, and no trailing `.0` on whole hours. */
export function formatHours(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** An in-progress, assigned phase — the repo's `listInProgressAssignments` row. */
export type WorkloadAssignment = {
  projectId: string;
  projectNumber: string;
  projectName: string;
  onHold: boolean;
  phase: DesignPhase;
  assigneeId: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  plannedHours: number | null;
  durationDays: number | null;
};

/**
 * Why a row contributes nothing to the header total.
 *
 * `no_dates` and `no_hours` are *gaps* — the phase may well be consuming time
 * this week and we cannot say how much. `other_week` is not a gap: the dates
 * exist and place the work outside this week, which is knowledge, not absence.
 */
export type WorkloadGap = "none" | "no_dates" | "no_hours" | "other_week";

export type WorkloadRow = WorkloadAssignment & {
  weeklyRate: number | null;
  gap: WorkloadGap;
};

export type WorkloadPerson = {
  userId: string;
  name: string;
  /** Every in-progress phase assigned to them, not only this week's. */
  rows: WorkloadRow[];
  /**
   * Summed weekly rate of the rows that overlap the week *and* carry hours.
   * Null — never `0` — when no row could contribute one, so a person with
   * three unplanned phases never renders as `0 h/wk`.
   */
  weeklyHours: number | null;
  /** Rows behind `weeklyHours`. */
  counted: number;
  /** In-week rows with no derivable rate. */
  missingHours: number;
  /** In-progress rows with no planned dates — week membership is unknowable. */
  missingDates: number;
};

const phaseOrder = (phase: DesignPhase) => DESIGN_PHASES.indexOf(phase);

function classify(assignment: WorkloadAssignment, week: Week): WorkloadRow {
  const rate = weeklyRate(assignment.plannedHours, assignment.durationDays);
  const gap: WorkloadGap =
    !assignment.plannedStart || !assignment.plannedEnd
      ? "no_dates"
      : !overlapsWeek(assignment.plannedStart, assignment.plannedEnd, week)
        ? "other_week"
        : rate == null
          ? "no_hours"
          : "none";
  return { ...assignment, weeklyRate: rate, gap };
}

/** Rows nobody on the roster owns. Only reachable via orphaned `assignee_id`. */
export const UNKNOWN_ASSIGNEE = "__unknown__";

/**
 * Groups in-progress assignments by person and totals the week.
 *
 * Everyone passed in gets a group, including people with nothing in progress —
 * an empty person is a fact about the roster, and delegation coverage sits at
 * roughly a fifth of phase rows (`SLICE_11_APPLY.md`), so most of them will be.
 */
export function buildWorkload({
  assignments,
  users,
  week,
}: {
  assignments: WorkloadAssignment[];
  users: { id: string; name: string }[];
  week: Week;
}): WorkloadPerson[] {
  const byAssignee = new Map<string, WorkloadRow[]>();
  const known = new Set(users.map((u) => u.id));

  for (const assignment of assignments) {
    const key = known.has(assignment.assigneeId)
      ? assignment.assigneeId
      : UNKNOWN_ASSIGNEE;
    const rows = byAssignee.get(key);
    if (rows) rows.push(classify(assignment, week));
    else byAssignee.set(key, [classify(assignment, week)]);
  }

  const build = (userId: string, name: string): WorkloadPerson => {
    const rows = (byAssignee.get(userId) ?? []).sort(
      (a, b) =>
        a.projectNumber.localeCompare(b.projectNumber) ||
        phaseOrder(a.phase) - phaseOrder(b.phase),
    );
    let weeklyHours: number | null = null;
    let counted = 0;
    let missingHours = 0;
    let missingDates = 0;

    for (const row of rows) {
      if (row.gap === "none") {
        weeklyHours = (weeklyHours ?? 0) + (row.weeklyRate ?? 0);
        counted += 1;
      } else if (row.gap === "no_hours") {
        missingHours += 1;
      } else if (row.gap === "no_dates") {
        missingDates += 1;
      }
    }

    return { userId, name, rows, weeklyHours, counted, missingHours, missingDates };
  };

  const groups = users.map((user) => build(user.id, user.name));
  if (byAssignee.has(UNKNOWN_ASSIGNEE)) {
    groups.push(build(UNKNOWN_ASSIGNEE, "Unknown assignee"));
  }
  return groups;
}

export type WorkloadSummary = {
  /** People carrying at least one in-progress phase. */
  people: number;
  inProgress: number;
  counted: number;
  /** In-progress phases the week total cannot account for. */
  gaps: number;
};

export function summarise(people: WorkloadPerson[]): WorkloadSummary {
  return people.reduce<WorkloadSummary>(
    (acc, person) => ({
      people: acc.people + (person.rows.length > 0 ? 1 : 0),
      inProgress: acc.inProgress + person.rows.length,
      counted: acc.counted + person.counted,
      gaps: acc.gaps + person.missingHours + person.missingDates,
    }),
    { people: 0, inProgress: 0, counted: 0, gaps: 0 },
  );
}
