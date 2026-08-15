"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { notifyGateRejected } from "@/lib/notifications";
import {
  clearApproval,
  createProject,
  getContractViewUrl,
  markProjectComplete,
  moveProject,
  recordApproval,
  rejectGate,
  saveDelegation,
  toggleHold,
  updatePhaseAssignee,
  updatePhaseDates,
  updatePhaseHours,
  updateProject,
  uploadContractAndActivate,
} from "@/lib/db/repo";
import type { DelegationEntry } from "@/lib/db/repo";
import { GATE_REJECT_TARGET } from "@/lib/types";
import type { ApprovalParty, GatePhase } from "@/lib/types";
import type { BoardColumn, DesignPhase } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/customers");
  revalidatePath("/completed");
}

export async function moveProjectAction(
  projectId: string,
  toColumn: BoardColumn,
) {
  const user = await requireUser();
  const project = await moveProject(projectId, toColumn, user.id);
  revalidateAll();
  return project;
}

export async function uploadContractAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const file = formData.get("file");
  if (!projectId) throw new Error("Missing project.");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a PDF to upload.");
  }
  const project = await uploadContractAndActivate(projectId, file, user.id);
  revalidateAll();
  return project;
}

export async function getContractViewUrlAction(projectId: string) {
  await requireUser();
  return getContractViewUrl(projectId);
}

export async function markProjectCompleteAction(projectId: string) {
  const user = await requireUser();
  const project = await markProjectComplete(projectId, user.id);
  revalidateAll();
  return project;
}

export async function updateProjectFieldAction(
  projectId: string,
  field:
    | "name"
    | "description"
    | "start_date"
    | "target_completion"
    | "hours_per_week",
  value: string | number | null,
) {
  const user = await requireUser();
  const patch =
    field === "hours_per_week"
      ? { hours_per_week: value === null || value === "" ? null : Number(value) }
      : { [field]: value === "" ? null : value };
  const project = await updateProject(projectId, patch, user.id);
  revalidateAll();
  return project;
}

export async function toggleHoldAction(
  projectId: string,
  onHold: boolean,
  reason: string | null,
) {
  const user = await requireUser();
  const project = await toggleHold(projectId, onHold, reason, user.id);
  revalidateAll();
  return project;
}

export async function updateAssigneeAction(
  projectId: string,
  phase: DesignPhase,
  assigneeId: string | null,
) {
  const user = await requireUser();
  const project = await updatePhaseAssignee(
    projectId,
    phase,
    assigneeId,
    user.id,
  );
  revalidateAll();
  return project;
}

export async function updatePhaseDatesAction(
  projectId: string,
  phase: DesignPhase,
  planned_start: string | null,
  planned_end: string | null,
) {
  await requireUser();
  const project = await updatePhaseDates(
    projectId,
    phase,
    planned_start,
    planned_end,
  );
  revalidateAll();
  return project;
}

export async function updatePhaseHoursAction(
  projectId: string,
  phase: DesignPhase,
  plannedHours: number | null,
) {
  const user = await requireUser();
  const project = await updatePhaseHours(
    projectId,
    phase,
    plannedHours,
    user.id,
  );
  revalidateAll();
  return project;
}

export async function saveDelegationAction(
  projectId: string,
  entries: DelegationEntry[],
  anchorDate: string,
) {
  const user = await requireUser();
  const project = await saveDelegation(projectId, entries, anchorDate, user.id);
  revalidateAll();
  return project;
}

export async function recordApprovalAction(
  projectId: string,
  phase: GatePhase,
  party: ApprovalParty,
) {
  const user = await requireUser();
  const project = await recordApproval(projectId, phase, party, user.id);
  revalidateAll();
  return project;
}

export async function clearApprovalAction(
  projectId: string,
  phase: GatePhase,
  party: ApprovalParty,
) {
  const user = await requireUser();
  const project = await clearApproval(projectId, phase, party, user.id);
  revalidateAll();
  return project;
}

export async function rejectGateAction(projectId: string, phase: GatePhase) {
  const user = await requireUser();
  const project = await rejectGate(projectId, phase, user.id);

  await notifyGateRejected({
    projectId: project.id,
    projectName: project.name,
    projectNumber: project.project_number,
    gate: phase,
    returnedTo: GATE_REJECT_TARGET[phase],
    // The delegate of the phase being returned to (WORKFLOW-2 §4).
    delegateId:
      project.phases.find((p) => p.phase === GATE_REJECT_TARGET[phase])
        ?.assignee_id ?? null,
    actorId: user.id,
  });

  revalidateAll();
  return project;
}

export async function createProjectAction(input: {
  customer_id: string;
  name: string;
  description?: string | null;
  status?: "pending" | "active";
  current_phase?: DesignPhase | null;
  start_date?: string | null;
  target_completion?: string | null;
  hours_per_week?: number | null;
}) {
  const user = await requireUser();
  const project = await createProject({ ...input, actor_id: user.id });
  revalidateAll();
  return project;
}
