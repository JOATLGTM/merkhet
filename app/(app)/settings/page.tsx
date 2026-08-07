import { redirect } from "next/navigation";

import { SettingsClient } from "@/components/settings/settings-client";
import { getSessionUser } from "@/lib/auth/session";
import { listPhaseSubscribers, listUsers } from "@/lib/db/repo";

export default async function SettingsPage() {
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
            You do not have access to settings.
          </p>
        </div>
      </div>
    );
  }

  const [users, subscribers] = await Promise.all([
    listUsers(false),
    listPhaseSubscribers(),
  ]);

  return <SettingsClient users={users} subscribers={subscribers} />;
}
