"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updatePhaseDatesAction } from "@/app/actions/projects";
import { Input } from "@/components/ui/input";
import { phaseDateError } from "@/lib/dates";
import type { DesignPhase, ProjectPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The two date cells on a sheet phase row, editable in place.
 *
 * Saves when a pair is complete and valid — on blur of either input — and
 * says why when it is not. A half-entered pair sits in redline and is never
 * sent: every consumer treats one date as no dates, so saving it would throw
 * the other one away silently. Clearing both saves "undated".
 *
 * Keyed by the call site on the server row's values, so a save that comes
 * back resets the local state rather than fighting it.
 */
export function PhaseDates({
  projectId,
  phase,
}: {
  projectId: string;
  phase: ProjectPhase;
}) {
  const [start, setStart] = useState(phase.planned_start ?? "");
  const [end, setEnd] = useState(phase.planned_end ?? "");
  const [pending, startTransition] = useTransition();

  const problem = phaseDateError(start || null, end || null);
  const dirty =
    (start || null) !== phase.planned_start || (end || null) !== phase.planned_end;

  const save = () => {
    if (!dirty || problem) return;
    startTransition(async () => {
      try {
        await updatePhaseDatesAction(
          projectId,
          phase.phase as DesignPhase,
          start || null,
          end || null,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save dates.");
        setStart(phase.planned_start ?? "");
        setEnd(phase.planned_end ?? "");
      }
    });
  };

  const cell =
    "h-9 w-full rounded-none border-rule-strong bg-paper px-2 font-mono text-[11px] tabular-nums";

  return (
    <>
      <Input
        type="date"
        aria-label={`Start — ${phase.phase}`}
        value={start}
        disabled={pending}
        title={problem ?? undefined}
        onChange={(e) => setStart(e.target.value)}
        onBlur={save}
        className={cn(cell, problem && "border-redline")}
      />
      <Input
        type="date"
        aria-label={`End — ${phase.phase}`}
        value={end}
        disabled={pending}
        title={problem ?? undefined}
        onChange={(e) => setEnd(e.target.value)}
        onBlur={save}
        className={cn(cell, problem && "border-redline")}
      />
    </>
  );
}
