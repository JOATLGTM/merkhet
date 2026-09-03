"use client";

import { differenceInCalendarDays, format, startOfToday } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";

import { ProjectDetailSheet } from "@/components/projects/project-detail-sheet";
import { Button } from "@/components/ui/button";
import {
  MODES,
  ZOOMS,
  barFor,
  calendarWindow,
  gridBackground,
  isVisible,
  monthBands as monthBandsOf,
  pageFocus,
  ticks as ticksOf,
} from "@/lib/calendar";
import type { Mode, Zoom } from "@/lib/calendar";
import { COLUMN_LABELS, DESIGN_PHASES, boardColumnOf } from "@/lib/types";
import type {
  Consultant,
  Customer,
  DesignPhase,
  ProjectPhase,
  ProjectWithRelations,
  User,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type CalendarViewProps = {
  projects: ProjectWithRelations[];
  users: User[];
  customers: Customer[];
  consultants: Consultant[];
};

const ZOOM_KEY = "merkhet.calendar.zoom";
const MODE_KEY = "merkhet.calendar.mode";

const PHASE_COLOR: Record<DesignPhase, string> = {
  schematic_design: "var(--phase-1)",
  design_development: "var(--phase-2)",
  review: "var(--phase-3)",
  construction_documents: "var(--phase-4)",
  final_review: "var(--phase-5)",
  permitting: "var(--phase-6)",
};

/** Standard AIA phase shorthand — what the labels collapse to on narrow bars. */
const PHASE_ABBR: Record<DesignPhase, string> = {
  schematic_design: "SD",
  design_development: "DD",
  review: "REV",
  construction_documents: "CD",
  final_review: "FR",
  permitting: "PERM",
};

/**
 * Which segments need light text. Darker teal tokens fail WCAG on ink.
 */
const PHASE_NEEDS_LIGHT_TEXT: Record<DesignPhase, boolean> = {
  schematic_design: false,
  design_development: false,
  review: false,
  construction_documents: true,
  final_review: true,
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

const NEVER_CHANGES = () => () => {};

/**
 * Reads a persisted preference without a setState-in-effect cascade: the
 * stored value is an external store with a null server snapshot, and a local
 * override carries changes made this session.
 */
function usePersistedChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const stored = useSyncExternalStore(
    NEVER_CHANGES,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [override, setOverride] = useState<T | null>(null);
  const value =
    override ?? (allowed.includes(stored as T) ? (stored as T) : fallback);

  return [
    value,
    (next: T) => {
      setOverride(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        /* ignore */
      }
    },
  ];
}

export function CalendarView({
  projects,
  users,
  customers,
  consultants,
}: CalendarViewProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = usePersistedChoice<Zoom>(ZOOM_KEY, ZOOMS, "weeks");
  const [mode, setMode] = usePersistedChoice<Mode>(MODE_KEY, MODES, "projects");
  const [showCompleted, setShowCompleted] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [focus, setFocus] = useState(() => startOfToday());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const visible = projects.filter(
    (p) => showCompleted || p.status !== "completed",
  );

  const win = useMemo(() => calendarWindow(focus, zoom), [focus, zoom]);
  const { origin, timelineWidth, rangeEnd } = win;

  const barOf = (start: string, end: string) => barFor(start, end, win);
  const inWindow = (b: { left: number; width: number }) => isVisible(b, win);

  const todayLeft =
    differenceInCalendarDays(new Date(), origin) * win.dayWidth;
  const todayVisible = todayLeft >= 0 && todayLeft <= timelineWidth;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = todayVisible ? todayLeft : timelineWidth / 2;
    el.scrollLeft = Math.max(0, target - el.clientWidth * 0.3);
    // Re-centres when the window moves or the scale changes.
  }, [origin, zoom, todayLeft, todayVisible, timelineWidth]);

  const monthBands = useMemo(() => monthBandsOf(win), [win]);
  const ticks = useMemo(() => ticksOf(win), [win]);
  const grid = useMemo(() => gridBackground(zoom), [zoom]);

  const page = (direction: -1 | 1) =>
    setFocus((f) => pageFocus(f, zoom, direction));

  const phaseBars = (project: ProjectWithRelations, phases: ProjectPhase[]) =>
    DESIGN_PHASES.map((phase) => {
      const row = phases.find((ph) => ph.phase === phase);
      if (!row?.planned_start || !row.planned_end) return null;
      const b = barOf(row.planned_start, row.planned_end);
      if (!inWindow(b)) return null;
      const done = row.status === "completed";
      const label = fitLabel(b.width, COLUMN_LABELS[phase], PHASE_ABBR[phase]);
      const lightText = !done && PHASE_NEEDS_LIGHT_TEXT[phase];
      const hours =
        row.planned_hours != null ? ` · ${row.planned_hours}h planned` : "";

      return (
        <button
          key={`${project.id}-${phase}`}
          type="button"
          onClick={() => setProjectId(project.id)}
          title={`${COLUMN_LABELS[phase]} — ${row.planned_start} → ${row.planned_end}${hours}`}
          className="absolute top-3 flex h-5 origin-left items-center overflow-hidden border border-surface"
          style={{ left: b.left, width: b.width }}
        >
          {/* Fill is its own layer so dimming a completed phase doesn't drag
              its label below AA. */}
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
                row.status === "in_progress" && "font-semibold",
                lightText ? "text-paper" : "text-ink",
              )}
            >
              {label}
            </span>
          )}
        </button>
      );
    });

  // --- project mode ------------------------------------------------------

  const projectRows = useMemo(() => {
    return visible.map((project) => {
      const dates = [
        ...project.phases.flatMap((ph) => [ph.planned_start, ph.planned_end]),
        project.start_date,
        project.target_completion,
      ].filter((d): d is string => Boolean(d));
      return { project, dates };
    });
  }, [visible]);

  const dated = projectRows.filter((r) => r.dates.length > 0);
  const undated = projectRows.filter((r) => r.dates.length === 0);

  // --- staff mode --------------------------------------------------------

  const staffGroups = useMemo(() => {
    const groups = users.map((user) => {
      const rows = visible
        .map((project) => ({
          project,
          phases: project.phases.filter((ph) => ph.assignee_id === user.id),
        }))
        .filter((r) => r.phases.length > 0);
      const hours = rows.reduce<number | null>(
        (sum, r) =>
          r.phases.reduce<number | null>(
            (acc, ph) =>
              ph.planned_hours == null ? acc : (acc ?? 0) + ph.planned_hours,
            sum,
          ),
        null,
      );
      return { key: user.id, name: user.name, rows, hours };
    });

    const orphanRows = visible
      .map((project) => ({
        project,
        phases: project.phases.filter(
          (ph) =>
            !ph.assignee_id ||
            !users.some((u) => u.id === ph.assignee_id),
        ),
      }))
      .filter((r) => r.phases.length > 0);

    return [
      ...groups,
      { key: "__unassigned__", name: "Unassigned", rows: orphanRows, hours: null },
    ];
  }, [visible, users]);

  const selected = projects.find((p) => p.id === projectId) ?? null;

  const rangeLabel = `${format(origin, "d MMM yyyy")} – ${format(rangeEnd, "d MMM yyyy")}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-rule bg-surface px-5 py-3">
        <h1 className="page-title">Calendar</h1>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-none border-rule-strong px-2 text-[12px]"
            onClick={() => page(-1)}
            aria-label="Earlier"
          >
            ←
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-none border-rule-strong text-[12px]"
            onClick={() => setFocus(startOfToday())}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-none border-rule-strong px-2 text-[12px]"
            onClick={() => page(1)}
            aria-label="Later"
          >
            →
          </Button>
        </div>

        <span className="num font-mono text-[11px] text-ink-soft tabular-nums">
          {rangeLabel}
        </span>

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
            {MODES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "label-caps px-2.5 py-1.5",
                  mode === value
                    ? "bg-phase-5 text-paper"
                    : "text-ink-mid hover:text-ink",
                )}
              >
                {value === "projects" ? "By project" : "By staff"}
              </button>
            ))}
          </div>

          <div className="flex border border-rule-strong">
            {ZOOMS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setZoom(value)}
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
          {/* Left rail */}
          <div className="sticky left-0 z-20 w-56 shrink-0 border-r border-rule bg-surface">
            <div className="h-12 border-b border-rule" />

            {mode === "projects"
              ? dated.map(({ project }) => {
                  const anyVisible = project.phases.some(
                    (ph) =>
                      ph.planned_start &&
                      ph.planned_end &&
                      inWindow(barOf(ph.planned_start, ph.planned_end)),
                  );
                  const col = boardColumnOf(project);
                  return (
                    <button
                      key={project.id}
                      type="button"
                      className="flex h-11 w-full flex-col justify-center gap-0.5 border-b border-rule px-3 text-left hover:bg-muted-fill"
                      onClick={() => setProjectId(project.id)}
                    >
                      <span className="w-full truncate text-[13px] leading-none text-ink">
                        {project.name}
                      </span>
                      {/* Repeats the status here so narrow bars — which can't
                          hold a label — still answer "where is this project". */}
                      <span className="w-full truncate text-[10px] leading-none text-ink-mid">
                        {col
                          ? COLUMN_LABELS[col]
                          : project.status === "completed"
                            ? "Complete"
                            : "—"}
                        {project.on_hold && (
                          <span className="text-redline"> · On hold</span>
                        )}
                        {!anyVisible && (
                          <span className="text-ink-soft"> · outside range</span>
                        )}
                      </span>
                    </button>
                  );
                })
              : staffGroups.map((group) => (
                  <div key={group.key}>
                    <button
                      type="button"
                      className="flex h-11 w-full items-center gap-1.5 border-b border-rule bg-muted-fill px-2 text-left"
                      onClick={() =>
                        setCollapsed((c) => ({
                          ...c,
                          [group.key]: !c[group.key],
                        }))
                      }
                    >
                      {collapsed[group.key] ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
                      )}
                      <span className="flex-1 truncate text-[13px] text-ink">
                        {group.name}
                      </span>
                      <span className="font-mono text-[10px] text-ink-soft tabular-nums">
                        {group.rows.length}
                        {group.hours != null && ` · ${group.hours}h`}
                      </span>
                    </button>
                    {!collapsed[group.key] &&
                      group.rows.map(({ project }) => (
                        <button
                          key={`${group.key}-${project.id}`}
                          type="button"
                          className="flex h-11 w-full items-center border-b border-rule pr-3 pl-7 text-left hover:bg-muted-fill"
                          onClick={() => setProjectId(project.id)}
                        >
                          <span className="w-full truncate text-[13px] leading-none text-ink-mid">
                            {project.name}
                          </span>
                        </button>
                      ))}
                    {!collapsed[group.key] && group.rows.length === 0 && (
                      <div className="flex h-11 items-center border-b border-rule pr-3 pl-7 text-[12px] text-ink-soft">
                        No assigned phases
                      </div>
                    )}
                  </div>
                ))}
          </div>

          {/* Timeline */}
          <div
            className="relative"
            style={{ width: timelineWidth, backgroundImage: grid }}
          >
            <div className="sticky top-0 z-10 h-12 border-b border-rule bg-surface">
              <div className="relative h-6 border-b border-rule">
                {monthBands.map((band) => (
                  <div
                    key={band.label + band.left}
                    className="absolute top-0 flex h-6 items-center overflow-hidden border-r border-rule px-1.5"
                    style={{ left: band.left, width: band.width }}
                  >
                    <span className="label-caps truncate text-ink-mid">
                      {band.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="relative h-6">
                {ticks.map((tick) => (
                  <div
                    key={tick.key}
                    className={cn(
                      "num absolute top-0 flex h-6 items-center overflow-hidden border-r border-rule px-1 text-[9px] text-ink-soft tabular-nums",
                      zoom === "days" &&
                        (tick.date.getDay() === 0 || tick.date.getDay() === 6) &&
                        "text-ink-soft/60",
                    )}
                    style={{ left: tick.left, width: tick.width }}
                  >
                    {zoom === "days"
                      ? `${format(tick.date, "EEEEE")} ${tick.date.getDate()}`
                      : tick.date.getDate()}
                  </div>
                ))}
              </div>
            </div>

            {todayVisible && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-redline"
                style={{ left: todayLeft }}
                aria-label="Today"
              />
            )}

            {mode === "projects"
              ? dated.map(({ project, dates }) => {
                  const hasPhaseDates = project.phases.some(
                    (ph) => ph.planned_start && ph.planned_end,
                  );
                  return (
                    <div
                      key={project.id}
                      className="relative h-11 border-b border-rule"
                      style={{ width: timelineWidth }}
                    >
                      {hasPhaseDates
                        ? phaseBars(project, project.phases)
                        : (() => {
                            const start =
                              project.start_date ??
                              dates[0] ??
                              format(origin, "yyyy-MM-dd");
                            const end =
                              project.target_completion ??
                              dates[dates.length - 1] ??
                              start;
                            const b = barOf(start, end);
                            if (!inWindow(b)) return null;
                            const col = boardColumnOf(project);
                            const statusLabel = col
                              ? COLUMN_LABELS[col]
                              : project.status === "completed"
                                ? "Complete"
                                : "—";
                            const label = fitLabel(b.width, statusLabel);
                            return (
                              <button
                                type="button"
                                onClick={() => setProjectId(project.id)}
                                className="absolute top-3 flex h-5 items-center overflow-hidden border border-rule-strong bg-rule"
                                style={{ left: b.left, width: b.width }}
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
                })
              : staffGroups.map((group) => (
                  <div key={group.key}>
                    <div
                      className="h-11 border-b border-rule bg-muted-fill"
                      style={{ width: timelineWidth }}
                    />
                    {!collapsed[group.key] &&
                      group.rows.map(({ project, phases }) => (
                        <div
                          key={`${group.key}-${project.id}`}
                          className="relative h-11 border-b border-rule"
                          style={{ width: timelineWidth }}
                        >
                          {phaseBars(project, phases)}
                        </div>
                      ))}
                    {!collapsed[group.key] && group.rows.length === 0 && (
                      <div
                        className="h-11 border-b border-rule"
                        style={{ width: timelineWidth }}
                      />
                    )}
                  </div>
                ))}
          </div>
        </div>
      </div>

      {mode === "projects" && undated.length > 0 && (
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
        customers={customers}
        consultants={consultants}
        open={Boolean(selected)}
        onClose={() => {
          setProjectId(null);
          router.refresh();
        }}
      />
    </div>
  );
}
