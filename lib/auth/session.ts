import { cookies } from "next/headers";

import { DEMO_PASSWORD, SESSION_COOKIE } from "@/lib/auth/constants";
import { getUserByEmail, getUserById } from "@/lib/db/repo";
import type { User } from "@/lib/types";

export { DEMO_PASSWORD, SESSION_COOKIE };

export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const userId = jar.get(SESSION_COOKIE)?.value;
  if (!userId) return null;
  const user = await getUserById(userId);
  if (!user || !user.is_active) return null;
  return user;
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

export async function authenticate(
  email: string,
  password: string,
): Promise<User | null> {
  if (password !== DEMO_PASSWORD) return null;
  const user = await getUserByEmail(email);
  if (!user || !user.is_active) return null;
  return user;
}
