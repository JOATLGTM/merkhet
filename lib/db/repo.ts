import { cache } from "react";

import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type {
  BoardColumn,
  Customer,
  DesignPhase,
  Project,
  ProjectPhase,
  ProjectWithRelations,
  ActivityLog,
  ProjectApproval,
  User,
  UserRole,
  Consultant,
} from "@/lib/types";
import {
  CHOSEN_PARTY,
  DELEGATED_PHASES,
  DESIGN_PHASES,
  GATE_PARTIES,
  boardColumnOf,
  isDesignPhase,
} from "@/lib/types";
import type { ApprovalParty, GatePhase } from "@/lib/types";
import { deriveSchedule } from "@/lib/dates";
import { resolveContactField } from "@/lib/contact";
import type { Audiences } from "@/lib/email/plan";
import type { WorkloadAssignment } from "@/lib/workload";

type Db = Awaited<ReturnType<typeof createServerSupabase>>;

async function db(): Promise<Db> {
  return createServerSupabase();
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as UserRole,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    name: String(row.name),
    address: (row.address as string | null) ?? null,
    contact_name: (row.contact_name as string | null) ?? null,
    contact_email: (row.contact_email as string | null) ?? null,
    contact_phone: (row.contact_phone as string | null) ?? null,
    spouse_name: (row.spouse_name as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    customer_id: String(row.customer_id),
    project_number: String(row.project_number),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    status: row.status as Project["status"],
    current_phase: (row.current_phase as DesignPhase | null) ?? null,
    on_hold: Boolean(row.on_hold),
    on_hold_since: (row.on_hold_since as string | null) ?? null,
    on_hold_reason: (row.on_hold_reason as string | null) ?? null,
    start_date: (row.start_date as string | null) ?? null,
    target_completion: (row.target_completion as string | null) ?? null,
    client_desired_completion:
      (row.client_desired_completion as string | null) ?? null,
    project_budget: asNumber(row.project_budget),
    design_budget: asNumber(row.design_budget),
    project_address: (row.project_address as string | null) ?? null,
    project_contact_name: (row.project_contact_name as string | null) ?? null,
    project_contact_email: (row.project_contact_email as string | null) ?? null,
    project_contact_phone: (row.project_contact_phone as string | null) ?? null,
    hours_per_week: asNumber(row.hours_per_week),
    archived_at: (row.archived_at as string | null) ?? null,
    contract_path: (row.contract_path as string | null) ?? null,
    contract_filename: (row.contract_filename as string | null) ?? null,
    contract_uploaded_at: (row.contract_uploaded_at as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapPhase(
  row: Record<string, unknown>,
  notifyIds: string[] = [],
): ProjectPhase {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    phase: row.phase as DesignPhase,
    assignee_id: (row.assignee_id as string | null) ?? null,
    status: row.status as ProjectPhase["status"],
    planned_start: (row.planned_start as string | null) ?? null,
    planned_end: (row.planned_end as string | null) ?? null,
    duration_days: asNumber(row.duration_days),
    planned_hours: asNumber(row.planned_hours),
    entered_at: (row.entered_at as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    sort_order: Number(row.sort_order),
    notify_ids: notifyIds,
  };
}

/** `project_phase_recipients` rows grouped by `${project_id}:${phase}`. */
function groupRecipients(
  rows: Record<string, unknown>[] | null,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const row of rows ?? []) {
    const key = `${String(row.project_id)}:${String(row.phase)}`;
    const list = out.get(key) ?? [];
    list.push(String(row.user_id));
    out.set(key, list);
  }
  return out;
}

function mapApproval(row: Record<string, unknown>): ProjectApproval {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    phase: row.phase as DesignPhase,
    party: row.party as ProjectApproval["party"],
    approver_user_id: (row.approver_user_id as string | null) ?? null,
    status: row.status as ProjectApproval["status"],
    approved_at: (row.approved_at as string | null) ?? null,
    recorded_by: (row.recorded_by as string | null) ?? null,
    created_at: String(row.created_at),
  };
}

function mapActivity(row: Record<string, unknown>): ActivityLog {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    actor_id: (row.actor_id as string | null) ?? null,
    event_type: String(row.event_type),
    payload: (row.payload as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
  };
}

function mapConsultant(row: Record<string, unknown>): Consultant {
  return {
    id: String(row.id),
    name: String(row.name),
    company: (row.company as string | null) ?? null,
    discipline: (row.discipline as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function throwOn(
  error: { message: string } | null | undefined,
  fallback: string,
) {
  if (error) throw new Error(error.message || fallback);
}

/**
 * The roster the firm sees. Never includes a `developer`: that account is
 * admin access without presence, so it is absent from the board, the
 * calendar, /staff and every assignee or notify list built from this. It
 * still signs in — `getUserById` is the session lookup and does not filter.
 */
export const listUsers = cache(async (activeOnly = true): Promise<User[]> => {
  const supabase = await db();
  let query = supabase
    .from("users")
    .select("*")
    .neq("role", "developer")
    .order("name");
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  throwOn(error, "Failed to list users");
  return (data ?? []).map((row) => mapUser(row));
});

export const getUserById = cache(async (id: string): Promise<User | null> => {
  const supabase = await db();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOn(error, "Failed to load user");
  return data ? mapUser(data) : null;
});

export const getUserByEmail = cache(
  async (email: string): Promise<User | null> => {
    const supabase = await db();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .ilike("email", email)
      .maybeSingle();
    throwOn(error, "Failed to load user");
    return data ? mapUser(data) : null;
  },
);

export const listCustomers = cache(
  async (): Promise<
    (Customer & { total_projects: number; active_projects: number })[]
  > => {
    const supabase = await db();
    const [{ data: customers, error: cErr }, { data: projects, error: pErr }] =
      await Promise.all([
        supabase.from("customers").select("*").order("name"),
        supabase.from("projects").select("customer_id, status"),
      ]);
    throwOn(cErr, "Failed to list customers");
    throwOn(pErr, "Failed to list projects");

    return (customers ?? []).map((row) => {
      const related = (projects ?? []).filter((p) => p.customer_id === row.id);
      return {
        ...mapCustomer(row),
        total_projects: related.length,
        active_projects: related.filter((p) => p.status === "active").length,
      };
    });
  },
);

export const getCustomer = cache(
  async (id: string): Promise<Customer | null> => {
    const supabase = await db();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwOn(error, "Failed to load customer");
    return data ? mapCustomer(data) : null;
  },
);

export async function createCustomer(
  input: Pick<
    Customer,
    | "name"
    | "address"
    | "contact_name"
    | "contact_email"
    | "contact_phone"
    | "spouse_name"
    | "notes"
  >,
): Promise<Customer> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: input.name,
      address: input.address ?? null,
      contact_name: input.contact_name,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone,
      spouse_name: input.spouse_name ?? null,
      notes: input.notes,
    })
    .select("*")
    .single();
  throwOn(error, "Failed to create customer");
  return mapCustomer(data);
}

export async function updateCustomer(
  id: string,
  patch: Partial<
    Pick<
      Customer,
      | "name"
      | "address"
      | "contact_name"
      | "contact_email"
      | "contact_phone"
      | "spouse_name"
      | "notes"
    >
  >,
): Promise<Customer> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  throwOn(error, "Failed to update customer");
  return mapCustomer(data);
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = await db();
  const { count, error: countError } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", id);
  throwOn(countError, "Failed to check customer projects");
  if ((count ?? 0) > 0) {
    throw new Error("Cannot delete a customer that has projects.");
  }
  const { error } = await supabase.from("customers").delete().eq("id", id);
  throwOn(error, "Failed to delete customer");
}

async function hydrateProject(
  supabase: Db,
  project: Project,
): Promise<ProjectWithRelations> {
  const [
    { data: customer, error: cErr },
    { data: phases, error: pErr },
    { data: activity, error: aErr },
    { data: joins, error: jErr },
    { data: approvals, error: apErr },
    { data: recipients, error: rErr },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("id", project.customer_id)
      .single(),
    supabase
      .from("project_phases")
      .select("*")
      .eq("project_id", project.id)
      .order("sort_order"),
    supabase
      .from("activity_log")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_consultants")
      .select("consultant_id")
      .eq("project_id", project.id),
    supabase.from("project_approvals").select("*").eq("project_id", project.id),
    supabase
      .from("project_phase_recipients")
      .select("project_id, phase, user_id")
      .eq("project_id", project.id),
  ]);
  throwOn(cErr, "Missing customer");
  throwOn(pErr, "Failed to load phases");
  throwOn(aErr, "Failed to load activity");
  throwOn(jErr, "Failed to load project consultants");
  throwOn(apErr, "Failed to load approvals");
  throwOn(rErr, "Failed to load phase recipients");
  const recipientsByPhase = groupRecipients(recipients);

  const consultantIds = (joins ?? []).map((j) => String(j.consultant_id));
  let consultants: Consultant[] = [];
  if (consultantIds.length) {
    const { data: consultantRows, error: consErr } = await supabase
      .from("consultants")
      .select("*")
      .in("id", consultantIds)
      .order("name");
    throwOn(consErr, "Failed to load consultants");
    consultants = (consultantRows ?? []).map((row) => mapConsultant(row));
  }

  return {
    ...project,
    customer: mapCustomer(customer),
    phases: (phases ?? []).map((row) =>
      mapPhase(
        row,
        recipientsByPhase.get(`${String(row.project_id)}:${String(row.phase)}`),
      ),
    ),
    activity: (activity ?? []).map((row) => mapActivity(row)),
    consultants,
    approvals: (approvals ?? []).map((row) => mapApproval(row)),
  };
}

export const listProjects = cache(async (): Promise<ProjectWithRelations[]> => {
  const supabase = await db();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  throwOn(error, "Failed to list projects");
  if (!projects?.length) return [];

  return hydrateProjectList(supabase, projects);
});

export const listCompletedProjects = cache(
  async (): Promise<ProjectWithRelations[]> => {
    const supabase = await db();
    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .or("status.eq.completed,archived_at.not.is.null")
      .order("archived_at", { ascending: false, nullsFirst: false });
    throwOn(error, "Failed to list completed projects");
    if (!projects?.length) return [];

    return hydrateProjectList(supabase, projects);
  },
);

async function hydrateProjectList(
  supabase: Db,
  projects: Record<string, unknown>[],
): Promise<ProjectWithRelations[]> {
  const ids = projects.map((p) => String(p.id));
  const customerIds = [...new Set(projects.map((p) => String(p.customer_id)))];

  const [
    { data: customers, error: cErr },
    { data: phases, error: pErr },
    { data: activity, error: aErr },
    { data: joins, error: jErr },
    { data: approvals, error: apErr },
    { data: recipients, error: rErr },
  ] = await Promise.all([
    supabase.from("customers").select("*").in("id", customerIds),
    supabase
      .from("project_phases")
      .select("*")
      .in("project_id", ids)
      .order("sort_order"),
    supabase
      .from("activity_log")
      .select("*")
      .in("project_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_consultants")
      .select("project_id, consultant_id")
      .in("project_id", ids),
    supabase.from("project_approvals").select("*").in("project_id", ids),
    supabase
      .from("project_phase_recipients")
      .select("project_id, phase, user_id")
      .in("project_id", ids),
  ]);
  throwOn(cErr, "Failed to load customers");
  throwOn(pErr, "Failed to load phases");
  throwOn(aErr, "Failed to load activity");
  throwOn(jErr, "Failed to load project consultants");
  throwOn(apErr, "Failed to load approvals");
  throwOn(rErr, "Failed to load phase recipients");
  const recipientsByPhase = groupRecipients(recipients);

  const consultantIds = [
    ...new Set((joins ?? []).map((j) => String(j.consultant_id))),
  ];
  const consultantsById = new Map<string, Consultant>();
  if (consultantIds.length) {
    const { data: consultantRows, error: consErr } = await supabase
      .from("consultants")
      .select("*")
      .in("id", consultantIds);
    throwOn(consErr, "Failed to load consultants");
    for (const row of consultantRows ?? []) {
      consultantsById.set(String(row.id), mapConsultant(row));
    }
  }

  const customersById = new Map(
    (customers ?? []).map((c) => [c.id, mapCustomer(c)]),
  );
  const phasesByProject = new Map<string, ProjectPhase[]>();
  for (const row of phases ?? []) {
    const list = phasesByProject.get(row.project_id) ?? [];
    list.push(
      mapPhase(
        row,
        recipientsByPhase.get(`${String(row.project_id)}:${String(row.phase)}`),
      ),
    );
    phasesByProject.set(row.project_id, list);
  }
  const activityByProject = new Map<string, ActivityLog[]>();
  for (const row of activity ?? []) {
    const list = activityByProject.get(row.project_id) ?? [];
    list.push(mapActivity(row));
    activityByProject.set(row.project_id, list);
  }
  const approvalsByProject = new Map<string, ProjectApproval[]>();
  for (const row of approvals ?? []) {
    const list = approvalsByProject.get(String(row.project_id)) ?? [];
    list.push(mapApproval(row));
    approvalsByProject.set(String(row.project_id), list);
  }
  const consultantsByProject = new Map<string, Consultant[]>();
  for (const row of joins ?? []) {
    const projectId = String(row.project_id);
    const consultant = consultantsById.get(String(row.consultant_id));
    if (!consultant) continue;
    const list = consultantsByProject.get(projectId) ?? [];
    list.push(consultant);
    consultantsByProject.set(projectId, list);
  }
  for (const list of consultantsByProject.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return projects.map((row) => {
    const project = mapProject(row);
    const customer = customersById.get(project.customer_id);
    if (!customer) throw new Error("Missing customer");
    return {
      ...project,
      customer,
      phases: phasesByProject.get(project.id) ?? [],
      activity: activityByProject.get(project.id) ?? [],
      consultants: consultantsByProject.get(project.id) ?? [],
      approvals: approvalsByProject.get(project.id) ?? [],
    };
  });
}

/**
 * Deliberately NOT wrapped in `cache()`, unlike the other readers here.
 * Every mutation below re-reads through `getProject` to return the updated
 * row (and several read a `before` snapshot first). Request-scoped memoization
 * would hand those callers the pre-mutation value, so each write would return
 * stale data to the client.
 */
export async function getProject(
  id: string,
): Promise<ProjectWithRelations | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOn(error, "Failed to load project");
  if (!data) return null;
  return hydrateProject(supabase, mapProject(data));
}

export async function createProject(input: {
  customer_id: string;
  name: string;
  description?: string | null;
  status?: Project["status"];
  current_phase?: DesignPhase | null;
  start_date?: string | null;
  target_completion?: string | null;
  hours_per_week?: number | null;
  /** Null on any of these inherits the customer's — see `lib/contact.ts`. */
  project_address?: string | null;
  project_contact_name?: string | null;
  project_contact_email?: string | null;
  project_contact_phone?: string | null;
  actor_id: string;
}): Promise<ProjectWithRelations> {
  const supabase = await db();
  const status = input.status ?? "pending";
  const current_phase =
    status === "active" ? (input.current_phase ?? null) : null;

  const { data: projectRow, error } = await supabase
    .from("projects")
    .insert({
      customer_id: input.customer_id,
      name: input.name,
      description: input.description ?? null,
      status,
      current_phase,
      start_date: input.start_date ?? null,
      target_completion: input.target_completion ?? null,
      hours_per_week: input.hours_per_week ?? null,
      project_address: input.project_address ?? null,
      project_contact_name: input.project_contact_name ?? null,
      project_contact_email: input.project_contact_email ?? null,
      project_contact_phone: input.project_contact_phone ?? null,
      created_by: input.actor_id,
    })
    .select("*")
    .single();
  throwOn(error, "Failed to create project");

  if (current_phase) {
    const { error: phaseError } = await supabase
      .from("project_phases")
      .update({
        status: "in_progress",
        entered_at: new Date().toISOString(),
      })
      .eq("project_id", projectRow.id)
      .eq("phase", current_phase);
    throwOn(phaseError, "Failed to start phase");
  }

  const { error: activityError } = await supabase.from("activity_log").insert({
    project_id: projectRow.id,
    actor_id: input.actor_id,
    event_type: "project.created",
    payload: {},
  });
  throwOn(activityError, "Failed to log project create");

  return (await getProject(projectRow.id))!;
}

export async function updateProject(
  id: string,
  patch: Partial<
    Pick<
      Project,
      | "name"
      | "description"
      | "start_date"
      | "target_completion"
      | "hours_per_week"
      | "customer_id"
      | "project_address"
      | "project_contact_name"
      | "project_contact_email"
      | "project_contact_phone"
    >
  >,
  actorId: string,
): Promise<ProjectWithRelations> {
  const supabase = await db();
  const before = await getProject(id);
  if (!before) throw new Error("Project not found");

  const changed: Record<string, [unknown, unknown]> = {};
  for (const [key, value] of Object.entries(patch)) {
    const prev = before[key as keyof Project];
    if (prev !== value) changed[key] = [prev, value];
  }

  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  throwOn(error, "Failed to update project");

  if (Object.keys(changed).length) {
    const { error: activityError } = await supabase
      .from("activity_log")
      .insert({
        project_id: id,
        actor_id: actorId,
        event_type: "project.updated",
        payload: { changed },
      });
    throwOn(activityError, "Failed to log project update");
  }

  return (await getProject(id))!;
}

export async function toggleHold(
  id: string,
  onHold: boolean,
  reason: string | null,
  actorId: string,
): Promise<ProjectWithRelations> {
  const supabase = await db();
  const { error } = await supabase
    .from("projects")
    .update({
      on_hold: onHold,
      on_hold_since: onHold ? new Date().toISOString() : null,
      on_hold_reason: onHold ? reason : null,
    })
    .eq("id", id);
  throwOn(error, "Failed to toggle hold");

  const { error: activityError } = await supabase.from("activity_log").insert({
    project_id: id,
    actor_id: actorId,
    event_type: "project.hold_toggled",
    payload: { on_hold: onHold, reason },
  });
  throwOn(activityError, "Failed to log hold toggle");

  return (await getProject(id))!;
}

/** Display name for whoever triggered a notification. */
async function actorDisplayName(actorId: string): Promise<string> {
  const actor = await getUserById(actorId);
  return actor?.name ?? "A team member";
}

export async function moveProject(
  id: string,
  toColumn: BoardColumn,
  actorId: string,
): Promise<ProjectWithRelations> {
  const current = await getProject(id);
  if (!current) throw new Error("Project not found");

  const from = boardColumnOf(current);
  // Pending exits only via contract upload (uploadContractAndActivate), not drag/⌘K.
  if (
    (from === "pending" || current.status === "backlog") &&
    toColumn !== "pending"
  ) {
    throw new Error(
      "Upload an LOI or contract to move this project out of Pending.",
    );
  }

  const supabase = await db();
  const { error } = await supabase.rpc("move_project", {
    p_project_id: id,
    p_to_column: toColumn,
    p_actor_id: actorId,
  });
  throwOn(error, "Failed to move project");

  const { notifyPhaseEntry } = await import("@/lib/notifications");
  await notifyPhaseEntry({
    projectId: id,
    column: toColumn,
    previousColumn: from,
    actorName: await actorDisplayName(actorId),
  });

  return (await getProject(id))!;
}

/**
 * Permitting → Complete (archived). Only valid from the Permitting column.
 */
export async function markProjectComplete(
  id: string,
  actorId: string,
): Promise<ProjectWithRelations> {
  const current = await getProject(id);
  if (!current) throw new Error("Project not found");
  if (boardColumnOf(current) !== "permitting") {
    throw new Error("Only projects in Permitting can be marked complete.");
  }

  const supabase = await db();
  const { error } = await supabase.rpc("move_project", {
    p_project_id: id,
    p_to_column: "completed",
    p_actor_id: actorId,
  });
  throwOn(error, "Failed to mark project complete");

  const { notifyProjectComplete } = await import("@/lib/notifications");
  await notifyProjectComplete({
    projectId: id,
    completedBy: await actorDisplayName(actorId),
    completedOn: new Date().toISOString(),
  });

  return (await getProject(id))!;
}

/**
 * Hard delete — there is no undo, and no soft-delete column to fall back on.
 * Every child row (`project_phases`, `activity_log`, `project_approvals`,
 * `phase_transitions`, `project_consultants`) is `on delete cascade`, so the
 * single row delete takes the whole tree.
 *
 * Storage is not covered by the cascade, so the contract PDF is removed first.
 * A failure there is logged rather than thrown: an orphaned object in a
 * private bucket is a smaller problem than a project that cannot be deleted.
 */
export async function deleteProject(id: string): Promise<void> {
  const supabase = await db();
  const { data: row, error: readError } = await supabase
    .from("projects")
    .select("id, contract_path")
    .eq("id", id)
    .maybeSingle();
  throwOn(readError, "Failed to load project");
  if (!row) throw new Error("Project not found");

  const contractPath = (row.contract_path as string | null) ?? null;
  if (contractPath) {
    const { error: storageError } = await supabase.storage
      .from("contracts")
      .remove([contractPath]);
    if (storageError) {
      console.error(
        `Deleted project ${id} but could not remove ${contractPath}: ${storageError.message}`,
      );
    }
  }

  const { error } = await supabase.from("projects").delete().eq("id", id);
  throwOn(error, "Failed to delete project");
}

/**
 * Stores the LOI/contract and advances Pending → Active.
 * This is the only supported path out of Pending.
 */
export async function uploadContractAndActivate(
  projectId: string,
  file: File,
  actorId: string,
): Promise<ProjectWithRelations> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found");
  if (project.status !== "pending" && project.status !== "backlog") {
    throw new Error("Only Pending projects accept a contract upload.");
  }
  if (file.type !== "application/pdf") {
    throw new Error("Contract must be a PDF.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("PDF must be 20 MB or smaller.");
  }

  const safeName = file.name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 180);
  const path = `${projectId}/${Date.now()}-${safeName}`;

  const supabase = await db();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("contracts")
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  throwOn(uploadError, "Failed to upload contract");

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      contract_path: path,
      contract_filename: file.name,
      contract_uploaded_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  throwOn(updateError, "Failed to save contract metadata");

  const { error: moveError } = await supabase.rpc("move_project", {
    p_project_id: projectId,
    p_to_column: "active",
    p_actor_id: actorId,
  });
  throwOn(moveError, "Failed to activate project");

  const { notifyProjectEnteredActive } = await import("@/lib/notifications");
  await notifyProjectEnteredActive({
    projectId,
    projectName: project.name,
    projectNumber: project.project_number,
    actorId,
    actorName: await actorDisplayName(actorId),
  });

  return (await getProject(projectId))!;
}

/** Short-lived signed URL for the private contracts bucket (view/download). */
export async function getContractViewUrl(
  projectId: string,
): Promise<{ url: string; filename: string }> {
  const project = await getProject(projectId);
  if (!project?.contract_path) {
    throw new Error("No contract on file for this project.");
  }

  const supabase = await db();
  const { data, error } = await supabase.storage
    .from("contracts")
    .createSignedUrl(project.contract_path, 60 * 15); // 15 minutes
  throwOn(error, "Failed to open contract");
  if (!data?.signedUrl) throw new Error("Failed to open contract");

  return {
    url: data.signedUrl,
    filename: project.contract_filename ?? "contract.pdf",
  };
}

export async function updatePhaseAssignee(
  projectId: string,
  phase: DesignPhase,
  assigneeId: string | null,
  actorId: string,
): Promise<ProjectWithRelations> {
  const supabase = await db();
  const { data: before, error: beforeError } = await supabase
    .from("project_phases")
    .select("assignee_id")
    .eq("project_id", projectId)
    .eq("phase", phase)
    .single();
  throwOn(beforeError, "Phase not found");
  if (!before) throw new Error("Phase not found");

  const { error } = await supabase
    .from("project_phases")
    .update({ assignee_id: assigneeId })
    .eq("project_id", projectId)
    .eq("phase", phase);
  throwOn(error, "Failed to update assignee");

  const { error: activityError } = await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: actorId,
    event_type: "phase.assignee_changed",
    payload: {
      phase,
      from_user_id: before.assignee_id,
      to_user_id: assigneeId,
    },
  });
  throwOn(activityError, "Failed to log assignee change");

  return (await getProject(projectId))!;
}

export async function updatePhaseDates(
  projectId: string,
  phase: DesignPhase,
  planned_start: string | null,
  planned_end: string | null,
): Promise<ProjectWithRelations> {
  const supabase = await db();
  const { error } = await supabase
    .from("project_phases")
    .update({ planned_start, planned_end })
    .eq("project_id", projectId)
    .eq("phase", phase);
  throwOn(error, "Failed to update phase dates");
  return (await getProject(projectId))!;
}

/**
 * Planned (budgeted) hours for a phase. Logged unlike `updatePhaseDates` —
 * this is a budget commitment, and "who changed it from 40 to 80" is the
 * question the activity feed has to answer.
 */
export async function updatePhaseHours(
  projectId: string,
  phase: DesignPhase,
  plannedHours: number | null,
  actorId: string,
): Promise<ProjectWithRelations> {
  if (
    plannedHours != null &&
    (!Number.isFinite(plannedHours) || plannedHours < 0)
  ) {
    throw new Error("Planned hours must be zero or more.");
  }

  const supabase = await db();
  const { data: before, error: beforeError } = await supabase
    .from("project_phases")
    .select("planned_hours")
    .eq("project_id", projectId)
    .eq("phase", phase)
    .single();
  throwOn(beforeError, "Phase not found");
  if (!before) throw new Error("Phase not found");

  const { error } = await supabase
    .from("project_phases")
    .update({ planned_hours: plannedHours })
    .eq("project_id", projectId)
    .eq("phase", phase);
  throwOn(error, "Failed to update planned hours");

  const { error: activityError } = await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: actorId,
    event_type: "phase.hours_changed",
    payload: {
      phase,
      from_hours: asNumber(before.planned_hours),
      to_hours: plannedHours,
    },
  });
  throwOn(activityError, "Failed to log planned hours change");

  return (await getProject(projectId))!;
}

export type DelegationEntry = {
  phase: DesignPhase;
  assignee_id: string;
  duration_days: number;
  /** Optional by design — see `SLICE_4_SCOPE.md` "Optionality". */
  planned_hours: number | null;
  /**
   * Staff copied on this project's internal mail for the phase, on top of the
   * assignee. Optional; empty means the assignee (and leadership, where the
   * routing table copies them) hear about it and nobody else.
   */
  notify_ids: string[];
};

/** Distinct, non-empty ids in first-seen order. */
function uniqueIds(ids: string[] | null | undefined): string[] {
  return [...new Set((ids ?? []).filter((id) => Boolean(id)))];
}

/**
 * Replaces the recipient list for one phase of one project. Delete-then-insert
 * rather than a diff — the list is short and the primary key makes a
 * duplicate insert an error rather than a silent no-op.
 */
async function writePhaseRecipients(
  supabase: Db,
  projectId: string,
  phase: DesignPhase,
  userIds: string[],
) {
  const { error: delError } = await supabase
    .from("project_phase_recipients")
    .delete()
    .eq("project_id", projectId)
    .eq("phase", phase);
  throwOn(delError, `Failed to clear recipients for ${phase}`);

  if (userIds.length) {
    const { error } = await supabase
      .from("project_phase_recipients")
      .insert(userIds.map((user_id) => ({ project_id: projectId, phase, user_id })));
    throwOn(error, `Failed to save recipients for ${phase}`);
  }
}

/**
 * Sets who is copied when this project enters `phase`, independently of the
 * schedule — the sheet edits it in place, the same way it edits the assignee.
 */
export async function setPhaseRecipients(
  projectId: string,
  phase: DesignPhase,
  userIds: string[],
  actorId: string,
): Promise<ProjectWithRelations> {
  if (!DELEGATED_PHASES.includes(phase)) {
    throw new Error(`${phase} has no recipients — it is a gate, not work.`);
  }
  const ids = uniqueIds(userIds);
  const supabase = await db();
  await writePhaseRecipients(supabase, projectId, phase, ids);

  const { error: activityError } = await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: actorId,
    event_type: "phase.recipients_changed",
    payload: { phase, user_ids: ids },
  });
  throwOn(activityError, "Failed to log recipient change");

  return (await getProject(projectId))!;
}

/**
 * Slice 4 — assigns person + duration to all five delegated phases at once and
 * derives the schedule from the durations.
 *
 * Phases that have already been worked (anything not `not_started`) keep their
 * dates; only the remainder is re-dated. That makes this safe to re-run as a
 * re-plan, which is what Slice 5's rejection loops will need.
 *
 * Writes are sequential — supabase-js has no client-side transaction. A
 * partial write leaves the project *incompletely* delegated, which the
 * Active → SD gate reads as "not delegated" and blocks. It fails closed.
 */
export async function saveDelegation(
  projectId: string,
  entries: DelegationEntry[],
  anchorDate: string,
  actorId: string,
): Promise<ProjectWithRelations> {
  const byPhase = new Map(entries.map((e) => [e.phase, e]));

  for (const phase of DELEGATED_PHASES) {
    const entry = byPhase.get(phase);
    if (!entry) throw new Error(`Missing delegation for ${phase}`);
    if (!entry.assignee_id) throw new Error(`Assign someone to ${phase}`);
    if (!Number.isFinite(entry.duration_days) || entry.duration_days < 1) {
      throw new Error(`Set a duration of at least one day for ${phase}`);
    }
    if (
      entry.planned_hours != null &&
      (!Number.isFinite(entry.planned_hours) || entry.planned_hours < 0)
    ) {
      throw new Error(`Planned hours must be zero or more for ${phase}`);
    }
  }
  if (!anchorDate) throw new Error("Pick a start date for the schedule.");

  const supabase = await db();
  const { data: existing, error: existingError } = await supabase
    .from("project_phases")
    .select("phase, status, planned_end")
    .eq("project_id", projectId);
  throwOn(existingError, "Failed to read phases");

  // Anything already worked is locked: keep its dates, resume the chain after.
  const locked: Partial<Record<DesignPhase, string | null>> = {};
  for (const row of existing ?? []) {
    if (row.status !== "not_started") {
      locked[row.phase as DesignPhase] =
        (row.planned_end as string | null) ?? null;
    }
  }

  const schedule = deriveSchedule({
    anchor: anchorDate,
    durations: Object.fromEntries(
      entries.map((e) => [e.phase, e.duration_days]),
    ),
    locked,
  });

  for (const phase of DESIGN_PHASES) {
    const entry = byPhase.get(phase);
    const dates = schedule[phase];
    if (!entry && !dates) continue;

    // Delegation assigns every phase, including locked ones — it records who
    // owns the work. Only the dates are withheld from locked phases.
    const patch: Record<string, unknown> = {};
    if (entry) {
      patch.assignee_id = entry.assignee_id;
      patch.duration_days = entry.duration_days;
      patch.planned_hours = entry.planned_hours;
    }
    if (dates) {
      patch.planned_start = dates.planned_start;
      patch.planned_end = dates.planned_end;
    }

    const { error } = await supabase
      .from("project_phases")
      .update(patch)
      .eq("project_id", projectId)
      .eq("phase", phase);
    throwOn(error, `Failed to save delegation for ${phase}`);

    if (entry) {
      await writePhaseRecipients(
        supabase,
        projectId,
        phase,
        uniqueIds(entry.notify_ids),
      );
    }
  }

  const { error: projectError } = await supabase
    .from("projects")
    .update({ start_date: anchorDate })
    .eq("id", projectId);
  throwOn(projectError, "Failed to set the schedule start date");

  const { error: activityError } = await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: actorId,
    event_type: "project.delegated",
    payload: {
      anchor: anchorDate,
      phases: entries.map((e) => ({
        phase: e.phase,
        assignee_id: e.assignee_id,
        duration_days: e.duration_days,
        planned_hours: e.planned_hours,
        notify_ids: uniqueIds(e.notify_ids),
      })),
    },
  });
  throwOn(activityError, "Failed to log delegation");

  return (await getProject(projectId))!;
}

/**
 * Slice 5 — record one party's sign-off at a gate.
 *
 * Rows exist only when approved, so this is an upsert on
 * `(project_id, phase, party)` and re-recording the same party is a no-op
 * beyond refreshing who recorded it and when.
 */
export async function recordApproval(
  projectId: string,
  phase: GatePhase,
  party: ApprovalParty,
  actorId: string,
  /**
   * Only meaningful on the `chosen` slot: the staff member who signed off, or
   * null for the client. Ignored on the fixed parties, whose identity *is* the
   * party.
   */
  approverUserId: string | null = null,
): Promise<ProjectWithRelations> {
  if (!GATE_PARTIES[phase]?.includes(party)) {
    throw new Error(`${party} does not sign off at ${phase}`);
  }

  const approver = party === CHOSEN_PARTY ? approverUserId : null;

  const supabase = await db();
  const { error } = await supabase.from("project_approvals").upsert(
    {
      project_id: projectId,
      phase,
      party,
      approver_user_id: approver,
      status: "approved",
      approved_at: new Date().toISOString(),
      recorded_by: actorId,
    },
    { onConflict: "project_id,phase,party" },
  );
  throwOn(error, "Failed to record the approval");

  const { error: activityError } = await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: actorId,
    event_type: "approval.recorded",
    // The chosen slot means nothing in the log without the person in it.
    payload: { phase, party, approver_user_id: approver },
  });
  throwOn(activityError, "Failed to log the approval");

  return (await getProject(projectId))!;
}

/** Undo a sign-off recorded in error. Deleting is what "pending" means here. */
export async function clearApproval(
  projectId: string,
  phase: GatePhase,
  party: ApprovalParty,
  actorId: string,
): Promise<ProjectWithRelations> {
  const supabase = await db();
  const { error } = await supabase
    .from("project_approvals")
    .delete()
    .eq("project_id", projectId)
    .eq("phase", phase)
    .eq("party", party);
  throwOn(error, "Failed to clear the approval");

  const { error: activityError } = await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: actorId,
    event_type: "approval.cleared",
    payload: { phase, party },
  });
  throwOn(activityError, "Failed to log the change");

  return (await getProject(projectId))!;
}

/**
 * Reject a gate: back to the prior phase, sign-offs cleared, dates reshuffled.
 *
 * The state transition is atomic in `reject_gate`. Date recalculation happens
 * here afterwards because the derivation lives in TypeScript — if it fails the
 * project is still correctly rejected, just with stale dates, which Re-plan
 * schedule fixes.
 *
 * In-progress phases are deliberately NOT locked: the phase being returned to
 * is in progress precisely because it is being reworked, so it has to be
 * re-dated from today rather than keeping its original window. Completed and
 * skipped phases are locked — a skipped phase will never be worked, so letting
 * it re-date would hand it a fresh future window *and* push the rework out
 * behind it.
 */
export async function rejectGate(
  projectId: string,
  phase: GatePhase,
  actorId: string,
): Promise<ProjectWithRelations> {
  const supabase = await db();
  const { error } = await supabase.rpc("reject_gate", {
    p_project_id: projectId,
    p_phase: phase,
    p_actor_id: actorId,
  });
  throwOn(error, "Failed to reject");

  const project = (await getProject(projectId))!;

  const locked: Partial<Record<DesignPhase, string | null>> = {};
  const durations: Partial<Record<DesignPhase, number | null>> = {};
  for (const row of project.phases) {
    durations[row.phase] = row.duration_days;
    if (row.status === "completed" || row.status === "skipped") {
      locked[row.phase] = row.planned_end;
    }
  }

  const schedule = deriveSchedule({
    anchor: new Date().toISOString().slice(0, 10),
    durations,
    locked,
  });

  for (const [phaseKey, dates] of Object.entries(schedule)) {
    const { error: dateError } = await supabase
      .from("project_phases")
      .update({
        planned_start: dates.planned_start,
        planned_end: dates.planned_end,
      })
      .eq("project_id", projectId)
      .eq("phase", phaseKey);
    throwOn(dateError, "Rejected, but the dates could not be shifted");
  }

  return (await getProject(projectId))!;
}

/**
 * In-progress, assigned phases across every live project — the input to the
 * Staff page's Workload section (Slice 9).
 *
 * Deliberately narrow rather than `listProjects()`: the view needs six columns
 * off `project_phases` and a project number, not activity, approvals and
 * consultants for twenty projects. Derived entirely from delegation, so there
 * is no schema behind it.
 */
export const listInProgressAssignments = cache(
  async (): Promise<WorkloadAssignment[]> => {
    const supabase = await db();
    const { data: phases, error } = await supabase
      .from("project_phases")
      .select(
        "project_id, phase, assignee_id, planned_start, planned_end, duration_days, planned_hours",
      )
      .eq("status", "in_progress")
      .not("assignee_id", "is", null);
    throwOn(error, "Failed to load in-progress phases");
    if (!phases?.length) return [];

    const ids = [...new Set(phases.map((row) => String(row.project_id)))];
    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select("id, project_number, name, status, on_hold, archived_at")
      .in("id", ids);
    throwOn(projectError, "Failed to load projects for workload");

    const byId = new Map(
      (projects ?? []).map((row) => [String(row.id), row] as const),
    );

    return phases.flatMap((row) => {
      const project = byId.get(String(row.project_id));
      // Archived work is not current work, whatever the phase row still says.
      if (!project || project.archived_at || project.status === "completed") {
        return [];
      }
      return [
        {
          projectId: String(row.project_id),
          projectNumber: String(project.project_number),
          projectName: String(project.name),
          onHold: Boolean(project.on_hold),
          phase: row.phase as DesignPhase,
          assigneeId: String(row.assignee_id),
          plannedStart: (row.planned_start as string | null) ?? null,
          plannedEnd: (row.planned_end as string | null) ?? null,
          plannedHours: asNumber(row.planned_hours),
          durationDays: asNumber(row.duration_days),
        },
      ];
    });
  },
);

export const listConsultants = cache(async (): Promise<Consultant[]> => {
  const supabase = await db();
  const { data, error } = await supabase
    .from("consultants")
    .select("*")
    .order("name");
  throwOn(error, "Failed to list consultants");
  return (data ?? []).map((row) => mapConsultant(row));
});

export const getConsultant = cache(
  async (id: string): Promise<Consultant | null> => {
    const supabase = await db();
    const { data, error } = await supabase
      .from("consultants")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwOn(error, "Failed to load consultant");
    return data ? mapConsultant(data) : null;
  },
);

export async function createConsultant(
  input: Pick<
    Consultant,
    "name" | "company" | "discipline" | "email" | "phone" | "notes"
  >,
): Promise<Consultant> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("consultants")
    .insert({
      name: input.name,
      company: input.company,
      discipline: input.discipline,
      email: input.email,
      phone: input.phone,
      notes: input.notes,
    })
    .select("*")
    .single();
  throwOn(error, "Failed to create consultant");
  return mapConsultant(data);
}

export async function updateConsultant(
  id: string,
  patch: Partial<
    Pick<
      Consultant,
      "name" | "company" | "discipline" | "email" | "phone" | "notes"
    >
  >,
): Promise<Consultant> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("consultants")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  throwOn(error, "Failed to update consultant");
  return mapConsultant(data);
}

export async function deleteConsultant(id: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("consultants").delete().eq("id", id);
  throwOn(error, "Failed to delete consultant");
}

export async function attachConsultantToProject(
  projectId: string,
  consultantId: string,
  actorId: string,
): Promise<ProjectWithRelations> {
  const supabase = await db();
  const { error } = await supabase.from("project_consultants").insert({
    project_id: projectId,
    consultant_id: consultantId,
  });
  throwOn(error, "Failed to attach consultant");

  const { error: activityError } = await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: actorId,
    event_type: "project.consultant_attached",
    payload: { consultant_id: consultantId },
  });
  throwOn(activityError, "Failed to log consultant attach");

  return (await getProject(projectId))!;
}

export async function detachConsultantFromProject(
  projectId: string,
  consultantId: string,
  actorId: string,
): Promise<ProjectWithRelations> {
  const supabase = await db();
  const { error } = await supabase
    .from("project_consultants")
    .delete()
    .eq("project_id", projectId)
    .eq("consultant_id", consultantId);
  throwOn(error, "Failed to remove consultant");

  const { error: activityError } = await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: actorId,
    event_type: "project.consultant_detached",
    payload: { consultant_id: consultantId },
  });
  throwOn(activityError, "Failed to log consultant detach");

  return (await getProject(projectId))!;
}

export async function updateUserRole(id: string, role: UserRole) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", id)
    .select("*")
    .single();
  throwOn(error, "Failed to update role");
  return mapUser(data);
}

export async function setUserActive(id: string, isActive: boolean) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("users")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("*")
    .single();
  throwOn(error, "Failed to update user active flag");

  // `project_phase_recipients` rows are kept: deactivation is reversible, and
  // `resolveAudiences` drops inactive people at send time anyway.
  return mapUser(data);
}

/**
 * Removes an account for good — the `auth.users` row, which is the one that
 * matters. `public.users.id` is `references auth.users(id) on delete cascade`,
 * so the profile follows; going the other way leaves a login with no profile
 * that nothing in the UI can see and no invite can replace.
 *
 * Needs the service role — deleting an auth user is an admin API call, not a
 * table write. Callers must gate on admin themselves; this does not.
 *
 * What survives: `project_phases.assignee_id` and `activity_log.actor_id` are
 * `on delete set null`, so the work and the history stay and lose their name.
 * `project_phase_recipients` rows cascade away.
 */
export async function deleteUser(id: string) {
  const { createServiceClient } = await import("@/lib/supabase/admin");
  let admin;
  try {
    admin = createServiceClient();
  } catch {
    throw new Error(
      "Deleting users requires SUPABASE_SERVICE_MERKET_ROLE_KEY on the server.",
    );
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    // The reverse orphan: a profile row whose login is already gone. Only a
    // hand-edit in the table editor produces one, but it would otherwise be
    // undeletable from here — the admin API has nothing to delete, and the
    // profile stays on the roster forever.
    if (error.status === 404 || /not found/i.test(error.message)) {
      const supabase = await db();
      const { error: profileError } = await supabase
        .from("users")
        .delete()
        .eq("id", id);
      throwOn(profileError, "Failed to delete user");
      return;
    }
    throw new Error(error.message || "Failed to delete user");
  }
}

export async function inviteUser(input: {
  name: string;
  email: string;
  role: UserRole;
}) {
  // Needs the service role: only it can mint the auth.users row, and
  // public.users.id is FK'd to it — a bare insert would fail.
  const { createServiceClient } = await import("@/lib/supabase/admin");
  let admin;
  try {
    admin = createServiceClient();
  } catch {
    throw new Error(
      "Inviting users requires SUPABASE_SERVICE_MERKET_ROLE_KEY on the server.",
    );
  }

  const { env } = await import("@/lib/env");

  // A deployed build that resolves to localhost would mail a link only the
  // developer's machine can open — and the invite is single-use, so the
  // recipient cannot be rescued by re-sending until the config is fixed.
  // Fail before Supabase burns the token rather than after.
  if (env.siteUrlIsLocal && process.env.NODE_ENV === "production") {
    throw new Error(
      "Invite links would point at localhost. Set NEXT_PUBLIC_SITE_URL to " +
        "the deployed origin (and match it in Supabase → Auth → URL " +
        "Configuration) before inviting anyone.",
    );
  }

  // `inviteUserByEmail` — not `createUser` — because the invitee has to be able
  // to sign in. createUser would need a password only the server knows, leaving
  // the account unreachable. The invite mails a one-time link instead; the
  // recipient sets their own password at /accept-invite.
  //
  // Point straight at /accept-invite rather than /auth/confirm. Supabase only
  // lets you customise the email template once the project has custom SMTP, so
  // the stock `{{ .ConfirmationURL }}` has to work as-is — and that one hands
  // the session back in a URL fragment, which a server route cannot read. The
  // client page can. Editing the template later to target /auth/confirm still
  // works; this just removes it from the critical path.
  const { data: invited, error: authError } =
    await admin.auth.admin.inviteUserByEmail(input.email, {
      data: { name: input.name, role: input.role },
      redirectTo: `${env.siteUrl}/accept-invite`,
    });
  if (authError) {
    // Supabase's own wording for these is too terse to act on, and the fix
    // differs sharply between them.
    if (/already been registered|already exists/i.test(authError.message)) {
      // Deleting the row from the `users` table does not delete the account:
      // `public.users.id references auth.users(id) on delete cascade` cascades
      // downwards only, so the login outlives the profile. The table editor
      // then shows nothing while the invite keeps being refused — worth naming,
      // because the fix is somewhere the person looking has already checked.
      const supabase = await db();
      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .ilike("email", input.email)
        .maybeSingle();
      if (!profile) {
        throw new Error(
          `${input.email} still has a login even though its profile row is ` +
            "gone — deleting from the users table does not delete the " +
            "account. Remove it under Authentication → Users in Supabase, or " +
            `run: npx tsx scripts/delete-user.ts ${input.email} --yes`,
        );
      }
      throw new Error(`${input.email} already has an account.`);
    }
    if (
      authError.status === 429 ||
      /rate limit/i.test(authError.message)
    ) {
      throw new Error(
        "Supabase's built-in email sender is rate limited (about 2 per hour). " +
          "Configure custom SMTP to send invites properly.",
      );
    }
    if (/not authorized/i.test(authError.message)) {
      throw new Error(
        `Supabase will not email ${input.email} until custom SMTP is configured — ` +
          "the built-in sender only delivers to your Supabase project's own team.",
      );
    }
    throw new Error(authError.message);
  }
  const authUser = invited.user;
  if (!authUser) throw new Error("Failed to create auth user");

  // Trigger may have inserted the public.users row; ensure role/name.
  const supabase = await db();
  const { data, error } = await supabase
    .from("users")
    .upsert({
      id: authUser.id,
      name: input.name,
      email: input.email,
      role: input.role,
      is_active: true,
    })
    .select("*")
    .single();
  throwOn(error, "Failed to upsert public user");
  return mapUser(data);
}

export function columnIsPhase(column: BoardColumn) {
  return isDesignPhase(column);
}

export { DESIGN_PHASES };

/**
 * Turns a project into the recipient set `lib/email/plan.ts` expects.
 *
 * Lives here rather than in `plan.ts` on purpose — routing is pure and stays
 * testable without a connection, so resolution is the database's job. Anyone
 * without an address is dropped by `plan.ts`, not guessed at here.
 */
export async function resolveAudiences(
  project: ProjectWithRelations,
  phase: DesignPhase | null,
): Promise<Audiences> {
  const supabase = await db();

  const delegateId = phase
    ? (project.phases.find((p) => p.phase === phase)?.assignee_id ?? null)
    : null;

  // Per-project list chosen in Plan schedule. Pending and Active pass a null
  // phase and therefore resolve to nobody here — by design, not by omission.
  const recipientIds = phase
    ? (project.phases.find((p) => p.phase === phase)?.notify_ids ?? [])
    : [];

  const wanted = [
    ...new Set(
      [delegateId, project.created_by, ...recipientIds].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];

  const { data: peopleRows } = wanted.length
    ? await supabase
        .from("users")
        .select("id,name,email,is_active")
        .in("id", wanted)
    : { data: [] };

  const byId = new Map(
    (peopleRows ?? [])
      .filter((row) => row.is_active)
      .map((row) => [
        String(row.id),
        { name: String(row.name), email: String(row.email) },
      ]),
  );

  /**
   * "Leadership" in the routing table is Ryan and Austin. There is no column
   * naming them — gate parties are approval roles, not accounts — so the
   * standing signal for it is the admin role.
   */
  const { data: adminRows } = await supabase
    .from("users")
    .select("name,email")
    .eq("role", "admin")
    .eq("is_active", true);

  // Null means "same as the customer", per lib/contact.ts.
  const customerEmail = resolveContactField(
    "contact_email",
    project,
    project.customer,
  ).value;
  const customerName = resolveContactField(
    "contact_name",
    project,
    project.customer,
  ).value;

  return {
    delegate: delegateId ? (byId.get(delegateId) ?? null) : null,
    /**
     * The creator is set on every insert and backfilled (CARD_CREATOR_APPLY),
     * which makes it the owner the client-mail redirect reaches. `byId` has
     * already dropped deactivated users, so a departed owner resolves to null
     * and the message is held instead.
     */
    owner: project.created_by ? (byId.get(project.created_by) ?? null) : null,
    customerContact: customerEmail
      ? { name: customerName ?? project.customer.name, email: customerEmail }
      : null,
    phaseRecipients: recipientIds
      .map((id) => byId.get(id))
      .filter((p): p is { name: string; email: string } => Boolean(p)),
    leadership: (adminRows ?? []).map((row) => ({
      name: String(row.name),
      email: String(row.email),
    })),
  };
}
