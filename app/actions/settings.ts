"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import {
  deleteUser,
  getUserById,
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

export type InviteResult = { ok: true } | { ok: false; error: string };

/**
 * Returns the failure instead of throwing: an invite fails for reasons the
 * admin can act on (address already taken, service key missing, SMTP not
 * configured), and a thrown server action reaches the client as an opaque
 * "unexpected error".
 */
export async function inviteUserAction(input: {
  name: string;
  email: string;
  role: UserRole;
}): Promise<InviteResult> {
  await requireAdmin();
  try {
    await inviteUser(input);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not send invite.",
    };
  }
  revalidatePath("/staff");
  return { ok: true };
}

export type DeleteUserResult = { ok: true } | { ok: false; error: string };

/**
 * Deletes an account outright — login included. Deactivating (`setActiveAction`)
 * is the reversible option and the right one for someone who has left; this is
 * for accounts that should never have existed, where leaving the login behind
 * means the address can never be invited again.
 *
 * Returns failures rather than throwing, like `inviteUserAction` — every one of
 * them is something the admin can act on.
 */
export async function deleteUserAction(
  userId: string,
): Promise<DeleteUserResult> {
  const admin = await requireAdmin();

  // Deleting yourself would revoke the session mid-request and, if you were
  // the only admin, leave nobody who can invite anyone back. Since the caller
  // is an admin and cannot be the target, at least one admin always remains —
  // which is why there is no separate last-admin check.
  if (admin.id === userId) {
    return {
      ok: false,
      error: "You cannot delete your own account.",
    };
  }

  const target = await getUserById(userId);
  if (!target) {
    return { ok: false, error: "That account no longer exists." };
  }

  try {
    await deleteUser(userId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not delete user.",
    };
  }

  // Assignments and activity rows lose their assignee across the app, not just
  // on /staff — the board reads both.
  revalidatePath("/staff");
  revalidatePath("/");
  return { ok: true };
}
