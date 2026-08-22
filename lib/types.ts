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

/**
 * Who signs off at a gate.
 *
 * `chosen` is the third slot — whoever Austin or Ryan picked for this project.
 * `client_contact` and `client` are retained for rows recorded before
 * 2026-08-21; no gate requires either any more. The client is still reachable,
 * as one of the things `chosen` can resolve to.
 */
export type ApprovalParty =
  | "client_contact"
  | "austin"
  | "ryan"
  | "client"
  | "chosen";
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
  /** The customer's own address (WORKFLOW-2 §3 client fields). */
  address: string | null;
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
  /** Internal staff member who owns the relationship — *not* a phone number. */
  client_contact_id: string | null;
  /**
   * Project-level address and contact. **Null means "same as the customer"**,
   * resolved per field — see `lib/contact.ts`.
   */
  project_address: string | null;
  project_contact_name: string | null;
  project_contact_email: string | null;
  project_contact_phone: string | null;
  hours_per_week: number | null;
  archived_at: string | null;
  contract_path: string | null;
  contract_filename: string | null;
  contract_uploaded_at: string | null;
  /**
   * Staff member who created the project. Null for rows predating the column
   * or whose creator was deleted. The board card falls back to this, muted,
   * when the current phase has no assignee.
   */
  created_by: string | null;
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
  /** Budgeted hours for this phase. Null on Review — a gate, not work. */
  planned_hours: number | null;
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
  /**
   * Who the chosen third actually is. Set only on `party === "chosen"`; null
   * there means **the client**, recorded by staff on their behalf. Not
   * "unset" — rows exist only once approved.
   */
  approver_user_id: string | null;
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
  /** Only ever holds *approved* rows — absence of a row means pending. */
  approvals: ProjectApproval[];
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

export type GatePhase = "review" | "final_review";

/**
 * Who must sign off at each gate.
 *
 * **Supersedes WORKFLOW-2 §3** (user decision, 2026-08-21), which had Review
 * as client contact + Austin + client and Final review as client contact +
 * Austin. Both gates now take the same three, and the difference WORKFLOW-2
 * drew between them is gone on purpose — the firm wanted one rule.
 *
 * The third is a *slot*, not a fixed person: `chosen` is whoever Austin or
 * Ryan picks, which may be a staff member or the client.
 */
export const GATE_PARTIES: Record<GatePhase, ApprovalParty[]> = {
  review: ["austin", "ryan", "chosen"],
  final_review: ["austin", "ryan", "chosen"],
};

/** The party whose identity is picked per project rather than fixed. */
export const CHOSEN_PARTY: ApprovalParty = "chosen";

/** Where a rejected gate sends the project back to. */
export const GATE_REJECT_TARGET: Record<GatePhase, DesignPhase> = {
  review: "design_development",
  final_review: "construction_documents",
};

export const PARTY_LABELS: Record<ApprovalParty, string> = {
  client_contact: "Client contact",
  austin: "Austin",
  ryan: "Ryan",
  client: "Client",
  chosen: "Third sign-off",
};

/** Value the chosen-third picker uses for "the client", who has no user row. */
export const CLIENT_APPROVER = "__client__";

/**
 * Name to show against a recorded sign-off.
 *
 * Only the chosen slot carries an identity; the rest are the party. A chosen
 * row with no user is the client (see `ProjectApproval.approver_user_id`).
 */
export function approverName(
  approval: ProjectApproval,
  userName: (id: string) => string | undefined,
): string {
  if (approval.party !== "chosen") return PARTY_LABELS[approval.party];
  if (!approval.approver_user_id) return "The client";
  return userName(approval.approver_user_id) ?? "Unknown person";
}

export function isGatePhase(phase: DesignPhase | null): phase is GatePhase {
  return phase === "review" || phase === "final_review";
}

export function approvedParties(
  phase: GatePhase,
  approvals: ProjectApproval[],
): Set<ApprovalParty> {
  return new Set(
    approvals
      .filter((a) => a.phase === phase && a.status === "approved")
      .map((a) => a.party),
  );
}

export function pendingParties(
  phase: GatePhase,
  approvals: ProjectApproval[],
): ApprovalParty[] {
  const done = approvedParties(phase, approvals);
  return GATE_PARTIES[phase].filter((party) => !done.has(party));
}

/** Every required party has signed off. Mirrors the check in `move_project`. */
export function gateSatisfied(
  phase: GatePhase,
  approvals: ProjectApproval[],
): boolean {
  return pendingParties(phase, approvals).length === 0;
}

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

/**
 * Delegation is complete when every delegated phase has both a person and a
 * duration. Derived rather than stored (`SLICE_4_SCOPE.md` decision 4) so it
 * cannot drift from the rows it describes.
 *
 * Planned hours are deliberately excluded — they are optional.
 */
export function isDelegationComplete(phases: ProjectPhase[]): boolean {
  return DELEGATED_PHASES.every((phase) => {
    const row = phases.find((p) => p.phase === phase);
    return Boolean(row?.assignee_id) && row?.duration_days != null;
  });
}

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
