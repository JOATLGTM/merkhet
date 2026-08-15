/**
 * Notification stubs — Slice 6 will replace these with a real provider + outbox.
 * Call sites stay stable so wiring later is a single swap.
 */

import type { DesignPhase, GatePhase } from "@/lib/types";

export type NotifyActiveInput = {
  projectId: string;
  projectName: string;
  projectNumber: string;
  actorId: string;
};

/** Fired when a project enters Active (contract uploaded). Recipients: Ryan, Austin. */
export async function notifyProjectEnteredActive(
  input: NotifyActiveInput,
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.info("[notify:stub] → Active", {
      project: input.projectNumber,
      name: input.projectName,
      recipients: ["Ryan", "Austin"],
      actorId: input.actorId,
    });
  }
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
};

/** Fired when a Review / Final Review gate is rejected and the project reworks. */
export async function notifyGateRejected(
  input: NotifyGateRejectedInput,
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.info("[notify:stub] → gate rejected", {
      project: input.projectNumber,
      name: input.projectName,
      gate: input.gate,
      returnedTo: input.returnedTo,
      recipientDelegateId: input.delegateId,
      actorId: input.actorId,
    });
  }
}
