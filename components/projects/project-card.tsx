"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pause } from "lucide-react";

import { PhaseRule } from "@/components/projects/phase-rule";
import { dateUrgency, formatCardDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  initials,
  type ProjectWithRelations,
  type User,
} from "@/lib/types";

type ProjectCardProps = {
  project: ProjectWithRelations;
  usersById: Map<string, User>;
  onOpen: (id: string) => void;
  dragging?: boolean;
};

export function ProjectCard({
  project,
  usersById,
  onOpen,
  dragging,
}: ProjectCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id, data: { project } });

  const currentPhaseRow = project.phases.find(
    (p) => p.phase === project.current_phase,
  );
  const assignee = currentPhaseRow?.assignee_id
    ? usersById.get(currentPhaseRow.assignee_id)
    : null;
  const urgency = dateUrgency(project.target_completion);

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "cursor-pointer border border-rule bg-surface p-2.5 outline-none transition-colors",
        "hover:border-rule-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-phase-5",
        project.on_hold && "opacity-60",
        (isDragging || dragging) && "z-20 rotate-[-1deg] opacity-100 shadow-md",
      )}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(project.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(project.id);
        }
      }}
      tabIndex={0}
      role="button"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-medium leading-tight text-ink">
          {project.name}
        </h3>
        {project.on_hold && (
          <Pause className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-soft" />
        )}
      </div>
      <p className="mt-1 text-[13px] text-ink-mid">{project.customer.name}</p>

      <PhaseRule
        currentPhase={project.current_phase}
        className="mt-2.5"
      />

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "grid h-5 w-5 place-items-center rounded-full font-mono text-[8px] font-medium",
              assignee
                ? "bg-phase-5 text-paper"
                : "bg-rule text-ink-soft",
            )}
          >
            {assignee ? initials(assignee.name) : "—"}
          </div>
          {project.hours_per_week != null && project.hours_per_week > 0 && (
            <span className="num font-mono text-[11px] text-ink-mid">
              {project.hours_per_week}h/wk
            </span>
          )}
        </div>
        <span
          className={cn(
            "num font-mono text-[11px]",
            urgency === "alert"
              ? "font-medium text-redline"
              : urgency === "warn"
                ? "font-medium text-warn"
                : "text-ink-soft",
          )}
        >
          {project.target_completion
            ? formatCardDate(project.target_completion).toUpperCase()
            : "—"}
        </span>
      </div>
    </article>
  );
}
