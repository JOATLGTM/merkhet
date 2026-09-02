import { redirect } from "next/navigation";

import { SettingsClient } from "@/components/settings/settings-client";
import { getSessionUser } from "@/lib/auth/session";
import {
  listInProgressAssignments,
  listUsers,
} from "@/lib/db/repo";
import { isAdmin } from "@/lib/types";
import { buildWorkload, weekOf } from "@/lib/workload";

/**
 * Reads the session cookie to gate on `isAdmin(user)`, so the segment
 * cannot produce a static shell. Admin-only and rarely navigated, so
 * blocking is the right trade here rather than a private-cached shell.
 */
export const instant = false;

export default async function StaffPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="border border-rule bg-surface px-8 py-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-redline">
            403
          </p>
          <h1 className="mt-2 text-[20px] text-ink">Admin only</h1>
          <p className="mt-2 text-[13px] text-ink-mid">
            You do not have access to staff.
          </p>
        </div>
      </div>
    );
  }

  const [users, assignments] = await Promise.all([
    listUsers(false),
    listInProgressAssignments(),
  ]);

  // Resolved here rather than in the panel: "the week containing today" is the
  // one non-deterministic input in the section, and computing it on the client
  // would make it a hydration mismatch waiting for a midnight render.
  const week = weekOf(new Date());
  // The whole roster, matching the Team table this renders into — including
  // deactivated staff, who can still be holding in-progress work.
  const workload = buildWorkload({ assignments, users, week });

  return (
    <SettingsClient
      users={users}
      workload={workload}
      week={week}
      currentUserId={user.id}
    />
  );
}
