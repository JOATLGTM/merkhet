import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type {
  BoardColumn,
  Customer,
  DesignPhase,
  Project,
  ProjectPhase,
  ProjectWithRelations,
  ActivityLog,
  PhaseSubscriber,
  User,
  UserRole,
  Consultant,
} from "@/lib/types";
import { DESIGN_PHASES, boardColumnOf, isDesignPhase } from "@/lib/types";

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
    client_contact_id: (row.client_contact_id as string | null) ?? null,
    hours_per_week: asNumber(row.hours_per_week),
    archived_at: (row.archived_at as string | null) ?? null,
    contract_path: (row.contract_path as string | null) ?? null,
    contract_filename: (row.contract_filename as string | null) ?? null,
    contract_uploaded_at: (row.contract_uploaded_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapPhase(row: Record<string, unknown>): ProjectPhase {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    phase: row.phase as DesignPhase,
    assignee_id: (row.assignee_id as string | null) ?? null,
    status: row.status as ProjectPhase["status"],
    planned_start: (row.planned_start as string | null) ?? null,
    planned_end: (row.planned_end as string | null) ?? null,
    duration_days: asNumber(row.duration_days),
    entered_at: (row.entered_at as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    sort_order: Number(row.sort_order),
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

export async function listUsers(activeOnly = true): Promise<User[]> {
  const supabase = await db();
  let query = supabase.from("users").select("*").order("name");
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  throwOn(error, "Failed to list users");
  return (data ?? []).map((row) => mapUser(row));
}

export async function getUserById(id: string): Promise<User | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOn(error, "Failed to load user");
  return data ? mapUser(data) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  throwOn(error, "Failed to load user");
  return data ? mapUser(data) : null;
}

export async function listCustomers(): Promise<
  (Customer & { total_projects: number; active_projects: number })[]
> {
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
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOn(error, "Failed to load customer");
  return data ? mapCustomer(data) : null;
}

export async function createCustomer(
  input: Pick<
    Customer,
    | "name"
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
  ]);
  throwOn(cErr, "Missing customer");
  throwOn(pErr, "Failed to load phases");
  throwOn(aErr, "Failed to load activity");
  throwOn(jErr, "Failed to load project consultants");

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
    phases: (phases ?? []).map((row) => mapPhase(row)),
    activity: (activity ?? []).map((row) => mapActivity(row)),
    consultants,
  };
}

export async function listProjects(): Promise<ProjectWithRelations[]> {
  const supabase = await db();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  throwOn(error, "Failed to list projects");
  if (!projects?.length) return [];

  const ids = projects.map((p) => p.id);
  const customerIds = [...new Set(projects.map((p) => p.customer_id))];

  const [
    { data: customers, error: cErr },
    { data: phases, error: pErr },
    { data: activity, error: aErr },
    { data: joins, error: jErr },
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
  ]);
  throwOn(cErr, "Failed to load customers");
  throwOn(pErr, "Failed to load phases");
  throwOn(aErr, "Failed to load activity");
  throwOn(jErr, "Failed to load project consultants");

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
    list.push(mapPhase(row));
    phasesByProject.set(row.project_id, list);
  }
  const activityByProject = new Map<string, ActivityLog[]>();
  for (const row of activity ?? []) {
    const list = activityByProject.get(row.project_id) ?? [];
    list.push(mapActivity(row));
    activityByProject.set(row.project_id, list);
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
    };
  });
}

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
    const { error: activityError } = await supabase.from("activity_log").insert({
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
  return (await getProject(id))!;
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

export async function listPhaseSubscribers(): Promise<PhaseSubscriber[]> {
  const supabase = await db();
  const { data, error } = await supabase.from("phase_subscribers").select("*");
  throwOn(error, "Failed to list subscribers");
  return (data ?? []).map((row) => ({
    phase: row.phase as DesignPhase,
    user_id: String(row.user_id),
    created_at: String(row.created_at),
  }));
}

export async function listConsultants(): Promise<Consultant[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("consultants")
    .select("*")
    .order("name");
  throwOn(error, "Failed to list consultants");
  return (data ?? []).map((row) => mapConsultant(row));
}

export async function getConsultant(id: string): Promise<Consultant | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("consultants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOn(error, "Failed to load consultant");
  return data ? mapConsultant(data) : null;
}

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

export async function setPhaseSubscribers(
  phase: DesignPhase,
  userIds: string[],
) {
  const supabase = await db();
  const { error: delError } = await supabase
    .from("phase_subscribers")
    .delete()
    .eq("phase", phase);
  throwOn(delError, "Failed to clear subscribers");

  if (userIds.length) {
    const { error } = await supabase.from("phase_subscribers").insert(
      userIds.map((user_id) => ({ phase, user_id })),
    );
    throwOn(error, "Failed to set subscribers");
  }

  return listPhaseSubscribers().then((rows) =>
    rows.filter((s) => s.phase === phase),
  );
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

  if (!isActive) {
    const { error: subError } = await supabase
      .from("phase_subscribers")
      .delete()
      .eq("user_id", id);
    throwOn(subError, "Failed to clear subscriptions");
  }

  return mapUser(data);
}

export async function inviteUser(input: {
  name: string;
  email: string;
  role: UserRole;
}) {
  // Prefer service-role create when available; otherwise insert is blocked by
  // users.id FK to auth.users — surface a clear error.
  const { createServiceClient } = await import("@/lib/supabase/admin");
  let admin;
  try {
    admin = createServiceClient();
  } catch {
    throw new Error(
      "Inviting users requires SUPABASE_SERVICE_ROLE_KEY on the server.",
    );
  }

  const { data: created, error: authError } =
    await admin.auth.admin.createUser({
      email: input.email,
      email_confirm: true,
      password: crypto.randomUUID().slice(0, 12) + "Aa1!",
      user_metadata: { name: input.name, role: input.role },
    });
  if (authError) throw new Error(authError.message);
  if (!created.user) throw new Error("Failed to create auth user");

  // Trigger may have inserted the public.users row; ensure role/name.
  const supabase = await db();
  const { data, error } = await supabase
    .from("users")
    .upsert({
      id: created.user.id,
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
