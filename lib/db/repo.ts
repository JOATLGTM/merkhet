import {
  applyPhaseMove,
  getDemoStore,
  nextProjectNumber,
  seedPhasesForProject,
} from "@/lib/db/demo-store";
import type {
  BoardColumn,
  Customer,
  DesignPhase,
  Project,
  ProjectWithRelations,
  User,
  UserRole,
} from "@/lib/types";
import { DESIGN_PHASES, isDesignPhase } from "@/lib/types";

function stamp() {
  return new Date().toISOString();
}

export async function listUsers(activeOnly = true): Promise<User[]> {
  const store = getDemoStore();
  return store.users
    .filter((u) => (activeOnly ? u.is_active : true))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getUserById(id: string): Promise<User | null> {
  return getDemoStore().users.find((u) => u.id === id) ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return (
    getDemoStore().users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    ) ?? null
  );
}

export async function listCustomers(): Promise<
  (Customer & { total_projects: number; active_projects: number })[]
> {
  const store = getDemoStore();
  return store.customers
    .map((c) => {
      const related = store.projects.filter((p) => p.customer_id === c.id);
      return {
        ...c,
        total_projects: related.length,
        active_projects: related.filter((p) => p.status === "active").length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return getDemoStore().customers.find((c) => c.id === id) ?? null;
}

export async function createCustomer(
  input: Pick<
    Customer,
    "name" | "contact_name" | "contact_email" | "contact_phone" | "notes"
  >,
): Promise<Customer> {
  const store = getDemoStore();
  const customer: Customer = {
    id: crypto.randomUUID(),
    name: input.name,
    contact_name: input.contact_name,
    contact_email: input.contact_email,
    contact_phone: input.contact_phone,
    notes: input.notes,
    created_at: stamp(),
    updated_at: stamp(),
  };
  store.customers.unshift(customer);
  return customer;
}

export async function updateCustomer(
  id: string,
  patch: Partial<
    Pick<
      Customer,
      "name" | "contact_name" | "contact_email" | "contact_phone" | "notes"
    >
  >,
): Promise<Customer> {
  const store = getDemoStore();
  const customer = store.customers.find((c) => c.id === id);
  if (!customer) throw new Error("Customer not found");
  Object.assign(customer, patch, { updated_at: stamp() });
  return customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  const store = getDemoStore();
  if (store.projects.some((p) => p.customer_id === id)) {
    throw new Error("Cannot delete a customer that has projects.");
  }
  store.customers = store.customers.filter((c) => c.id !== id);
}

export async function listProjects(): Promise<ProjectWithRelations[]> {
  const store = getDemoStore();
  return store.projects.map((project) => hydrate(project));
}

export async function getProject(
  id: string,
): Promise<ProjectWithRelations | null> {
  const project = getDemoStore().projects.find((p) => p.id === id);
  return project ? hydrate(project) : null;
}

function hydrate(project: Project): ProjectWithRelations {
  const store = getDemoStore();
  const customer = store.customers.find((c) => c.id === project.customer_id);
  if (!customer) throw new Error("Missing customer");
  return {
    ...project,
    customer,
    phases: store.phases
      .filter((p) => p.project_id === project.id)
      .sort((a, b) => a.sort_order - b.sort_order),
    activity: store.activity
      .filter((a) => a.project_id === project.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
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
  const store = getDemoStore();
  if (!store.customers.some((c) => c.id === input.customer_id)) {
    throw new Error("Customer not found");
  }
  const status = input.status ?? "backlog";
  const current_phase =
    status === "active" ? (input.current_phase ?? "schematic_design") : null;
  const project: Project = {
    id: crypto.randomUUID(),
    customer_id: input.customer_id,
    project_number: nextProjectNumber(store),
    name: input.name,
    description: input.description ?? null,
    status,
    current_phase,
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: input.start_date ?? null,
    target_completion: input.target_completion ?? null,
    hours_per_week: input.hours_per_week ?? null,
    created_at: stamp(),
    updated_at: stamp(),
  };
  store.projects.unshift(project);
  const phases = seedPhasesForProject(project.id);
  if (current_phase) {
    const row = phases.find((p) => p.phase === current_phase);
    if (row) {
      row.status = "in_progress";
      row.entered_at = stamp();
    }
  }
  store.phases.push(...phases);
  store.activity.unshift({
    id: crypto.randomUUID(),
    project_id: project.id,
    actor_id: input.actor_id,
    event_type: "project.created",
    payload: {},
    created_at: stamp(),
  });
  return hydrate(project);
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
  const store = getDemoStore();
  const project = store.projects.find((p) => p.id === id);
  if (!project) throw new Error("Project not found");
  const changed: Record<string, [unknown, unknown]> = {};
  for (const [key, value] of Object.entries(patch)) {
    const prev = project[key as keyof Project];
    if (prev !== value) {
      changed[key] = [prev, value];
      // @ts-expect-error dynamic assign
      project[key] = value;
    }
  }
  project.updated_at = stamp();
  if (Object.keys(changed).length) {
    store.activity.unshift({
      id: crypto.randomUUID(),
      project_id: id,
      actor_id: actorId,
      event_type: "project.updated",
      payload: { changed },
      created_at: stamp(),
    });
  }
  return hydrate(project);
}

export async function toggleHold(
  id: string,
  onHold: boolean,
  reason: string | null,
  actorId: string,
): Promise<ProjectWithRelations> {
  const store = getDemoStore();
  const project = store.projects.find((p) => p.id === id);
  if (!project) throw new Error("Project not found");
  project.on_hold = onHold;
  project.on_hold_since = onHold ? stamp() : null;
  project.on_hold_reason = onHold ? reason : null;
  project.updated_at = stamp();
  store.activity.unshift({
    id: crypto.randomUUID(),
    project_id: id,
    actor_id: actorId,
    event_type: "project.hold_toggled",
    payload: { on_hold: onHold, reason },
    created_at: stamp(),
  });
  return hydrate(project);
}

export async function moveProject(
  id: string,
  toColumn: BoardColumn,
  actorId: string,
): Promise<ProjectWithRelations> {
  applyPhaseMove(getDemoStore(), id, toColumn, actorId);
  return (await getProject(id))!;
}

export async function updatePhaseAssignee(
  projectId: string,
  phase: DesignPhase,
  assigneeId: string | null,
  actorId: string,
): Promise<ProjectWithRelations> {
  const store = getDemoStore();
  const row = store.phases.find(
    (p) => p.project_id === projectId && p.phase === phase,
  );
  if (!row) throw new Error("Phase not found");
  const from = row.assignee_id;
  row.assignee_id = assigneeId;
  store.activity.unshift({
    id: crypto.randomUUID(),
    project_id: projectId,
    actor_id: actorId,
    event_type: "phase.assignee_changed",
    payload: { phase, from_user_id: from, to_user_id: assigneeId },
    created_at: stamp(),
  });
  return (await getProject(projectId))!;
}

export async function updatePhaseDates(
  projectId: string,
  phase: DesignPhase,
  planned_start: string | null,
  planned_end: string | null,
): Promise<ProjectWithRelations> {
  const store = getDemoStore();
  const row = store.phases.find(
    (p) => p.project_id === projectId && p.phase === phase,
  );
  if (!row) throw new Error("Phase not found");
  row.planned_start = planned_start;
  row.planned_end = planned_end;
  return (await getProject(projectId))!;
}

export async function listPhaseSubscribers() {
  return getDemoStore().subscribers;
}

export async function setPhaseSubscribers(
  phase: DesignPhase,
  userIds: string[],
) {
  const store = getDemoStore();
  store.subscribers = [
    ...store.subscribers.filter((s) => s.phase !== phase),
    ...userIds.map((user_id) => ({
      phase,
      user_id,
      created_at: stamp(),
    })),
  ];
  return store.subscribers.filter((s) => s.phase === phase);
}

export async function updateUserRole(id: string, role: UserRole) {
  const user = getDemoStore().users.find((u) => u.id === id);
  if (!user) throw new Error("User not found");
  user.role = role;
  return user;
}

export async function setUserActive(id: string, isActive: boolean) {
  const store = getDemoStore();
  const user = store.users.find((u) => u.id === id);
  if (!user) throw new Error("User not found");
  user.is_active = isActive;
  if (!isActive) {
    store.subscribers = store.subscribers.filter((s) => s.user_id !== id);
  }
  return user;
}

export async function inviteUser(input: {
  name: string;
  email: string;
  role: UserRole;
}) {
  const store = getDemoStore();
  if (store.users.some((u) => u.email === input.email)) {
    throw new Error("A user with that email already exists.");
  }
  const user: User = {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    role: input.role,
    is_active: true,
    created_at: stamp(),
  };
  store.users.push(user);
  return user;
}

export function columnIsPhase(column: BoardColumn) {
  return isDesignPhase(column);
}

export { DESIGN_PHASES };
