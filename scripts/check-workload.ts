import { parseISO } from "date-fns";

import {
  buildWorkload,
  formatHours,
  overlapsWeek,
  summarise,
  weekOf,
  weeklyRate,
  type WorkloadAssignment,
} from "../lib/workload";

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

// --- week bounds ---------------------------------------------------------
// Mon 2026-08-17 … Sun 2026-08-23.
check("mid-week resolves to its Monday", weekOf(parseISO("2026-08-19")).start, "2026-08-17");
check("mid-week resolves to its Sunday", weekOf(parseISO("2026-08-19")).end, "2026-08-23");
check("Monday is its own week start", weekOf(parseISO("2026-08-17")).start, "2026-08-17");
check("Sunday belongs to the week that began", weekOf(parseISO("2026-08-23")).start, "2026-08-17");
check("Sunday does not roll forward", weekOf(parseISO("2026-08-23")).end, "2026-08-23");
check("Saturday stays in the same week", weekOf(parseISO("2026-08-22")).start, "2026-08-17");
check("month boundary", weekOf(parseISO("2026-09-01")).start, "2026-08-31");
check("year boundary", weekOf(parseISO("2027-01-01")).start, "2026-12-28");

const week = weekOf(parseISO("2026-08-19"));

// --- weekly rate ---------------------------------------------------------
// duration_days are WORKING days, so a week is five of them.
check("10 working days is two weeks", weeklyRate(24, 10), 12);
check("5 working days is one week", weeklyRate(40, 5), 40);
check("1 working day is a fifth of a week", weeklyRate(8, 1), 40);
check("20 working days is four weeks", weeklyRate(30, 20), 7.5);
check("hours below a full week still spread", weeklyRate(3, 15), 1);
check("0 hours is a budget, not an absence", weeklyRate(0, 10), 0);
check("null hours yield no rate", weeklyRate(null, 10), null);
check("null duration yields no rate", weeklyRate(12, null), null);
check("zero duration never divides", weeklyRate(12, 0), null);
check("negative duration yields no rate", weeklyRate(12, -5), null);

// --- formatting ----------------------------------------------------------
check("whole hours lose the decimal", formatHours(12), "12");
check("a third of a week rounds to one decimal", formatHours(7.5), "7.5");
check("repeating decimals round", formatHours(10 / 3), "3.3");
check("rounding to a whole drops the .0", formatHours(11.98), "12");
check("zero formats as zero", formatHours(0), "0");

// --- overlap -------------------------------------------------------------
check("spanning the whole week overlaps", overlapsWeek("2026-08-10", "2026-08-28", week), true);
check("ending on the Monday overlaps", overlapsWeek("2026-08-03", "2026-08-17", week), true);
check("starting on the Sunday overlaps", overlapsWeek("2026-08-23", "2026-09-04", week), true);
check("ending the Friday before does not", overlapsWeek("2026-08-03", "2026-08-14", week), false);
check("starting the Monday after does not", overlapsWeek("2026-08-24", "2026-08-28", week), false);
check("one day inside overlaps", overlapsWeek("2026-08-19", "2026-08-19", week), true);
check("no start means no overlap", overlapsWeek(null, "2026-08-19", week), false);
check("no end means no overlap", overlapsWeek("2026-08-19", null, week), false);

// --- grouping ------------------------------------------------------------
const phase = (over: Partial<WorkloadAssignment>): WorkloadAssignment => ({
  projectId: "p1",
  projectNumber: "MK-0400",
  projectName: "Elm Street",
  onHold: false,
  phase: "schematic_design",
  assigneeId: "dana",
  plannedStart: "2026-08-17",
  plannedEnd: "2026-08-28",
  plannedHours: 24,
  durationDays: 10,
  ...over,
});

const users = [
  { id: "dana", name: "Dana Whitfield" },
  { id: "ines", name: "Ines Okafor" },
];

const twoPhases = buildWorkload({
  assignments: [
    phase({}),
    phase({
      projectId: "p2",
      projectNumber: "MK-0401",
      phase: "permitting",
      plannedHours: 20,
      durationDays: 10,
    }),
  ],
  users,
  week,
});

check("a group per roster member", twoPhases.map((p) => p.userId), ["dana", "ines"]);
check("both phases land on Dana", twoPhases[0].rows.length, 2);
check("rates sum into the header", twoPhases[0].weeklyHours, 22);
check("counted rows are reported", twoPhases[0].counted, 2);
check("no gaps when everything is planned", twoPhases[0].missingHours, 0);
check("an unassigned member has no rows", twoPhases[1].rows.length, 0);
check("an empty person has no hours, not zero hours", twoPhases[1].weeklyHours, null);

// A phase can be assigned, in progress, and yield no hours figure. It must
// never read as 0h — that is the whole point of Slice 9's honesty rule.
const noHours = buildWorkload({
  assignments: [phase({ plannedHours: null })],
  users,
  week,
});
check("missing hours never total to 0", noHours[0].weeklyHours, null);
check("missing hours are counted as a gap", noHours[0].missingHours, 1);
check("the row is still listed", noHours[0].rows.length, 1);
check("the gap is named", noHours[0].rows[0].gap, "no_hours");
check("nothing counts toward the week", noHours[0].counted, 0);

// Review carries null hours by design — a gate consumes none.
const gate = buildWorkload({
  assignments: [
    phase({}),
    phase({ projectId: "p2", phase: "review", plannedHours: null, durationDays: null }),
  ],
  users,
  week,
});
check("a gate does not drag the total to null", gate[0].weeklyHours, 12);
check("a gate still registers as a gap", gate[0].missingHours, 1);

// Dates absent: week membership is unknowable, so the row cannot be counted
// even though its rate is derivable.
const noDates = buildWorkload({
  assignments: [phase({ plannedStart: null, plannedEnd: null })],
  users,
  week,
});
check("undated work is excluded from the total", noDates[0].weeklyHours, null);
check("undated work is a dates gap", noDates[0].missingDates, 1);
check("undated work is not an hours gap", noDates[0].missingHours, 0);
check("the derivable rate is still exposed", noDates[0].rows[0].weeklyRate, 12);

// Dated outside the week: knowledge, not absence — excluded and NOT a gap.
const elsewhere = buildWorkload({
  assignments: [phase({ plannedStart: "2026-09-07", plannedEnd: "2026-09-18" })],
  users,
  week,
});
check("other weeks do not count", elsewhere[0].weeklyHours, null);
check("other weeks are not a gap", elsewhere[0].missingHours + elsewhere[0].missingDates, 0);
check("other weeks are still listed", elsewhere[0].rows.length, 1);
check("other weeks are labelled", elsewhere[0].rows[0].gap, "other_week");

// 0 hours is a real budget and must survive as 0, not become null.
const zero = buildWorkload({
  assignments: [phase({ plannedHours: 0 })],
  users,
  week,
});
check("an explicit zero budget totals 0", zero[0].weeklyHours, 0);
check("an explicit zero budget is not a gap", zero[0].missingHours, 0);

// Ordering is by project number, then workflow phase order.
const ordered = buildWorkload({
  assignments: [
    phase({ projectId: "p2", projectNumber: "MK-0402", phase: "permitting" }),
    phase({ projectId: "p1", projectNumber: "MK-0400", phase: "design_development" }),
    phase({ projectId: "p1b", projectNumber: "MK-0400", phase: "schematic_design" }),
  ],
  users,
  week,
});
check(
  "rows sort by project then phase order",
  ordered[0].rows.map((r) => `${r.projectNumber}:${r.phase}`),
  ["MK-0400:schematic_design", "MK-0400:design_development", "MK-0402:permitting"],
);

// An assignee off the roster is surfaced, never silently dropped.
const orphan = buildWorkload({
  assignments: [phase({ assigneeId: "ghost" })],
  users,
  week,
});
check("orphaned assignees get their own group", orphan.length, 3);
check("orphan group is last", orphan[2].userId, "__unknown__");
check("orphan work is not lost", orphan[2].rows.length, 1);
check("no orphan group when everyone is known", twoPhases.length, 2);

// --- summary -------------------------------------------------------------
const mixed = buildWorkload({
  assignments: [
    phase({}),
    phase({ projectId: "p2", plannedHours: null }),
    phase({ projectId: "p3", plannedStart: null, plannedEnd: null }),
    phase({ projectId: "p4", assigneeId: "ines" }),
  ],
  users,
  week,
});
check("summary counts people carrying work", summarise(mixed).people, 2);
check("summary counts in-progress phases", summarise(mixed).inProgress, 4);
check("summary counts what the week accounts for", summarise(mixed).counted, 2);
check("summary counts what it cannot", summarise(mixed).gaps, 2);
check("empty roster summarises to zeroes", summarise([]), {
  people: 0,
  inProgress: 0,
  counted: 0,
  gaps: 0,
});

console.log(
  failures === 0 ? "\nworkload: all checks passed" : `\nworkload: ${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
