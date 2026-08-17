import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getUserById } from "@/lib/db/repo";
import type { User } from "@/lib/types";

/**
 * `cache()` is request-scoped memoization, not a data cache — it dedupes the
 * calls a single render makes. The app layout and every page below it both
 * need the session, and each call is two network hops (auth.getUser, then the
 * users row). Without this the shell pays for all of them twice.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const profile = await getUserById(authUser.id);
  if (!profile || !profile.is_active) return null;
  return profile;
});

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return user;
}
