"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import {
  inviteUser,
  setPhaseSubscribers,
  setUserActive,
  updateUserRole,
} from "@/lib/db/repo";
import type { DesignPhase, UserRole } from "@/lib/types";

export async function setSubscribersAction(
  phase: DesignPhase,
  userIds: string[],
) {
  await requireAdmin();
  const rows = await setPhaseSubscribers(phase, userIds);
  revalidatePath("/");
  revalidatePath("/staff");
  return rows;
}

export async function updateRoleAction(userId: string, role: UserRole) {
  await requireAdmin();
  const user = await updateUserRole(userId, role);
  revalidatePath("/staff");
  return user;
}

export async function setActiveAction(userId: string, isActive: boolean) {
  await requireAdmin();
  const user = await setUserActive(userId, isActive);
  revalidatePath("/staff");
  revalidatePath("/");
  return user;
}

export async function inviteUserAction(input: {
  name: string;
  email: string;
  role: UserRole;
}) {
  await requireAdmin();
  const user = await inviteUser(input);
  revalidatePath("/staff");
  return user;
}
