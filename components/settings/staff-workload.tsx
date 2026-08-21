"use client";

import { ChevronRight } from "lucide-react";

import { formatCardDate } from "@/lib/dates";
import { PHASE_TOKEN_CLASS } from "@/lib/phases";
import { COLUMN_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  UNKNOWN_ASSIGNEE,
  formatHours,
  summarise,
  type Week,
  type WorkloadPerson,
  type WorkloadRow,
} from "@/lib/workload";

/**
 * Per-person weekly load, rendered into the Team table on `/staff` (Slice 9).
 *
 * A column on the roster rather than a surface of its own: the question is
 * "how loaded is this person", which is a fact about a staff member, so it
 * belongs on the row that already names them. The projects behind the number
 * open underneath on click.
 *
 * Everything here is precomputed on the server — including the week itself, so
 * no `new Date()` runs during render and the column cannot drift between the
 * server pass and hydration (DECISIONS.md, "SSR determinism").
 *
 * The numbers are thin on purpose. Delegation is backfilled on roughly a fifth
 * of phase rows (`SLICE_11_APPLY.md`), planned hours are optional by design and
 * always absent on Review, and none of that is smoothed over: a phase with no
 * budget reads "Not planned", never "0h", and every gap is counted beside the
 * total it is missing from.
 */

/** The header line above the roster: which week, and what it cannot see. */
export function WorkloadSummary({
  people,
  week,
}: {
  people: WorkloadPerson[];
  week: Week;
}) {
  const summary = summarise(people);
  // Rows whose assignee is on no roster row have nowhere to render below, so
  // they are called out rather than silently dropped from the totals.
  const orphaned =
    people.find((p) => p.userId === UNKNOWN_ASSIGNEE)?.rows.length ?? 0;

  return (
    <div className="mb-4 border border-rule bg-surface px-4 py-3">
      <h2 className="label-caps text-ink">
        Workload · week of {formatCardDate(week.start)}
      </h2>
      <p className="mt-1.5 text-[13px] text-ink-mid">
        {summary.inProgress === 0
          ? "No phase is in progress with an assignee."
          : `${summary.inProgress} in-progress ${plural(summary.inProgress, "phase", "phases")} across ${summary.people} ${plural(summary.people, "person", "people")}. ${summary.counted} ${plural(summary.counted, "counts", "count")} toward this week.`}
      </p>
      {summary.gaps > 0 && (
        <p className="mt-1 text-[12px] text-redline">
          {summary.gaps} in-progress {plural(summary.gaps, "phase", "phases")} carry
          no hours or no dates, so the figures below are a floor, not a complete
          picture.
        </p>
      )}
      {orphaned > 0 && (
        <p className="mt-1 text-[12px] text-redline">
          {orphaned} in-progress {plural(orphaned, "phase is", "phases are")}{" "}
          assigned to someone who is not on this roster.
        </p>
      )}
    </div>
  );
}

/**
 * The "This week" cell.
 *
 * Three different absences, and the column says which:
 * — `—` nothing in progress at all
 * — "Nothing this week" every phase is dated outside the week; they are clear
 * — "No hours planned" phases are in progress and we cannot say how much
 *
 * Collapsing those into `0 h/wk` would read as idle capacity in all three.
 */
export function WorkloadCell({ person }: { person: WorkloadPerson | undefined }) {
  if (!person || person.rows.length === 0) {
    return <span className="text-[13px] text-ink-soft">—</span>;
  }

  const gaps = person.missingHours + person.missingDates;

  return (
    <>
      {person.weeklyHours == null ? (
        <span className="text-[13px] text-ink-soft">
          {gaps > 0 ? "No hours planned" : "Nothing this week"}
        </span>
      ) : (
        <span className="font-mono text-[14px] text-ink">
          {formatHours(person.weeklyHours)}
          <span className="ml-1 text-[11px] text-ink-mid">h/wk</span>
        </span>
      )}
      <span className="mt-0.5 block text-[11px] text-ink-soft">
        {person.rows.length} in progress
        {gaps > 0 && (
          <span className="text-redline">
            {" · "}
            {gaps} not counted
          </span>
        )}
      </span>
    </>
  );
}

/** The expand affordance, wrapped around the name so the row stays clickable. */
export function WorkloadToggle({
  expanded,
  disabled,
  children,
  onToggle,
}: {
  expanded: boolean;
  disabled: boolean;
  children: React.ReactNode;
  onToggle: () => void;
}) {
  if (disabled) {
    return <div className="flex items-center gap-1.5 pl-[18px]">{children}</div>;
  }

  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="flex items-center gap-1.5 text-left hover:text-ink"
    >
      <ChevronRight
        aria-hidden="true"
        className={cn(
          "h-3 w-3 shrink-0 text-ink-soft transition-transform",
          expanded && "rotate-90",
        )}
      />
      {children}
    </button>
  );
}

const GAP_NOTE: Record<WorkloadRow["gap"], string | null> = {
  none: null,
  no_dates: "no dates — not counted",
  no_hours: "hours not planned",
  other_week: "not this week",
};

/** The projects behind the number, revealed under the person's row. */
export function WorkloadDetail({ person }: { person: WorkloadPerson }) {
  return (
    <ul className="divide-y divide-rule border-l-2 border-phase-5 bg-paper">
      {person.rows.map((row) => {
        const counted = row.gap === "none";
        const note = GAP_NOTE[row.gap];

        return (
          <li
            key={`${row.projectId}-${row.phase}`}
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]",
              !counted && "text-ink-mid",
            )}
          >
            <span
              aria-hidden="true"
              className={cn("h-2.5 w-2.5 shrink-0", PHASE_TOKEN_CLASS[row.phase])}
            />
            <span className="font-mono text-[12px] text-ink-mid">
              {row.projectNumber}
            </span>
            <span
              className={cn("min-w-0 flex-1 truncate", counted && "text-ink")}
            >
              {COLUMN_LABELS[row.phase]}
              <span className="ml-2 text-[12px] text-ink-soft">
                {row.projectName}
              </span>
              {row.onHold && (
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-redline">
                  Paused
                </span>
              )}
            </span>
            <span
              className={cn(
                "w-24 shrink-0 text-right font-mono text-[12px]",
                row.weeklyRate == null
                  ? "text-ink-soft"
                  : counted
                    ? "text-ink"
                    : "text-ink-mid",
              )}
            >
              {/* Never `0h` for an absent budget — different states. */}
              {row.weeklyRate == null
                ? "Not planned"
                : `${formatHours(row.weeklyRate)} h/wk`}
            </span>
            <span className="w-36 shrink-0 text-right font-mono text-[12px] text-ink-soft">
              {row.plannedStart && row.plannedEnd
                ? `${formatCardDate(row.plannedStart)} – ${formatCardDate(row.plannedEnd)}`
                : "Not scheduled"}
            </span>
            {note && (
              <span className="w-full text-right text-[11px] text-ink-soft sm:w-28 sm:shrink-0">
                {note}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}
