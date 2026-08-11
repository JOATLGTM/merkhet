"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AlertTriangle, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { moveProjectAction } from "@/app/actions/projects";
import { SubscriberPopover } from "@/components/board/subscriber-popover";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectDetailSheet } from "@/components/projects/project-detail-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { columnTopBorder } from "@/lib/phases";
import { cn } from "@/lib/utils";
import {
  BOARD_COLUMNS,
  COLUMN_LABELS,
  boardColumnOf,
  isDesignPhase,
  type BoardColumn,
  type Customer,
  type PhaseSubscriber,
  type ProjectWithRelations,
  type User,
} from "@/lib/types";

type BoardViewProps = {
  projects: ProjectWithRelations[];
  users: User[];
  customers: Customer[];
  subscribers: PhaseSubscriber[];
  currentUser: User;
};

/**
 * Empty columns were close to undroppable under plain `closestCorners`: it
 * ranks by corner-to-corner distance, and an empty column's only droppable is
 * the full-height container, whose corners sit far from a pointer aimed at its
 * middle. A neighbouring column's card — a small rect with corners right next
 * to the pointer — would win instead. A populated column has cards scattered
 * down it, which is why dropping got easy as soon as one card landed there.
 *
 * `pointerWithin` makes any point inside a column a valid target, so column
 * height stops mattering. It returns nothing when there is no pointer (the
 * keyboard sensor), hence the rect/corner fallbacks — see PRD §12.6, which
 * requires the board to stay fully keyboard-operable.
 */
const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  const intersections = rectIntersection(args);
  return intersections.length > 0 ? intersections : closestCorners(args);
};

function sortColumn(items: ProjectWithRelations[]) {
  return [...items].sort((a, b) => {
    if (a.on_hold !== b.on_hold) return a.on_hold ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function Column({
  column,
  items,
  usersById,
  subscribers,
  users,
  currentUser,
  collapsed,
  onToggle,
  onOpen,
}: {
  column: BoardColumn;
  items: ProjectWithRelations[];
  usersById: Map<string, User>;
  subscribers: PhaseSubscriber[];
  users: User[];
  currentUser: User;
  collapsed: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  const phaseSubs = subscribers.filter((s) => s.phase === column);
  const phase = isDesignPhase(column);

  if (collapsed) {
    return (
      <button
        type="button"
        // Without the ref a collapsed column is not a drop target at all, and
        // Completed ships collapsed (§6.2) — so finishing a project by drag was
        // impossible until you expanded it first.
        ref={setNodeRef}
        onClick={onToggle}
        className={cn(
          "flex w-11 shrink-0 flex-col items-center border border-rule bg-surface pt-3 transition-colors",
          "border-t-2",
          columnTopBorder(column),
          isOver && "bg-phase-1/60",
        )}
      >
        <span className="label-caps writing-mode-vertical rotate-180 text-ink-mid [writing-mode:vertical-rl]">
          {COLUMN_LABELS[column]}
        </span>
        <span className="num mt-2 font-mono text-[11px] text-ink-soft">
          {items.length}
        </span>
      </button>
    );
  }

  return (
    <section className="flex w-[264px] shrink-0 flex-col self-stretch">
      <header
        className={cn(
          "flex items-center gap-2 border border-b-0 border-rule bg-surface px-2.5 py-2",
          "border-t-2",
          columnTopBorder(column),
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          className="text-ink-soft hover:text-ink"
          aria-label="Collapse column"
        >
          ▾
        </button>
        <h2 className="label-caps flex-1 text-ink">{COLUMN_LABELS[column]}</h2>
        <span className="num font-mono text-[11px] text-ink-soft">
          {items.length}
        </span>
        {phase && (
          <div className="ml-1 flex items-center gap-1">
            {phaseSubs.length === 0 && (
              <span title="No subscribers">
                <AlertTriangle className="h-3.5 w-3.5 text-warn" />
              </span>
            )}
            <SubscriberPopover
              phase={column}
              subscribers={phaseSubs}
              users={users}
              canEdit={currentUser.role === "admin"}
            />
          </div>
        )}
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[140px] flex-1 flex-col gap-2 border border-rule bg-paper p-2",
          isOver && "bg-phase-1/40",
        )}
      >
        <SortableContext
          items={items.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              usersById={usersById}
              onOpen={onOpen}
            />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <div
            className={cn(
              "flex flex-1 items-center justify-center border border-dashed px-3 py-8 text-center transition-colors",
              isOver
                ? "border-solid border-phase-5 bg-phase-1/60"
                : "border-rule-strong",
            )}
          >
            <span
              className={cn(
                "label-caps",
                isOver ? "text-phase-5" : "text-ink-soft",
              )}
            >
              Drop here
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

export function BoardView({
  projects,
  users,
  customers,
  subscribers,
  currentUser,
}: BoardViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const [query, setQuery] = useState("");
  const [assigneeId, setAssigneeId] = useState("all");
  const [showOnHold, setShowOnHold] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    completed: true,
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    projects,
    (state, { id, column }: { id: string; column: BoardColumn }) =>
      state.map((p) => {
        if (p.id !== id) return p;
        if (isDesignPhase(column)) {
          return { ...p, status: "active", current_phase: column };
        }
        return {
          ...p,
          status: column as ProjectWithRelations["status"],
          current_phase: null,
        };
      }),
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("merkat-board-collapsed");
      if (raw) setCollapsed(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("merkat-board-collapsed", JSON.stringify(collapsed));
  }, [collapsed]);

  const usersById = new Map(users.map((u) => [u.id, u]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const filtered = optimistic.filter((p) => {
    if (!showOnHold && p.on_hold) return false;
    const q = query.trim().toLowerCase();
    if (
      q &&
      !p.name.toLowerCase().includes(q) &&
      !p.customer.name.toLowerCase().includes(q) &&
      !p.project_number.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (assigneeId !== "all") {
      const current = p.phases.find((ph) => ph.phase === p.current_phase);
      if (current?.assignee_id !== assigneeId) return false;
    }
    return true;
  });

  const byColumn = Object.fromEntries(
    BOARD_COLUMNS.map((column) => [
      column,
      sortColumn(filtered.filter((p) => boardColumnOf(p) === column)),
    ]),
  ) as Record<BoardColumn, ProjectWithRelations[]>;

  const openProject = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", id);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const closeProject = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("project");
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const id = String(active.id);
    let toColumn = String(over.id) as BoardColumn;
    if (!BOARD_COLUMNS.includes(toColumn)) {
      const overProject = optimistic.find((p) => p.id === String(over.id));
      if (!overProject) return;
      toColumn = boardColumnOf(overProject);
    }
    const project = optimistic.find((p) => p.id === id);
    if (!project || boardColumnOf(project) === toColumn) return;

    startTransition(async () => {
      setOptimistic({ id, column: toColumn });
      try {
        await moveProjectAction(id, toColumn);
      } catch {
        toast.error("Could not move project. Rolling back.");
        router.refresh();
      }
    });
  };

  const activeProject = activeId
    ? optimistic.find((p) => p.id === activeId)
    : null;
  const selected = projectId
    ? (optimistic.find((p) => p.id === projectId) ?? null)
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-rule bg-surface px-5 py-3">
        <h1 className="page-title">Board</h1>
        <span className="num font-mono text-[11px] text-ink-soft">
          {filtered.length} projects
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-8 w-56 rounded-none border-rule-strong bg-paper"
          />
          <Select
            // Base UI renders the raw value in the trigger without an items map
            items={[
              { label: "All assignees", value: "all" },
              ...users.map((u) => ({ label: u.name, value: u.id })),
            ]}
            value={assigneeId}
            onValueChange={(value) => setAssigneeId(value ?? "all")}
          >
            <SelectTrigger className="h-8 w-[150px] rounded-none border-rule-strong">
              <SelectValue placeholder="All assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch
              id="on-hold"
              checked={showOnHold}
              onCheckedChange={setShowOnHold}
            />
            <Label htmlFor="on-hold" className="text-[13px] text-ink-mid">
              On hold
            </Label>
          </div>
          <Button
            onClick={() => setNewOpen(true)}
            className="h-8 rounded-none bg-phase-5 px-3 text-[13px] text-paper hover:bg-phase-5/90"
          >
            <Plus className="h-3.5 w-3.5" />
            New project
          </Button>
        </div>
      </header>

      <DndContext
        // dnd-kit derives its a11y ids from a module-level counter, which
        // drifts between the server render and hydration (`DndDescribedBy-0`
        // vs `-1`). An explicit id pins it.
        id="merkat-board"
        sensors={sensors}
        collisionDetection={boardCollisionDetection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto bg-paper p-4">
          {BOARD_COLUMNS.map((column) => (
            <Column
              key={column}
              column={column}
              items={byColumn[column]}
              usersById={usersById}
              subscribers={subscribers}
              users={users}
              currentUser={currentUser}
              collapsed={Boolean(collapsed[column])}
              onToggle={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [column]: !prev[column],
                }))
              }
              onOpen={openProject}
            />
          ))}
        </div>
        <DragOverlay>
          {activeProject ? (
            <ProjectCard
              project={activeProject}
              usersById={usersById}
              onOpen={() => {}}
              dragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <ProjectDetailSheet
        project={selected}
        users={users}
        open={Boolean(selected)}
        onClose={closeProject}
      />
      <NewProjectDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        customers={customers}
      />
    </div>
  );
}
