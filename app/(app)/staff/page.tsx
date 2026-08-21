import { redirect } from "next/navigation";

import { SettingsClient } from "@/components/settings/settings-client";
import { getSessionUser } from "@/lib/auth/session";
import {
  listInProgressAssignments,
  listPhaseSubscribers,
  listUsers,
} from "@/lib/db/repo";
import { buildWorkload, weekOf } from "@/lib/workload";

/**
 * Reads the session cookie to gate on `role === 'admin'`, so the segment
 * cannot produce a static shell. Admin-only and rarely navigated, so
 * blocking is the right trade here rather than a private-cached shell.
 */
export const instant = false;

export default async function StaffPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") {
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

  const [users, subscribers, assignments] = await Promise.all([
    listUsers(false),
    listPhaseSubscribers(),
    listInProgressAssignments(),
  ]);

  // Resolved here rather than in the panel: "the week containing today" is the
  // one non-deterministic input in the section, and computing it on the client
  // would make it a hydration mismatch waiting for a midnight render.
  const week = weekOf(new Date());
  // Active staff always get a row; a deactivated one only if they are still
  // holding in-progress work, which is a thing worth seeing rather than hiding.
  const assigned = new Set(assignments.map((a) => a.assigneeId));
  const workload = buildWorkload({
    assignments,
    users: users.filter((u) => u.is_active || assigned.has(u.id)),
    week,
  });

  return (
    <SettingsClient
      users={users}
      subscribers={subscribers}
      workload={workload}
      week={week}
    />
  );
}
