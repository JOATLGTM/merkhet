"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UNASSIGNED,
  filterRows,
  formatHours,
  hoursByPerson,
  phaseRows,
  rollup,
} from "@/lib/billing";
import {
  COLUMN_LABELS,
  initials,
  type ProjectWithRelations,
  type User,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type BillClientProps = {
  live: ProjectWithRelations[];
  completed: ProjectWithRelations[];
  /** Whole roster including deactivated staff, who can still hold a phase. */
  users: User[];
};

const ALL = "all";

/**
 * Read-only. Every number on this page is `project_phases.planned_hours`,
 * regrouped by project and by the person holding the phase. Changing an hour
 * happens where it always has — Plan schedule, or the phase row on the sheet.
 */
export function BillClient({ live, completed, users }: BillClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [includeCompleted, setIncludeCompleted] = useState(true);
  const projects = useMemo(
    () => (includeCompleted ? [...live, ...completed] : live),
    [live, completed, includeCompleted],
  );
  const projectsById = useMemo(
    () => new Map([...live, ...completed].map((p) => [p.id, p])),
    [live, completed],
  );
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const nameOf = (id: string | null) =>
    id == null ? "Unassigned" : (usersById.get(id)?.name ?? "Former colleague");

  // The sheet's Hours button lands here with ?project=<id>.
  const [projectId, setProjectId] = useState(() => {
    const fromUrl = searchParams.get("project");
    return fromUrl && projectsById.has(fromUrl) ? fromUrl : ALL;
  });
  const [userId, setUserId] = useState(ALL);

  const rows = useMemo(() => phaseRows(projects), [projects]);
  const filtered = useMemo(
    () =>
      filterRows(rows, {
        projectId: projectId === ALL ? null : projectId,
        userId: userId === ALL ? null : userId,
      }),
    [rows, projectId, userId],
  );
  const summary = useMemo(() => rollup(filtered), [filtered]);
  const byPerson = useMemo(() => hoursByPerson(filtered), [filtered]);

  // --- expand state -------------------------------------------------------
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  // --- select items (Base UI renders the raw value without these) ---------
  const projectItems = useMemo(() => {
    const sorted = [...projects].sort((a, b) =>
      a.project_number.localeCompare(b.project_number),
    );
    return [
      { value: ALL, label: "All projects" },
      ...sorted.map((p) => ({
        value: p.id,
        label: `${p.project_number} · ${p.name}${
          p.status === "completed" || p.archived_at ? " (completed)" : ""
        }`,
      })),
    ];
  }, [projects]);
  const personItems = [
    { value: ALL, label: "Everyone" },
    ...users.map((u) => ({
      value: u.id,
      label: u.is_active ? u.name : `${u.name} (deactivated)`,
    })),
    { value: UNASSIGNED, label: "Unassigned phases" },
  ];

  const trigger = "h-9 rounded-none border-rule-strong bg-paper text-[13px]";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-rule bg-surface px-5 py-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="page-title">Bill</h1>
          <span className="text-[13px] text-ink-mid">
            Planned hours on each project, by the person holding the phase.
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-64">
            <span className="label-caps text-ink-soft">Project</span>
            <Select
              items={projectItems}
              value={projectId}
              onValueChange={(v) => setProjectId(v ?? ALL)}
            >
              <SelectTrigger className={cn("mt-1 w-full", trigger)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projectItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-44">
            <span className="label-caps text-ink-soft">Person</span>
            <Select
              items={personItems}
              value={userId}
              onValueChange={(v) => setUserId(v ?? ALL)}
            >
              <SelectTrigger className={cn("mt-1 w-full", trigger)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {personItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex h-9 items-center gap-2 text-[13px] text-ink">
            <Checkbox
              checked={includeCompleted}
              onCheckedChange={(v) => setIncludeCompleted(Boolean(v))}
            />
            Include completed
          </label>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-paper px-5 py-5">
        {/* ---- totals ----------------------------------------------------- */}
        <section className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <span className="label-caps text-ink-soft">
              {summary.unplanned > 0 ? "At least" : "Total"}
            </span>
            <div className="num font-mono text-[22px] text-ink tabular-nums">
              {formatHours(summary.total)}
              <span className="text-[13px] text-ink-soft"> h</span>
            </div>
          </div>
          {byPerson.map((row) => (
            <div key={row.userId ?? UNASSIGNED}>
              <span className="label-caps text-ink-soft">{nameOf(row.userId)}</span>
              <div className="num font-mono text-[16px] text-ink-mid tabular-nums">
                {formatHours(row.hours)}
                <span className="text-[12px] text-ink-soft"> h</span>
                {row.unplanned > 0 && (
                  <span className="ml-1.5 text-[11px] text-redline">
                    +{row.unplanned} not planned
                  </span>
                )}
              </div>
            </div>
          ))}
        </section>
        {summary.unplanned > 0 && (
          <p className="mt-2 text-[12px] text-ink-soft">
            {summary.unplanned} {summary.unplanned === 1 ? "phase has" : "phases have"} no
            planned hours, so the totals are a floor. Set them in Plan schedule.
          </p>
        )}

        {/* ---- by project ------------------------------------------------- */}
        <section className="mt-5 space-y-3">
          {summary.projects.length === 0 && (
            <p className="text-[13px] text-ink-soft">
              Nothing to show for this selection.
            </p>
          )}
          {summary.projects.map((group) => {
            const project = projectsById.get(group.projectId);
            return (
              <div key={group.projectId} className="border border-rule bg-surface">
                <div className="flex items-baseline gap-3 border-b border-rule px-4 py-3">
                  <span className="num font-mono text-[11px] text-ink-soft">
                    {project?.project_number ?? "—"}
                  </span>
                  <button
                    type="button"
                    className="flex-1 text-left text-[14px] text-ink hover:underline"
                    onClick={() =>
                      project && router.push(`/?project=${project.id}`)
                    }
                  >
                    {project?.name ?? "Deleted project"}
                    {project && (
                      <span className="text-ink-soft"> · {project.customer.name}</span>
                    )}
                  </button>
                  {group.unplanned > 0 && (
                    <span className="text-[11px] text-redline">
                      {group.unplanned} not planned
                    </span>
                  )}
                  <span className="num font-mono text-[14px] text-ink tabular-nums">
                    {formatHours(group.hours)}
                    <span className="text-[12px] text-ink-soft"> h</span>
                  </span>
                </div>

                {group.people.map((person) => {
                  const key = `${group.projectId}:${person.userId ?? ""}`;
                  const open = expanded.has(key);
                  const name = nameOf(person.userId);
                  return (
                    <div key={key} className="border-b border-rule last:border-b-0">
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-paper"
                      >
                        {open ? (
                          <ChevronDown className="h-3.5 w-3.5 text-ink-soft" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-ink-soft" />
                        )}
                        <div
                          className={cn(
                            "grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[9px] font-medium",
                            person.userId
                              ? "bg-phase-5 text-paper"
                              : "border border-dashed border-rule-strong text-ink-soft",
                          )}
                        >
                          {person.userId ? initials(name) : "—"}
                        </div>
                        <span className="flex-1 text-[13px] text-ink">{name}</span>
                        <span className="text-[11px] text-ink-soft">
                          {person.rows.length}{" "}
                          {person.rows.length === 1 ? "phase" : "phases"}
                        </span>
                        {person.unplanned > 0 && (
                          <span className="text-[11px] text-redline">
                            {person.unplanned} not planned
                          </span>
                        )}
                        <span className="num w-16 text-right font-mono text-[13px] text-ink tabular-nums">
                          {formatHours(person.hours)}
                          <span className="text-[11px] text-ink-soft"> h</span>
                        </span>
                      </button>

                      {open && (
                        <table className="w-full border-t border-rule bg-paper text-[12px]">
                          <thead>
                            <tr className="text-left">
                              <th className="label-caps px-4 py-1.5 pl-[3.25rem] font-normal text-ink-soft">
                                Phase
                              </th>
                              <th className="label-caps px-2 py-1.5 font-normal text-ink-soft">
                                Status
                              </th>
                              <th className="label-caps px-2 py-1.5 font-normal text-ink-soft">
                                Dates
                              </th>
                              <th className="label-caps px-4 py-1.5 text-right font-normal text-ink-soft">
                                Planned hours
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {person.rows.map((r) => (
                              <tr key={r.phase} className="border-t border-rule">
                                <td className="px-4 py-1.5 pl-[3.25rem] text-ink">
                                  {COLUMN_LABELS[r.phase]}
                                </td>
                                <td className="label-caps px-2 py-1.5 text-ink-soft">
                                  {r.status.replaceAll("_", " ")}
                                </td>
                                <td className="num px-2 py-1.5 font-mono text-ink-mid tabular-nums">
                                  {r.plannedStart && r.plannedEnd ? (
                                    <>
                                      {r.plannedStart}
                                      <span className="text-ink-soft"> → </span>
                                      {r.plannedEnd}
                                    </>
                                  ) : (
                                    <span className="text-ink-soft">—</span>
                                  )}
                                </td>
                                <td className="num px-4 py-1.5 text-right font-mono tabular-nums">
                                  {r.plannedHours == null ? (
                                    <span className="text-redline">Not planned</span>
                                  ) : (
                                    <span className="text-ink">
                                      {formatHours(r.plannedHours)}
                                      <span className="text-[11px] text-ink-soft"> h</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
