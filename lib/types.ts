export type UserRole = "admin" | "staff";

/** `backlog` retained for DB compatibility; creation uses `pending`. */
export type ProjectStatus = "backlog" | "pending" | "active" | "completed";

/**
 * Workflow order: SD → DD → Review → CD → Final Review → Permitting
 * (@see docs/handoff/WORKFLOW-2.md)
 */
export type DesignPhase =
  | "schematic_design"
  | "design_development"
  | "review"
  | "construction_documents"
  | "final_review"
  | "permitting";

export type PhaseStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped";

export type ApprovalParty = "client_contact" | "austin" | "client";
export type ApprovalStatus = "pending" | "approved";
export type TransitionDirection = "forward" | "backward";

/**
 * Live board columns. Complete/archived projects are off-board.
 * `active` is the holding column (status=active, current_phase=null).
 */
export type BoardColumn = "pending" | "active" | DesignPhase;

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
  /** External client contact — not the internal client contact on the project. */
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  spouse_name: string | null;
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
  client_desired_completion: string | null;
  project_budget: number | null;
  design_budget: number | null;
  client_contact_id: string | null;
  hours_per_week: number | null;
  archived_at: string | null;
  contract_path: string | null;
  contract_filename: string | null;
  contract_uploaded_at: string | null;
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
  duration_days: number | null;
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

export type ProjectApproval = {
  id: string;
  project_id: string;
  phase: DesignPhase;
  party: ApprovalParty;
  status: ApprovalStatus;
  approved_at: string | null;
  recorded_by: string | null;
  created_at: string;
};

export type PhaseTransition = {
  id: string;
  project_id: string;
  from_column: string | null;
  to_column: string;
  direction: TransitionDirection;
  actor_id: string | null;
  created_at: string;
};

export type Consultant = {
  id: string;
  name: string;
  company: string | null;
  discipline: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectWithRelations = Project & {
  customer: Customer;
  phases: ProjectPhase[];
  activity: ActivityLog[];
  consultants: Consultant[];
};

export const DESIGN_PHASES: DesignPhase[] = [
  "schematic_design",
  "design_development",
  "review",
  "construction_documents",
  "final_review",
  "permitting",
];

/** Phases that receive a delegate + duration at Active. Review excluded. */
export const DELEGATED_PHASES: DesignPhase[] = [
  "schematic_design",
  "design_development",
  "construction_documents",
  "final_review",
  "permitting",
];

export const GATE_PHASES: DesignPhase[] = ["review", "final_review"];

export const BOARD_COLUMNS: BoardColumn[] = [
  "pending",
  "active",
  "schematic_design",
  "design_development",
  "review",
  "construction_documents",
  "final_review",
  "permitting",
];

export const COLUMN_LABELS: Record<BoardColumn, string> = {
  pending: "Pending",
  active: "Active",
  schematic_design: "Schematic design",
  design_development: "Design development",
  review: "Review",
  construction_documents: "Construction documents",
  final_review: "Final review",
  permitting: "Permitting",
};

export function boardColumnOf(project: Project): BoardColumn | null {
  if (project.archived_at || project.status === "completed") {
    return null;
  }
  if (project.status === "pending" || project.status === "backlog") {
    return "pending";
  }
  if (project.status === "active") {
    if (!project.current_phase) return "active";
    return project.current_phase;
  }
  return null;
}

export function isDesignPhase(column: BoardColumn): column is DesignPhase {
  return DESIGN_PHASES.includes(column as DesignPhase);
}

export function isOnBoard(project: Project): boolean {
  return boardColumnOf(project) != null;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
