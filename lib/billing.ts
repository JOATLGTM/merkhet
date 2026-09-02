import {
  DELEGATED_PHASES,
  type DesignPhase,
  type PhaseStatus,
  type ProjectWithRelations,
} from "@/lib/types";

/**
 * Bill arithmetic: the hours already on each project's phases, rolled up by
 * project and by the person holding the phase. (A CSV export lived here until
 * 2026-09-02 and was removed at the firm's request.)
 *
 * There is no timesheet. The number the firm bills from is
 * `project_phases.planned_hours` — the budget set in Plan schedule — read
 * back per assignee. This module only regroups it and formats it; nothing
 * here writes, and nothing here invents an hour.
 *
 * React-free, like `lib/workload.ts`, so `npm run check:billing` can exercise
 * every grouping without a browser (DECISIONS.md,
 * "Headless-checkable arithmetic").
 *
 * The honesty rule from the workload view holds here: a phase with no planned
 * hours is **not planned**, never `0h`. Totals carry an `unplanned` count so a
 * sum over a half-planned project reads as "at least", not as the answer.
 */

export type PhaseRow = {
  projectId: string;
  phase: DesignPhase;
  /** Null when nobody holds the phase yet. */
  assigneeId: string | null;
  /** Null means not planned. `0` is a real budget of nothing. */
  plannedHours: number | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  status: PhaseStatus;
};

/**
 * One row per delegated phase per project, in phase order. Review is a gate —
 * no person, no hours (WORKFLOW-2 §3) — so it never appears.
 */
export function phaseRows(projects: ProjectWithRelations[]): PhaseRow[] {
  const out: PhaseRow[] = [];
  for (const project of projects) {
    for (const phase of DELEGATED_PHASES) {
      const row = project.phases.find((p) => p.phase === phase);
      if (!row) continue;
      out.push({
        projectId: project.id,
        phase,
        assigneeId: row.assignee_id,
        plannedHours: row.planned_hours,
        plannedStart: row.planned_start,
        plannedEnd: row.planned_end,
        status: row.status,
      });
    }
  }
  return out;
}

export type BillingFilter = {
  projectId: string | null;
  /** A user id, or `"unassigned"` for phases nobody holds. */
  userId: string | null;
};

export const UNASSIGNED = "unassigned";

export function filterRows(rows: PhaseRow[], filter: BillingFilter): PhaseRow[] {
  return rows.filter((r) => {
    if (filter.projectId && r.projectId !== filter.projectId) return false;
    if (filter.userId === UNASSIGNED) return r.assigneeId == null;
    if (filter.userId) return r.assigneeId === filter.userId;
    return true;
  });
}

export type PersonHours = {
  /** Null for phases nobody holds. */
  userId: string | null;
  /** Sum of the phases that carry a budget. */
  hours: number;
  /** Phases in this group with no planned hours. */
  unplanned: number;
  /** Phase order. */
  rows: PhaseRow[];
};

export type ProjectHours = {
  projectId: string;
  hours: number;
  unplanned: number;
  /** Most hours first; ties by user id so the order is stable. */
  people: PersonHours[];
};

export type Rollup = {
  /** Most hours first; ties by project id. */
  projects: ProjectHours[];
  total: number;
  unplanned: number;
};

/** Sums round once, at the end — `numeric(6,1)` rows are exact. */
const round1 = (n: number) => Math.round(n * 10) / 10;

const phaseIndex = (phase: DesignPhase) => DELEGATED_PHASES.indexOf(phase);

function sumRows(rows: PhaseRow[]) {
  let hours = 0;
  let unplanned = 0;
  for (const r of rows) {
    if (r.plannedHours == null) unplanned += 1;
    else hours += r.plannedHours;
  }
  return { hours: round1(hours), unplanned };
}

const keyOf = (id: string | null) => id ?? "";

export function rollup(rows: PhaseRow[]): Rollup {
  const projects = new Map<string, Map<string, PhaseRow[]>>();
  for (const r of rows) {
    const people = projects.get(r.projectId) ?? new Map<string, PhaseRow[]>();
    const list = people.get(keyOf(r.assigneeId)) ?? [];
    list.push(r);
    people.set(keyOf(r.assigneeId), list);
    projects.set(r.projectId, people);
  }

  const out: ProjectHours[] = [];
  for (const [projectId, people] of projects) {
    const groups: PersonHours[] = [];
    for (const [key, list] of people) {
      const sorted = [...list].sort((a, b) => phaseIndex(a.phase) - phaseIndex(b.phase));
      groups.push({ userId: key || null, ...sumRows(sorted), rows: sorted });
    }
    groups.sort(
      (a, b) => b.hours - a.hours || keyOf(a.userId).localeCompare(keyOf(b.userId)),
    );
    out.push({
      projectId,
      hours: round1(groups.reduce((s, g) => s + g.hours, 0)),
      unplanned: groups.reduce((s, g) => s + g.unplanned, 0),
      people: groups,
    });
  }
  out.sort((a, b) => b.hours - a.hours || a.projectId.localeCompare(b.projectId));

  return {
    projects: out,
    total: round1(out.reduce((s, p) => s + p.hours, 0)),
    unplanned: out.reduce((s, p) => s + p.unplanned, 0),
  };
}

/** Hours per person across every project in the set. Most hours first. */
export function hoursByPerson(
  rows: PhaseRow[],
): Array<{ userId: string | null; hours: number; unplanned: number }> {
  const groups = new Map<string, PhaseRow[]>();
  for (const r of rows) {
    const list = groups.get(keyOf(r.assigneeId)) ?? [];
    list.push(r);
    groups.set(keyOf(r.assigneeId), list);
  }
  return [...groups]
    .map(([key, list]) => ({ userId: key || null, ...sumRows(list) }))
    .sort((a, b) => b.hours - a.hours || keyOf(a.userId).localeCompare(keyOf(b.userId)));
}

/** `12`, `12.5` — no trailing zero, one decimal at most (`numeric(6,1)`). */
export function formatHours(value: number): string {
  return String(round1(value));
}
