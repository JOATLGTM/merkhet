"use client";

import { format } from "date-fns";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveDelegationAction } from "@/app/actions/projects";
import { unwrap } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PhaseRecipientsPicker } from "@/components/projects/phase-recipients-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  businessDaysBetween,
  deriveSchedule,
  endOfSpan,
  phaseDateError,
  reviewMilestone,
} from "@/lib/dates";
import { COLUMN_LABELS, DELEGATED_PHASES } from "@/lib/types";
import type {
  DesignPhase,
  ProjectWithRelations,
  User,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type DelegationDialogProps = {
  project: ProjectWithRelations;
  users: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Row = {
  assignee_id: string;
  /** `yyyy-MM-dd` or empty. The schedule — typed in, not chained. */
  planned_start: string;
  planned_end: string;
  /**
   * Working days in the span. Kept in step with the dates both ways: typing
   * a duration moves the end, moving a date recounts the duration.
   */
  duration_days: string;
  planned_hours: string;
  /** Who else is copied when the phase starts — see `project_phase_recipients`. */
  notify_ids: string[];
};

/** Permitting is jurisdiction-dependent — WORKFLOW-2 §3 forbids a default. */
const DURATION_HINT: Partial<Record<DesignPhase, string>> = {
  permitting: "Jurisdiction-dependent, typically 10–20 working days",
};

const countDays = (start: string, end: string) =>
  start && end ? businessDaysBetween(start, end) : 0;

export function DelegationDialog({
  project,
  users,
  open,
  onOpenChange,
}: DelegationDialogProps) {
  const [pending, startTransition] = useTransition();

  const initial = useMemo(() => {
    const rows = {} as Record<DesignPhase, Row>;
    for (const phase of DELEGATED_PHASES) {
      const existing = project.phases.find((p) => p.phase === phase);
      const start = existing?.planned_start ?? "";
      const end = existing?.planned_end ?? "";
      rows[phase] = {
        assignee_id: existing?.assignee_id ?? "",
        planned_start: start,
        planned_end: end,
        duration_days:
          start && end
            ? String(countDays(start, end))
            : existing?.duration_days != null
              ? String(existing.duration_days)
              : "",
        planned_hours:
          existing?.planned_hours != null ? String(existing.planned_hours) : "",
        notify_ids: existing?.notify_ids ?? [],
      };
    }
    return rows;
  }, [project.phases]);

  const [rows, setRows] = useState<Record<DesignPhase, Row>>(initial);
  const [anchor, setAnchor] = useState(
    project.start_date ?? format(new Date(), "yyyy-MM-dd"),
  );

  // Remount on project change resets the form — the dialog is keyed by
  // project id at the call site.
  const setRow = (phase: DesignPhase, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [phase]: { ...prev[phase], ...patch } }));

  /* Dates and days stay consistent in both directions. Editing a date
     recounts the days; editing the days moves the end. */
  const setStart = (phase: DesignPhase, start: string) => {
    const row = rows[phase];
    const days = Number(row.duration_days);
    if (start && !row.planned_end && Number.isFinite(days) && days >= 1) {
      setRow(phase, { planned_start: start, planned_end: endOfSpan(start, days) });
      return;
    }
    const n = countDays(start, row.planned_end);
    setRow(phase, {
      planned_start: start,
      duration_days: n >= 1 ? String(n) : row.duration_days,
    });
  };
  const setEnd = (phase: DesignPhase, end: string) => {
    const row = rows[phase];
    const n = countDays(row.planned_start, end);
    setRow(phase, {
      planned_end: end,
      duration_days: n >= 1 ? String(n) : row.duration_days,
    });
  };
  const setDays = (phase: DesignPhase, raw: string) => {
    const row = rows[phase];
    const n = Number(raw);
    if (row.planned_start && Number.isFinite(n) && n >= 1) {
      setRow(phase, {
        duration_days: raw,
        planned_end: endOfSpan(row.planned_start, n),
      });
      return;
    }
    setRow(phase, { duration_days: raw });
  };

  // Phases already worked are not moved by the fill — their dates are history.
  const locked = useMemo(() => {
    const out: Partial<Record<DesignPhase, string | null>> = {};
    for (const p of project.phases) {
      if (p.status !== "not_started") out[p.phase] = p.planned_end;
    }
    return out;
  }, [project.phases]);

  /** One click of the old behaviour: chain every unworked phase from the start date. */
  const fillBackToBack = () => {
    const durations: Partial<Record<DesignPhase, number | null>> = {};
    for (const phase of DELEGATED_PHASES) {
      const n = Number(rows[phase]?.duration_days);
      durations[phase] = Number.isFinite(n) && n > 0 ? n : null;
    }
    const schedule = deriveSchedule({ anchor, durations, locked });
    setRows((prev) => {
      const next = { ...prev };
      for (const phase of DELEGATED_PHASES) {
        const dates = schedule[phase];
        if (!dates) continue;
        next[phase] = {
          ...prev[phase],
          planned_start: dates.planned_start,
          planned_end: dates.planned_end,
          duration_days: String(countDays(dates.planned_start, dates.planned_end)),
        };
      }
      return next;
    });
  };

  const problems = DELEGATED_PHASES.flatMap((phase) => {
    const row = rows[phase];
    if (!row?.assignee_id) return [`${COLUMN_LABELS[phase]}: needs a person`];
    if (!row.planned_start || !row.planned_end) {
      return [`${COLUMN_LABELS[phase]}: needs start and end dates`];
    }
    const problem = phaseDateError(row.planned_start, row.planned_end);
    return problem ? [`${COLUMN_LABELS[phase]}: ${problem}`] : [];
  });

  const review = reviewMilestone(rows.design_development?.planned_end || null);
  const canFill = DELEGATED_PHASES.some((phase) => {
    const n = Number(rows[phase]?.duration_days);
    return Number.isFinite(n) && n > 0 && !Object.hasOwn(locked, phase);
  });

  const plannedHoursTotal = DELEGATED_PHASES.reduce<number | null>(
    (sum, phase) => {
      const raw = rows[phase]?.planned_hours;
      if (!raw) return sum;
      const n = Number(raw);
      return Number.isFinite(n) ? (sum ?? 0) + n : sum;
    },
    null,
  );

  const submit = () => {
    if (problems.length > 0 || !anchor) return;
    startTransition(async () => {
      try {
        unwrap(await saveDelegationAction(
          project.id,
          DELEGATED_PHASES.map((phase) => ({
            phase,
            assignee_id: rows[phase].assignee_id,
            planned_start: rows[phase].planned_start,
            planned_end: rows[phase].planned_end,
            duration_days: countDays(rows[phase].planned_start, rows[phase].planned_end),
            planned_hours: rows[phase].planned_hours
              ? Number(rows[phase].planned_hours)
              : null,
            // The assignee is notified as the delegate; listing them twice
            // would only be deduped downstream, so drop it here.
            notify_ids: rows[phase].notify_ids.filter(
              (id) => id !== rows[phase].assignee_id,
            ),
          })),
          anchor,
        ));
        toast.success("Schedule planned");
        onOpenChange(false);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not save the delegation.",
        );
      }
    });
  };

  const assigneeItems = [
    { label: "Unassigned", value: "" },
    ...users.map((u) => ({ label: u.name, value: u.id })),
  ];

  const dateCell =
    "h-9 rounded-none border-rule-strong bg-paper px-2 font-mono text-[11px] tabular-nums";
  const grid = "grid grid-cols-[1.15fr_8.25rem_8.25rem_3.75rem_4.25rem] items-center gap-3";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Plan {project.name}</DialogTitle>
          <DialogDescription>
            Assign a person and dates to each phase, and choose who else should
            hear when it starts. Phases need not be back to back — put each one
            where the person is free. Days count the working days in the span;
            type a number to move the end date. Planned hours are optional.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3 border-b border-rule pb-4">
          <div>
            <label className="label-caps text-ink-soft" htmlFor="anchor">
              Project starts
            </label>
            <Input
              id="anchor"
              type="date"
              value={anchor}
              onChange={(e) => setAnchor(e.target.value)}
              className="mt-1.5 h-9 w-44 rounded-none border-rule-strong bg-paper font-mono text-[12px]"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-none border-rule-strong text-[13px] font-normal"
            disabled={!anchor || !canFill}
            title="Chain every unworked phase from the project start, using the days in each row"
            onClick={fillBackToBack}
          >
            Fill back to back
          </Button>
        </div>

        <div className={cn(grid, "pb-1")}>
          <span className="label-caps text-ink-soft">Phase / person</span>
          <span className="label-caps text-ink-soft">Start</span>
          <span className="label-caps text-ink-soft">End</span>
          <span className="label-caps text-ink-soft">Days</span>
          <span className="label-caps text-ink-soft">Hours</span>
        </div>

        <div className="space-y-3">
          {DELEGATED_PHASES.map((phase) => {
            const row = rows[phase];
            const status = project.phases.find((p) => p.phase === phase)?.status;
            const problem = phaseDateError(
              row.planned_start || null,
              row.planned_end || null,
            );
            const missingDates = !row.planned_start || !row.planned_end;

            return (
              <div key={phase}>
                <div className={grid}>
                  <div>
                    <div className="flex items-baseline justify-between text-[13px] text-ink">
                      {COLUMN_LABELS[phase]}
                      {status && status !== "not_started" && (
                        <span className="label-caps text-ink-soft">
                          {status.replaceAll("_", " ")}
                        </span>
                      )}
                    </div>
                    <Select
                      items={assigneeItems}
                      value={row.assignee_id}
                      onValueChange={(value) =>
                        setRow(phase, { assignee_id: value ?? "" })
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          "mt-1 h-9 rounded-none border-rule-strong text-[13px]",
                          !row.assignee_id && "border-redline/50",
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Input
                    type="date"
                    aria-label={`Start — ${COLUMN_LABELS[phase]}`}
                    value={row.planned_start}
                    title={problem ?? undefined}
                    onChange={(e) => setStart(phase, e.target.value)}
                    className={cn(
                      dateCell,
                      (missingDates || problem) && "border-redline/50",
                      problem && "border-redline",
                    )}
                  />
                  <Input
                    type="date"
                    aria-label={`End — ${COLUMN_LABELS[phase]}`}
                    value={row.planned_end}
                    min={row.planned_start || undefined}
                    title={problem ?? undefined}
                    onChange={(e) => setEnd(phase, e.target.value)}
                    className={cn(
                      dateCell,
                      (missingDates || problem) && "border-redline/50",
                      problem && "border-redline",
                    )}
                  />

                  <Input
                    type="number"
                    min={1}
                    step="1"
                    inputMode="numeric"
                    aria-label={`Working days — ${COLUMN_LABELS[phase]}`}
                    placeholder="days"
                    value={row.duration_days}
                    onChange={(e) => setDays(phase, e.target.value)}
                    className="h-9 rounded-none border-rule-strong text-right font-mono text-[11px] tabular-nums"
                  />

                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    inputMode="decimal"
                    aria-label={`Planned hours (optional) — ${COLUMN_LABELS[phase]}`}
                    placeholder="—"
                    value={row.planned_hours}
                    onChange={(e) =>
                      setRow(phase, { planned_hours: e.target.value })
                    }
                    className="h-9 rounded-none border-rule-strong text-right font-mono text-[11px] tabular-nums"
                  />
                </div>
                {problem && (
                  <p className="mt-1 text-[11px] text-redline">{problem}</p>
                )}
                {DURATION_HINT[phase] && (
                  <p className="mt-1 text-[11px] text-ink-soft">
                    {DURATION_HINT[phase]}
                  </p>
                )}
                <PhaseRecipientsPicker
                  className="mt-1"
                  users={users}
                  selected={row.notify_ids}
                  assigneeId={row.assignee_id || null}
                  phaseLabel={COLUMN_LABELS[phase]}
                  onChange={(next) => setRow(phase, { notify_ids: next })}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-1 flex items-baseline justify-between border-t border-rule pt-3 text-[12px]">
          <span className="text-ink-soft">
            Review is a gate — no person, no duration, no hours.
            {review ? (
              <span className="font-mono text-ink-mid tabular-nums">
                {" "}
                Milestone {review.planned_start}, on the end of Design development.
              </span>
            ) : (
              <span> It lands on the end of Design development.</span>
            )}
          </span>
          <span className="font-mono text-ink-mid tabular-nums">
            {plannedHoursTotal == null
              ? "No hours planned"
              : `${plannedHoursTotal} h planned`}
          </span>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <span className="self-center text-[12px] text-redline">
            {problems.length > 0 && problems[0]}
            {problems.length > 1 && ` (+${problems.length - 1} more)`}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-none"
              disabled={problems.length > 0 || !anchor || pending}
              onClick={submit}
            >
              {pending ? "Saving…" : "Save schedule"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
