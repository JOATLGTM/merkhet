import { unstable_rethrow } from "next/navigation";

/**
 * Why server actions return a result instead of throwing.
 *
 * In production, an `Error` thrown inside a server action reaches the browser
 * as React error #441 — "An error occurred in the Server Components render…
 * the specific message is omitted in production builds" — because Next strips
 * the message before serialising it. Every `toast.error(e.message)` in the app
 * therefore showed the real reason in `next dev` and a React error code on
 * merkhetdrafting.com (reported 2026-09-02: dragging a Pending card to Active
 * without a contract).
 *
 * So user-facing failures cross the wire as data: `{ ok: false, error }`.
 * `attempt` wraps an action body on the server; `unwrap` turns the result back
 * into a thrown `Error` on the client, so the existing `try / catch / toast`
 * call sites keep working unchanged apart from the wrap.
 */
export type ActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** What `requireUser` / `requireAdmin` throw, translated for a person. */
const AUTH_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Your session has expired — sign in again.",
  FORBIDDEN: "Only an admin can do that.",
};

/**
 * Runs an action body and returns its outcome as data. Next's own control
 * flow — `redirect()`, `notFound()` — is rethrown so it still works.
 */
export async function attempt<T>(body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, value: await body() };
  } catch (error) {
    unstable_rethrow(error);
    const message =
      error instanceof Error && error.message
        ? (AUTH_MESSAGES[error.message] ?? error.message)
        : "Something went wrong.";
    return { ok: false, error: message };
  }
}

/** Client side: the value, or a thrown `Error` carrying the real message. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.value;
  throw new Error(result.error);
}
