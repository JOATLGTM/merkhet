import { createClient } from "@/lib/supabase/server";
import { getUserById } from "@/lib/db/repo";
import type { User } from "@/lib/types";

export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const profile = await getUserById(authUser.id);
  if (!profile || !profile.is_active) return null;
  return profile;
}

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
