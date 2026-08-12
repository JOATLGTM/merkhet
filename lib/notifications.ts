/**
 * Notification stubs — Slice 6 will replace these with a real provider + outbox.
 * Call sites stay stable so wiring later is a single swap.
 */

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
