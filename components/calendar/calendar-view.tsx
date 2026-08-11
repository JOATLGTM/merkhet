"use client";

import {
  addWeeks,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ProjectDetailSheet } from "@/components/projects/project-detail-sheet";
import { Button } from "@/components/ui/button";
import { COLUMN_LABELS, DESIGN_PHASES, boardColumnOf } from "@/lib/types";
import type { DesignPhase, ProjectWithRelations, User } from "@/lib/types";
import { cn } from "@/lib/utils";

type CalendarViewProps = {
  projects: ProjectWithRelations[];
  users: User[];
};

const ZOOM_KEY = "merkhet.calendar.zoom";

const PHASE_COLOR: Record<DesignPhase, string> = {
  schematic_design: "var(--phase-1)",
  design_development: "var(--phase-2)",
  construction_documents: "var(--phase-3)",
  review: "var(--phase-4)",
  permitting: "var(--phase-5)",
};

/** Standard AIA phase shorthand — what the labels collapse to on narrow bars. */
const PHASE_ABBR: Record<DesignPhase, string> = {
  schematic_design: "SD",
  design_development: "DD",
  construction_documents: "CD",
  review: "REV",
  permitting: "PERM",
};

/**
 * Which segments need light text. phase-4 (#3d7a74) and phase-5 (#1b5450) are
 * dark enough that ink fails WCAG AA (3.59:1 and 2.06:1); paper clears it at
 * 4.79:1 and 8.34:1. Ink stays on phases 1–3 — phase-3 is the tightest at
 * 6.21:1. Ratios computed, not estimated. See PRD §12.6.
 */
const PHASE_NEEDS_LIGHT_TEXT: Record<DesignPhase, boolean> = {
  schematic_design: false,
  design_development: false,
  construction_documents: false,
  review: true,
  permitting: true,
};

/**
 * Picks the widest label a bar can hold. Bars are laid out in px we already
 * know, so this is a cheap arithmetic fit rather than DOM measurement — the
 * factors approximate Archivo's advance width at 10px.
 */
function fitLabel(width: number, full: string, abbr?: string): string | null {
  if (width >= full.length * 5.6 + 10) return full;
  if (abbr && width >= abbr.length * 6.6 + 8) return abbr;
  return null;
}

type Row = {
  project: ProjectWithRelations;
  dates: string[];
};

export function CalendarView({ projects, users }: CalendarViewProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<"weeks" | "months">("weeks");
  const [showCompleted, setShowCompleted] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ZOOM_KEY);
      if (saved === "weeks" || saved === "months") setZoom(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const weekWidth = zoom === "weeks" ? 52 : 26;

  const visible = projects.filter(
    (p) => showCompleted || p.status !== "completed",
  );

  const { dated, undated, weeks, origin } = useMemo(() => {
    const rows: Row[] = visible.map((project) => ({
      project,
      dates: [
        ...project.phases.flatMap((ph) => [
          ph.planned_start,
          ph.planned_end,
        ]),
        project.start_date,
        project.target_completion,
      ].filter((d): d is string => Boolean(d)),
    }));

    const datedRows = rows.filter((r) => r.dates.length > 0);
    const undatedRows = rows.filter((r) => r.dates.length === 0);

    const stamps = datedRows.flatMap((r) =>
      r.dates.map((d) => parseISO(d).getTime()),
    );
    const minDate = stamps.length ? new Date(Math.min(...stamps)) : new Date();
    const maxDate = stamps.length
      ? new Date(Math.max(...stamps))
      : addWeeks(new Date(), 12);

    const originDate = startOfWeek(addWeeks(minDate, -1), { weekStartsOn: 1 });
    const weekCount = Math.max(
      8,
      Math.ceil(differenceInCalendarDays(maxDate, originDate) / 7) + 2,
    );

    return {
      dated: datedRows,
      undated: undatedRows,
      weeks: Array.from({ length: weekCount }, (_, i) =>
        addWeeks(originDate, i),
      ),
      origin: originDate,
    };
  }, [visible]);

  const xOf = (iso: string) =>
    (differenceInCalendarDays(parseISO(iso), origin) / 7) * weekWidth;

  const todayLeft =
    (differenceInCalendarDays(new Date(), origin) / 7) * weekWidth;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, todayLeft - el.clientWidth * 0.3);
  }, [todayLeft, zoom]);

  const setZoomPersist = (value: "weeks" | "months") => {
    setZoom(value);
    try {
      localStorage.setItem(ZOOM_KEY, value);
    } catch {
      /* ignore */
    }
  };

  const selected = projects.find((p) => p.id === projectId) ?? null;
  const timelineWidth = weeks.length * weekWidth;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-rule bg-surface px-5 py-3">
        <h1 className="page-title">Calendar</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-8 rounded-none border-rule-strong text-[12px]",
              showCompleted && "border-phase-5 text-phase-5",
            )}
            onClick={() => setShowCompleted((v) => !v)}
          >
            Completed
          </Button>
          <div className="flex border border-rule-strong">
            {(["weeks", "months"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setZoomPersist(value)}
                className={cn(
                  "label-caps px-2.5 py-1.5",
                  zoom === value
                    ? "bg-phase-5 text-paper"
                    : "text-ink-mid hover:text-ink",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-paper">
        <div className="flex min-w-max">
          <div className="sticky left-0 z-20 w-56 shrink-0 border-r border-rule bg-surface">
            <div className="h-8 border-b border-rule" />
            {dated.map(({ project }) => (
              <button
                key={project.id}
                type="button"
                className="flex h-11 w-full flex-col justify-center gap-0.5 border-b border-rule px-3 text-left hover:bg-muted-fill"
                onClick={() => setProjectId(project.id)}
              >
                <span className="w-full truncate text-[13px] leading-none text-ink">
                  {project.name}
                </span>
                {/* Repeats the status here so narrow bars — which can't hold a
                    label — still answer "where is this project". */}
                <span className="w-full truncate text-[10px] leading-none text-ink-mid">
                  {COLUMN_LABELS[boardColumnOf(project)]}
                  {project.on_hold && (
                    <span className="text-redline"> · On hold</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="relative" style={{ width: timelineWidth }}>
            <div className="sticky top-0 z-10 flex h-8 border-b border-rule bg-surface">
              {weeks.map((week, i) => (
                <div
                  key={week.toISOString()}
                  style={{ width: weekWidth }}
                  className="num shrink-0 border-r border-rule px-1 pt-2 text-[9px] text-ink-soft"
                >
                  {zoom === "weeks"
                    ? format(week, "d MMM").toUpperCase()
                    : week.getDate() <= 7
                      ? format(week, "MMM").toUpperCase()
                      : ""}
                </div>
              ))}
            </div>

            <div
              className="absolute top-0 bottom-0 z-10 w-px bg-redline"
              style={{ left: todayLeft }}
              aria-label="Today"
            />

            {dated.map(({ project, dates }) => {
              const hasPhaseDates = project.phases.some(
                (ph) => ph.planned_start && ph.planned_end,
              );

              return (
                <div
                  key={project.id}
                  className="relative h-11 border-b border-rule"
                  style={{ width: timelineWidth }}
                >
                  {weeks.map((week, i) => (
                    <div
                      key={week.toISOString()}
                      className="absolute top-0 bottom-0 border-r border-rule/60"
                      style={{ left: i * weekWidth, width: weekWidth }}
                    />
                  ))}

                  {hasPhaseDates
                    ? DESIGN_PHASES.map((phase, index) => {
                        const row = project.phases.find(
                          (ph) => ph.phase === phase,
                        );
                        if (!row?.planned_start || !row.planned_end) {
                          return null;
                        }
                        const left = xOf(row.planned_start);
                        const width = Math.max(
                          xOf(row.planned_end) - left,
                          6,
                        );
                        const done = row.status === "completed";
                        const current = row.status === "in_progress";
                        const label = fitLabel(
                          width,
                          COLUMN_LABELS[phase],
                          PHASE_ABBR[phase],
                        );
                        // A dimmed fill reads as a pale tint, so ink wins there
                        // regardless of which phase colour is underneath.
                        const lightText =
                          !done && PHASE_NEEDS_LIGHT_TEXT[phase];

                        return (
                          <button
                            key={phase}
                            type="button"
                            onClick={() => setProjectId(project.id)}
                            title={`${COLUMN_LABELS[phase]} — ${row.planned_start} → ${row.planned_end}`}
                            className="absolute top-3 flex h-5 origin-left items-center overflow-hidden border border-surface"
                            style={{
                              left,
                              width,
                              transitionDelay: `${index * 20}ms`,
                            }}
                          >
                            {/* Fill is its own layer so dimming a completed
                                phase doesn't drag its label below AA. */}
                            <span
                              aria-hidden="true"
                              className="absolute inset-0"
                              style={{
                                backgroundColor: PHASE_COLOR[phase],
                                opacity: done ? 0.4 : 1,
                              }}
                            />
                            <span className="sr-only">
                              {`${COLUMN_LABELS[phase]}, ${row.status.replaceAll("_", " ")}`}
                            </span>
                            {label && (
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "relative truncate px-1 text-[10px] leading-none",
                                  current && "font-semibold",
                                  lightText ? "text-paper" : "text-ink",
                                )}
                              >
                                {label}
                              </span>
                            )}
                          </button>
                        );
                      })
                    : (() => {
                        const start =
                          project.start_date ?? dates[0] ?? format(origin, "yyyy-MM-dd");
                        const end =
                          project.target_completion ??
                          dates[dates.length - 1] ??
                          start;
                        const left = xOf(start);
                        const width = Math.max(xOf(end) - left, 6);
                        const statusLabel =
                          COLUMN_LABELS[boardColumnOf(project)];
                        const label = fitLabel(width, statusLabel);
                        return (
                          <button
                            type="button"
                            onClick={() => setProjectId(project.id)}
                            className="absolute top-3 flex h-5 items-center overflow-hidden border border-rule-strong bg-rule"
                            style={{ left, width }}
                            title={`${project.name} — ${statusLabel}, no phase dates set`}
                          >
                            <span className="sr-only">
                              {`${project.name} — ${statusLabel}, no phase dates set`}
                            </span>
                            {label && (
                              <span
                                aria-hidden="true"
                                className="truncate px-1 text-[10px] leading-none text-ink-mid"
                              >
                                {label}
                              </span>
                            )}
                          </button>
                        );
                      })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {undated.length > 0 && (
        <section className="border-t border-rule bg-surface px-5 py-4">
          <h2 className="label-caps text-ink-soft">No dates set</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {undated.map(({ project }) => (
              <li key={project.id}>
                <button
                  type="button"
                  className="border border-rule bg-paper px-2.5 py-1.5 text-[13px] text-ink hover:border-rule-strong"
                  onClick={() => setProjectId(project.id)}
                >
                  {project.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ProjectDetailSheet
        project={selected}
        users={users}
        open={Boolean(selected)}
        onClose={() => {
          setProjectId(null);
          router.refresh();
        }}
      />
    </div>
  );
}
