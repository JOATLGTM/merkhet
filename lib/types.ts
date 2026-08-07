export type UserRole = "admin" | "staff";
export type ProjectStatus = "backlog" | "pending" | "active" | "completed";
export type DesignPhase =
  | "schematic_design"
  | "design_development"
  | "construction_documents"
  | "review"
  | "permitting";
export type PhaseStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped";

/** Board columns flatten `active` into the five design phases. */
export type BoardColumn = Exclude<ProjectStatus, "active"> | DesignPhase;

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

export type Customer = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  customer_id: string;
  project_number: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  current_phase: DesignPhase | null;
  on_hold: boolean;
  on_hold_since: string | null;
  on_hold_reason: string | null;
  start_date: string | null;
  target_completion: string | null;
  hours_per_week: number | null;
  created_at: string;
  updated_at: string;
};

export type ProjectPhase = {
  id: string;
  project_id: string;
  phase: DesignPhase;
  assignee_id: string | null;
  status: PhaseStatus;
  planned_start: string | null;
  planned_end: string | null;
  entered_at: string | null;
  completed_at: string | null;
  sort_order: number;
};

export type ActivityLog = {
  id: string;
  project_id: string;
  actor_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type PhaseSubscriber = {
  phase: DesignPhase;
  user_id: string;
  created_at: string;
};

export type ProjectWithRelations = Project & {
  customer: Customer;
  phases: ProjectPhase[];
  activity: ActivityLog[];
};

export const DESIGN_PHASES: DesignPhase[] = [
  "schematic_design",
  "design_development",
  "construction_documents",
  "review",
  "permitting",
];

export const BOARD_COLUMNS: BoardColumn[] = [
  "backlog",
  "pending",
  "schematic_design",
  "design_development",
  "construction_documents",
  "review",
  "permitting",
  "completed",
];

export const COLUMN_LABELS: Record<BoardColumn, string> = {
  backlog: "Backlog",
  pending: "Pending",
  schematic_design: "Schematic design",
  design_development: "Design development",
  construction_documents: "Construction documents",
  review: "Review",
  permitting: "Permitting",
  completed: "Completed",
};

export function boardColumnOf(project: Project): BoardColumn {
  if (project.status === "active") {
    if (!project.current_phase) {
      throw new Error("Active project missing current_phase");
    }
    return project.current_phase;
  }
  return project.status;
}

export function isDesignPhase(column: BoardColumn): column is DesignPhase {
  return DESIGN_PHASES.includes(column as DesignPhase);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
