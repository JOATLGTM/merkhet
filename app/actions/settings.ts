"use server";

import { revalidatePath } from "next/cache";

import { attempt } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth/session";
import {
  deleteUser,
  getUserById,
  inviteUser,
  setUserActive,
  updateUserRole,
} from "@/lib/db/repo";
import { ASSIGNABLE_ROLES, type UserRole } from "@/lib/types";

/**
 * The developer account is set by migration and protected by a trigger
 * (DEVELOPER_ROLE_APPLY). These actions refuse before reaching it so the
 * failure is a sentence rather than a Postgres error surfaced as "unexpected".
 */
const assignable = (role: UserRole) =>
  (ASSIGNABLE_ROLES as readonly string[]).includes(role);

async function refuseDeveloper(userId: string) {
  const target = await getUserById(userId);
  if (target?.role === "developer") {
    throw new Error("The developer account cannot be changed.");
  }
}

export async function updateRoleAction(userId: string, role: UserRole) {
  return attempt(async () => {
    await requireAdmin();
    if (!assignable(role)) throw new Error("That role cannot be assigned.");
    await refuseDeveloper(userId);
    const user = await updateUserRole(userId, role);
    revalidatePath("/staff");
    return user;
  });
}

export async function setActiveAction(userId: string, isActive: boolean) {
  return attempt(async () => {
    await requireAdmin();
    await refuseDeveloper(userId);
    const user = await setUserActive(userId, isActive);
    revalidatePath("/staff");
    revalidatePath("/");
    return user;
  });
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
  if (!assignable(input.role)) {
    return { ok: false, error: "That role cannot be assigned." };
  }
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
  if (target.role === "developer") {
    return { ok: false, error: "The developer account cannot be deleted." };
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
