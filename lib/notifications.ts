/**
 * Notification call sites. Resolve recipients, plan the messages, hand them to
 * the outbox.
 *
 * Every function here swallows its own errors. A notification is a side effect
 * of a state change that has already been committed — a provider outage must
 * not surface as a failed phase move, and the outbox row is the durable record
 * either way.
 *
 * Customer mail does not reach clients unless `EMAIL_CUSTOMER_ENABLED=true`.
 * Until then it is delivered verbatim to the project's owner
 * (`projects.created_by`) so the real message is read in a real inbox rather
 * than pulled out of the outbox by hand; see `lib/email/send.ts`.
 */

import { getProject, resolveAudiences } from "@/lib/db/repo";
import {
  planGateRejected,
  planPhaseEntry,
  planProjectComplete,
} from "@/lib/email/plan";
import { toEmailProject } from "@/lib/email/render";
import { enqueueAndSend } from "@/lib/email/send";
import type {
  BoardColumn,
  DesignPhase,
  GatePhase,
  ProjectPhase,
} from "@/lib/types";

function report(label: string, error: unknown) {
  console.error(
    `[notify] ${label}: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/** Schedule block for one phase, in the shape the templates expect. */
function scheduleOf(phase: ProjectPhase | null | undefined) {
  return phase
    ? {
        plannedStart: phase.planned_start,
        plannedEnd: phase.planned_end,
        durationDays: phase.duration_days,
        plannedHours: phase.planned_hours,
      }
    : null;
}

/** The phase whose delegate and schedule the mail is about, if any. */
function phaseOf(column: BoardColumn): DesignPhase | null {
  return column === "pending" || column === "active"
    ? null
    : (column as DesignPhase);
}

export type NotifyPhaseEntryInput = {
  projectId: string;
  column: BoardColumn;
  /** Who moved it — shown in the internal mail. */
  actorName: string;
  /** Where it came from. Null on creation. */
  previousColumn?: BoardColumn | null;
};

/**
 * A project entered a column. Covers the whole routing table: internal mail on
 * every column, customer mail on customer-visible phases.
 */
export async function notifyPhaseEntry(
  input: NotifyPhaseEntryInput,
): Promise<void> {
  try {
    const project = await getProject(input.projectId);
    if (!project) return;

    const phase = phaseOf(input.column);
    const audiences = await resolveAudiences(project, phase);
    const phaseRow = phase
      ? (project.phases.find((p) => p.phase === phase) ?? null)
      : null;

    const jobs = planPhaseEntry({
      project: toEmailProject(project, project.customer),
      column: input.column,
      previousColumn: input.previousColumn ?? null,
      movedBy: input.actorName,
      schedule: scheduleOf(phaseRow),
      audiences,
    });

    await enqueueAndSend(jobs, project.id);
  } catch (error) {
    report("phase entry", error);
  }
}

export type NotifyActiveInput = {
  projectId: string;
  projectName: string;
  projectNumber: string;
  actorId: string;
  /** Falls back to a neutral label when the caller has no name to hand. */
  actorName?: string;
};

/** Fired when a project enters Active (contract uploaded). */
export async function notifyProjectEnteredActive(
  input: NotifyActiveInput,
): Promise<void> {
  await notifyPhaseEntry({
    projectId: input.projectId,
    column: "active",
    actorName: input.actorName ?? "A team member",
  });
}

export type NotifyGateRejectedInput = {
  projectId: string;
  projectName: string;
  projectNumber: string;
  /** The gate that was rejected. */
  gate: GatePhase;
  /** The phase the project was sent back to for rework. */
  returnedTo: DesignPhase;
  /** Delegate of the phase being returned to — the recipient (WORKFLOW-2 §4). */
  delegateId: string | null;
  actorId: string;
  actorName?: string;
  /** Optional note from whoever rejected it. */
  reason?: string | null;
};

/** Fired when a Review / Final Review gate is rejected and the project reworks. */
export async function notifyGateRejected(
  input: NotifyGateRejectedInput,
): Promise<void> {
  try {
    const project = await getProject(input.projectId);
    if (!project) return;

    // Recipients hang off the phase being returned to, not the gate: the
    // delegate who has to redo the work is the point of the message.
    const audiences = await resolveAudiences(project, input.returnedTo);

    const jobs = planGateRejected({
      project: toEmailProject(project, project.customer),
      gate: input.gate,
      returnedTo: input.returnedTo,
      rejectedBy: input.actorName ?? "A reviewer",
      reason: input.reason ?? null,
      schedule: scheduleOf(
        project.phases.find((p) => p.phase === input.returnedTo),
      ),
      audiences,
    });

    await enqueueAndSend(jobs, project.id);
  } catch (error) {
    report("gate rejected", error);
  }
}

export type NotifyProjectCompleteInput = {
  projectId: string;
  completedBy: string;
  completedOn?: string | null;
};

/** Fired when a project is marked complete. */
export async function notifyProjectComplete(
  input: NotifyProjectCompleteInput,
): Promise<void> {
  try {
    const project = await getProject(input.projectId);
    if (!project) return;

    const audiences = await resolveAudiences(project, project.current_phase);

    const jobs = planProjectComplete({
      project: toEmailProject(project, project.customer),
      completedBy: input.completedBy,
      completedOn: input.completedOn ?? null,
      audiences,
    });

    await enqueueAndSend(jobs, project.id);
  } catch (error) {
    report("project complete", error);
  }
}
