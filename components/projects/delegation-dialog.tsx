"use client";

import { format } from "date-fns";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveDelegationAction } from "@/app/actions/projects";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deriveSchedule } from "@/lib/dates";
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
  duration_days: string;
  planned_hours: string;
};

/** Permitting is jurisdiction-dependent — WORKFLOW-2 §3 forbids a default. */
const DURATION_HINT: Partial<Record<DesignPhase, string>> = {
  permitting: "Jurisdiction-dependent, typically 10–20 working days",
};

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
      rows[phase] = {
        assignee_id: existing?.assignee_id ?? "",
        duration_days:
          existing?.duration_days != null ? String(existing.duration_days) : "",
        planned_hours:
          existing?.planned_hours != null ? String(existing.planned_hours) : "",
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

  // Phases already worked keep their dates; only the rest is re-dated.
  const locked = useMemo(() => {
    const out: Partial<Record<DesignPhase, string | null>> = {};
    for (const p of project.phases) {
      if (p.status !== "not_started") out[p.phase] = p.planned_end;
    }
    return out;
  }, [project.phases]);

  const preview = useMemo(() => {
    const durations: Partial<Record<DesignPhase, number | null>> = {};
    for (const phase of DELEGATED_PHASES) {
      const raw = rows[phase]?.duration_days;
      const n = raw ? Number(raw) : null;
      durations[phase] = n != null && Number.isFinite(n) && n > 0 ? n : null;
    }
    return deriveSchedule({ anchor, durations, locked });
  }, [rows, anchor, locked]);

  const missing = DELEGATED_PHASES.filter((phase) => {
    const row = rows[phase];
    const n = Number(row?.duration_days);
    return (
      !row?.assignee_id ||
      !row.duration_days ||
      !Number.isFinite(n) ||
      n < 1
    );
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
    if (missing.length > 0 || !anchor) return;
    startTransition(async () => {
      try {
        await saveDelegationAction(
          project.id,
          DELEGATED_PHASES.map((phase) => ({
            phase,
            assignee_id: rows[phase].assignee_id,
            duration_days: Number(rows[phase].duration_days),
            planned_hours: rows[phase].planned_hours
              ? Number(rows[phase].planned_hours)
              : null,
          })),
          anchor,
        );
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Plan {project.name}</DialogTitle>
          <DialogDescription>
            Assign a person and a duration to each phase. Dates are calculated
            from the durations — you don&apos;t enter them. Planned hours are
            optional; leave them blank if you don&apos;t know yet.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-rule pb-4">
          <label className="label-caps text-ink-soft" htmlFor="anchor">
            Schedule starts
          </label>
          <Input
            id="anchor"
            type="date"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            className="mt-1.5 h-9 w-44 rounded-none border-rule-strong bg-paper font-mono text-[12px]"
          />
        </div>

        <div className="grid grid-cols-[1fr_5.5rem_5rem_1fr] gap-x-3 gap-y-1 pb-1">
          <span className="label-caps text-ink-soft">Phase / person</span>
          <span className="label-caps text-ink-soft">Days</span>
          <span className="label-caps text-ink-soft">Hours</span>
          <span className="label-caps text-ink-soft">Dates</span>
        </div>

        <div className="space-y-3">
          {DELEGATED_PHASES.map((phase) => {
            const row = rows[phase];
            const dates = preview[phase];
            const isLocked = Object.hasOwn(locked, phase);

            return (
              <div key={phase}>
                <div className="grid grid-cols-[1fr_5.5rem_5rem_1fr] items-center gap-3">
                  <div>
                    <div className="text-[13px] text-ink">
                      {COLUMN_LABELS[phase]}
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
                    type="number"
                    min={1}
                    step="1"
                    inputMode="numeric"
                    aria-label={`Duration in working days — ${COLUMN_LABELS[phase]}`}
                    placeholder="days"
                    value={row.duration_days}
                    onChange={(e) =>
                      setRow(phase, { duration_days: e.target.value })
                    }
                    className={cn(
                      "h-9 rounded-none border-rule-strong text-right font-mono text-[11px] tabular-nums",
                      !row.duration_days && "border-redline/50",
                    )}
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

                  <div className="font-mono text-[11px] text-ink-mid tabular-nums">
                    {isLocked ? (
                      <span className="text-ink-soft">
                        {/* Already worked — dates stay put. */}
                        kept · {project.phases.find((p) => p.phase === phase)
                          ?.planned_end ?? "no dates"}
                      </span>
                    ) : dates ? (
                      <>
                        {dates.planned_start}
                        <span className="text-ink-soft"> → </span>
                        {dates.planned_end}
                      </>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </div>
                </div>
                {DURATION_HINT[phase] && (
                  <p className="mt-1 text-[11px] text-ink-soft">
                    {DURATION_HINT[phase]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-1 flex items-baseline justify-between border-t border-rule pt-3 text-[12px]">
          <span className="text-ink-soft">
            Review is a gate — no person, no duration, no hours.
            {preview.review && (
              <span className="font-mono text-ink-mid tabular-nums">
                {" "}
                Milestone {preview.review.planned_start}.
              </span>
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
            {missing.length > 0 &&
              `Needs a person and duration: ${missing
                .map((p) => COLUMN_LABELS[p])
                .join(", ")}`}
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
              disabled={missing.length > 0 || !anchor || pending}
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
