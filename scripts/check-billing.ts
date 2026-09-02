import {
  UNASSIGNED,
  csvCell,
  filterRows,
  formatHours,
  hoursByPerson,
  phaseRows,
  rollup,
  toCsv,
  type PhaseRow,
} from "../lib/billing";
import type { DesignPhase, ProjectWithRelations } from "../lib/types";

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

const row = (
  projectId: string,
  phase: DesignPhase,
  assigneeId: string | null,
  plannedHours: number | null,
  extra: Partial<PhaseRow> = {},
): PhaseRow => ({
  projectId,
  phase,
  assigneeId,
  plannedHours,
  plannedStart: null,
  plannedEnd: null,
  status: "not_started",
  ...extra,
});

// --- phaseRows -----------------------------------------------------------
// A project shaped like the repo hands back: six phase rows, Review included.
const project = {
  id: "p1",
  phases: [
    { phase: "schematic_design", assignee_id: "dana", planned_hours: 20, planned_start: "2026-09-01", planned_end: "2026-09-12", status: "completed" },
    { phase: "design_development", assignee_id: "dana", planned_hours: 30, planned_start: "2026-09-15", planned_end: "2026-10-02", status: "in_progress" },
    { phase: "review", assignee_id: null, planned_hours: null, planned_start: "2026-10-02", planned_end: "2026-10-02", status: "not_started" },
    { phase: "construction_documents", assignee_id: "marcus", planned_hours: 45, planned_start: null, planned_end: null, status: "not_started" },
    { phase: "final_review", assignee_id: "marcus", planned_hours: null, planned_start: null, planned_end: null, status: "not_started" },
    { phase: "permitting", assignee_id: null, planned_hours: 4, planned_start: null, planned_end: null, status: "not_started" },
  ],
} as unknown as ProjectWithRelations;

const rows = phaseRows([project]);
check("five delegated phases, Review skipped", rows.map((r) => r.phase), [
  "schematic_design",
  "design_development",
  "construction_documents",
  "final_review",
  "permitting",
]);
check("carries the assignee", rows[0].assigneeId, "dana");
check("carries the hours", rows[0].plannedHours, 20);
check("carries the dates", [rows[0].plannedStart, rows[0].plannedEnd], ["2026-09-01", "2026-09-12"]);
check("carries the status", rows[1].status, "in_progress");
check("missing hours stay null", rows[3].plannedHours, null);
check("empty input", phaseRows([]), []);

// --- filter --------------------------------------------------------------
const many = [
  ...rows,
  row("p2", "schematic_design", "dana", 10),
  row("p2", "design_development", "priya", 0),
  row("p2", "construction_documents", null, null),
];
const none = { projectId: null, userId: null };
check("no filter keeps everything", filterRows(many, none).length, 8);
check("project filter", filterRows(many, { ...none, projectId: "p2" }).length, 3);
check(
  "person filter spans projects",
  filterRows(many, { ...none, userId: "dana" }).map((r) => r.projectId),
  ["p1", "p1", "p2"],
);
check(
  "unassigned filter",
  filterRows(many, { ...none, userId: UNASSIGNED }).map((r) => `${r.projectId}:${r.phase}`),
  ["p1:permitting", "p2:construction_documents"],
);
check("filters combine", filterRows(many, { projectId: "p1", userId: "marcus" }).length, 2);

// --- rollup --------------------------------------------------------------
const r = rollup(many);
check("grand total counts only planned hours", r.total, 109);
check("grand unplanned count", r.unplanned, 2);
check("projects by hours desc", r.projects.map((p) => p.projectId), ["p1", "p2"]);
check("p1 hours", r.projects[0].hours, 99);
check("p1 unplanned", r.projects[0].unplanned, 1);
check(
  "p1 people by hours desc, unassigned last",
  r.projects[0].people.map((p) => p.userId),
  ["dana", "marcus", null],
);
check("dana on p1", r.projects[0].people[0].hours, 50);
check("marcus on p1 has one unplanned", r.projects[0].people[1].unplanned, 1);
check("marcus on p1 sums only the planned one", r.projects[0].people[1].hours, 45);
check(
  "phases inside a person stay in phase order",
  r.projects[0].people[1].rows.map((x) => x.phase),
  ["construction_documents", "final_review"],
);
// Ties at 0 h: unassigned ("" ) sorts before "priya" by key, so the order is
// dana, unassigned, priya — and stays that way between renders.
check("p2 people order under a tie", r.projects[1].people.map((p) => p.userId), ["dana", null, "priya"]);
check("a zero budget is a real zero, not unplanned", r.projects[1].people[2].hours, 0);
check("zero budget not counted as unplanned", r.projects[1].people[2].unplanned, 0);
check("empty rollup", rollup([]), { projects: [], total: 0, unplanned: 0 });

// Float noise: 0.1 + 0.2 must come out as 0.3.
check(
  "sum rounds once",
  rollup([row("p9", "schematic_design", "a", 0.1), row("p9", "design_development", "a", 0.2)]).total,
  0.3,
);

// Ties: equal hours fall back to id so the order never flips between renders.
const tied = rollup([row("pb", "schematic_design", "x", 1), row("pa", "schematic_design", "y", 1)]);
check("tie order is stable", tied.projects.map((p) => p.projectId), ["pa", "pb"]);

// --- by person -----------------------------------------------------------
check("hours by person across projects", hoursByPerson(many), [
  { userId: "dana", hours: 60, unplanned: 0 },
  { userId: "marcus", hours: 45, unplanned: 1 },
  { userId: null, hours: 4, unplanned: 1 },
  { userId: "priya", hours: 0, unplanned: 0 },
]);

// --- formatting ----------------------------------------------------------
check("whole hours", formatHours(12), "12");
check("half hour", formatHours(12.5), "12.5");
check("no float tail", formatHours(0.1 + 0.2), "0.3");
check("rounds to one decimal", formatHours(1.25), "1.3");

// --- csv -----------------------------------------------------------------
check("plain cell", csvCell("Ortega"), "Ortega");
check("comma is quoted", csvCell("Ortega, rear"), '"Ortega, rear"');
check("quote is doubled", csvCell('12" beam'), '"12"" beam"');
check("newline is quoted", csvCell("a\nb"), '"a\nb"');
check("null is empty", csvCell(null), "");
check("number passes through", csvCell(1.5), "1.5");

const csv = toCsv([
  {
    projectNumber: "MK-0001",
    project: "Ortega Residence, rear addition",
    customer: "Ortega",
    person: "Dana Whitfield",
    phase: "schematic_design",
    status: "in_progress",
    start: "2026-09-01",
    end: "2026-09-12",
    hours: 20,
  },
  {
    projectNumber: "MK-0001",
    project: "Ortega Residence, rear addition",
    customer: "Ortega",
    person: "Unassigned",
    phase: "permitting",
    status: "not_started",
    start: null,
    end: null,
    hours: null,
  },
]);
const lines = csv.split("\r\n");
check(
  "csv header",
  lines[0],
  "Project #,Project,Customer,Person,Phase,Status,Start,End,Planned hours",
);
check(
  "csv row",
  lines[1],
  'MK-0001,"Ortega Residence, rear addition",Ortega,Dana Whitfield,Schematic design,in progress,2026-09-01,2026-09-12,20',
);
check("unplanned exports as an empty cell, never 0", lines[2].endsWith(",,,"), true);
check("csv ends with CRLF", csv.endsWith("\r\n"), true);
check("empty csv is header only", toCsv([]).split("\r\n").length, 2);

console.log(failures === 0 ? "\nbilling: all checks passed" : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
