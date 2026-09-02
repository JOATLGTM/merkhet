"use server";

import { revalidatePath } from "next/cache";

import { attempt } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { clearOverridesPatch } from "@/lib/contact";
import { notifyGateRejected } from "@/lib/notifications";
import {
  clearApproval,
  createProject,
  deleteProject,
  getContractViewUrl,
  markProjectComplete,
  moveProject,
  recordApproval,
  rejectGate,
  saveDelegation,
  setPhaseRecipients,
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
  return attempt(async () => {
    const user = await requireUser();
    const project = await moveProject(projectId, toColumn, user.id);
    revalidateAll();
    return project;
  });
}

export async function uploadContractAction(formData: FormData) {
  return attempt(async () => {
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
  });
}

export async function getContractViewUrlAction(projectId: string) {
  return attempt(async () => {
    await requireUser();
    return getContractViewUrl(projectId);
  });
}

export async function markProjectCompleteAction(projectId: string) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await markProjectComplete(projectId, user.id);
    revalidateAll();
    return project;
  });
}

/**
 * Permanent, and the only destructive action on the board — hence the
 * `{ ok }` result rather than a throw, so the sheet can surface the reason
 * inline instead of tripping the error boundary and closing itself.
 */
export async function deleteProjectAction(projectId: string) {
  await requireUser();
  try {
    await deleteProject(projectId);
    revalidateAll();
    // The board and Completed list are covered above; a customer's own page
    // renders its project list from a dynamic segment, so it needs naming.
    revalidatePath("/customers/[id]", "page");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

export async function updateProjectFieldAction(
  projectId: string,
  field:
    | "name"
    | "description"
    | "start_date"
    | "target_completion"
    | "hours_per_week"
    | "project_address"
    | "project_contact_name"
    | "project_contact_email"
    | "project_contact_phone",
  value: string | number | null,
) {
  return attempt(async () => {
    const user = await requireUser();
    const patch =
      field === "hours_per_week"
        ? { hours_per_week: value === null || value === "" ? null : Number(value) }
        : { [field]: value === "" ? null : value };
    const project = await updateProject(projectId, patch, user.id);
    revalidateAll();
    return project;
  });
}

/**
 * Puts a project back on the customer's address and contact in one write.
 *
 * Four fields, one round trip and one activity entry — clearing them one at a
 * time would log four separate edits for a single decision.
 */
export async function clearProjectContactAction(projectId: string) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await updateProject(
      projectId,
      clearOverridesPatch(),
      user.id,
    );
    revalidateAll();
    return project;
  });
}

export async function toggleHoldAction(
  projectId: string,
  onHold: boolean,
  reason: string | null,
) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await toggleHold(projectId, onHold, reason, user.id);
    revalidateAll();
    return project;
  });
}

export async function updateAssigneeAction(
  projectId: string,
  phase: DesignPhase,
  assigneeId: string | null,
) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await updatePhaseAssignee(
      projectId,
      phase,
      assigneeId,
      user.id,
    );
    revalidateAll();
    return project;
  });
}

export async function updatePhaseDatesAction(
  projectId: string,
  phase: DesignPhase,
  planned_start: string | null,
  planned_end: string | null,
) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await updatePhaseDates(
      projectId,
      phase,
      planned_start,
      planned_end,
      user.id,
    );
    revalidateAll();
    return project;
  });
}

export async function updatePhaseHoursAction(
  projectId: string,
  phase: DesignPhase,
  plannedHours: number | null,
) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await updatePhaseHours(
      projectId,
      phase,
      plannedHours,
      user.id,
    );
    revalidateAll();
    return project;
  });
}

export async function setPhaseRecipientsAction(
  projectId: string,
  phase: DesignPhase,
  userIds: string[],
) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await setPhaseRecipients(projectId, phase, userIds, user.id);
    revalidateAll();
    return project;
  });
}

export async function saveDelegationAction(
  projectId: string,
  entries: DelegationEntry[],
  anchorDate: string,
) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await saveDelegation(projectId, entries, anchorDate, user.id);
    revalidateAll();
    return project;
  });
}

export async function recordApprovalAction(
  projectId: string,
  phase: GatePhase,
  party: ApprovalParty,
  /** The chosen third: a staff member's id, or null for the client. */
  approverUserId: string | null = null,
) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await recordApproval(
      projectId,
      phase,
      party,
      user.id,
      approverUserId,
    );
    revalidateAll();
    return project;
  });
}

export async function clearApprovalAction(
  projectId: string,
  phase: GatePhase,
  party: ApprovalParty,
) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await clearApproval(projectId, phase, party, user.id);
    revalidateAll();
    return project;
  });
}

export async function rejectGateAction(
  projectId: string,
  phase: GatePhase,
  /** Re-date the not-started phases from today. Off keeps the entered dates. */
  reflow = false,
) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await rejectGate(projectId, phase, user.id, reflow);

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
  });
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
  /** Null on any of these inherits the customer's — see `lib/contact.ts`. */
  project_address?: string | null;
  project_contact_name?: string | null;
  project_contact_email?: string | null;
  project_contact_phone?: string | null;
}) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await createProject({ ...input, actor_id: user.id });
    revalidateAll();
    return project;
  });
}
