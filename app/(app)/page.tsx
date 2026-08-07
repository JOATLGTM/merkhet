import { Suspense } from "react";

import { BoardView } from "@/components/board/board-view";
import { CommandPalette } from "@/components/command/command-palette";
import { getSessionUser } from "@/lib/auth/session";
import {
  listCustomers,
  listPhaseSubscribers,
  listProjects,
  listUsers,
} from "@/lib/db/repo";
import { redirect } from "next/navigation";

export default async function BoardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [projects, users, customers, subscribers] = await Promise.all([
    listProjects(),
    listUsers(),
    listCustomers(),
    listPhaseSubscribers(),
  ]);

  return (
    <>
      <Suspense fallback={<div className="p-6 text-ink-mid">Loading board…</div>}>
        <BoardView
          projects={projects}
          users={users}
          customers={customers}
          subscribers={subscribers}
          currentUser={user}
        />
      </Suspense>
      <CommandPalette projects={projects} customers={customers} />
    </>
  );
}
