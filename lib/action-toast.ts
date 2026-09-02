import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";

/**
 * Client side, for fire-and-forget call sites with no `try` of their own:
 * shows the failure as a toast and returns the value, or null. Kept apart
 * from `lib/action-result.ts` so the server actions never import sonner.
 */
export function report<T>(result: ActionResult<T>): T | null {
  if (result.ok) return result.value;
  toast.error(result.error);
  return null;
}
