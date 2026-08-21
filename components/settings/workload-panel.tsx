"use client";

import { formatCardDate } from "@/lib/dates";
import { COLUMN_LABELS, initials } from "@/lib/types";
import { PHASE_TOKEN_CLASS } from "@/lib/phases";
import { cn } from "@/lib/utils";
import {
  formatHours,
  summarise,
  type Week,
  type WorkloadPerson,
  type WorkloadRow,
} from "@/lib/workload";

/**
 * Per-person load for the week containing today (Slice 9).
 *
 * Everything here is precomputed on the server — including the week itself, so
 * no `new Date()` runs during render and the section cannot drift between the
 * server pass and hydration (DECISIONS.md, "SSR determinism").
 *
 * The section reads sparse on purpose. Delegation is backfilled on roughly a
 * fifth of phase rows (`SLICE_11_APPLY.md`), planned hours are optional by
 * design and always absent on Review, and none of that is hidden: a phase with
 * no budget reads "Not planned", never "0h", and every gap is counted next to
 * the total it is missing from.
 */
export function WorkloadPanel({
  people,
  week,
}: {
  people: WorkloadPerson[];
  week: Week;
}) {
  const summary = summarise(people);
  const withWork = people.filter((p) => p.rows.length > 0);
  const idle = people.filter((p) => p.rows.length === 0);

  return (
    <div className="space-y-4">
      <div className="border border-rule bg-surface px-4 py-3">
        <h2 className="label-caps text-ink">Week of {formatCardDate(week.start)}</h2>
        <p className="mt-1.5 text-[13px] text-ink-mid">
          {summary.inProgress === 0 ? (
            "No phase is in progress with an assignee."
          ) : (
            <>
              {summary.inProgress} in-progress {plural(summary.inProgress, "phase", "phases")}{" "}
              across {summary.people} {plural(summary.people, "person", "people")}.{" "}
              {summary.counted} {plural(summary.counted, "counts", "count")} toward this
              week.
            </>
          )}
        </p>
        {summary.gaps > 0 && (
          <p className="mt-1 text-[12px] text-redline">
            {summary.gaps} in-progress {plural(summary.gaps, "phase", "phases")} carry no
            hours or no dates, so the weekly totals below are a floor, not a
            complete picture.
          </p>
        )}
      </div>

      {withWork.map((person) => (
        <PersonCard key={person.userId} person={person} />
      ))}

      {idle.length > 0 && (
        <div className="border border-rule bg-surface px-4 py-3">
          <h3 className="label-caps text-ink-soft">Nothing in progress</h3>
          <p className="mt-1.5 text-[13px] text-ink-mid">
            {idle.map((p) => p.name).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}

function PersonCard({ person }: { person: WorkloadPerson }) {
  const gaps = person.missingHours + person.missingDates;

  return (
    <div className="border border-rule bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-6 w-6 place-items-center rounded-full bg-phase-5 font-mono text-[9px] font-medium text-paper">
            {initials(person.name)}
          </div>
          <span className="text-[14px] text-ink">{person.name}</span>
        </div>
        <div className="text-right">
          {person.weeklyHours == null ? (
            // Two different nulls. With no gaps, every row is dated outside
            // this week and we know they are clear; with gaps we simply
            // cannot say, and must not imply either.
            <span className="text-[13px] text-ink-soft">
              {gaps > 0 ? "No hours planned" : "Nothing this week"}
            </span>
          ) : (
            <span className="font-mono text-[15px] text-ink">
              {formatHours(person.weeklyHours)}
              <span className="ml-1 text-[11px] text-ink-mid">h/wk</span>
            </span>
          )}
          <p className="text-[11px] text-ink-soft">
            {person.rows.length} in progress
            {gaps > 0 && (
              <span className="text-redline">
                {" · "}
                {gaps} not counted
              </span>
            )}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-rule">
        {person.rows.map((row) => (
          <PhaseRow key={`${row.projectId}-${row.phase}`} row={row} />
        ))}
      </ul>
    </div>
  );
}

const GAP_NOTE: Record<WorkloadRow["gap"], string | null> = {
  none: null,
  no_dates: "no dates",
  no_hours: "hours not planned",
  other_week: "not this week",
};

function PhaseRow({ row }: { row: WorkloadRow }) {
  const counted = row.gap === "none";
  const note = GAP_NOTE[row.gap];

  return (
    <li
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
      <span className={cn("min-w-0 flex-1 truncate", counted ? "text-ink" : undefined)}>
        {COLUMN_LABELS[row.phase]}
        <span className="ml-2 text-[12px] text-ink-soft">{row.projectName}</span>
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
        {/* Never `0h` for an absent budget — the two are different states. */}
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
        <span className="w-full text-right text-[11px] text-ink-soft sm:w-auto sm:shrink-0">
          {note}
        </span>
      )}
    </li>
  );
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}
