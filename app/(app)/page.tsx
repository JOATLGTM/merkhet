import { Suspense } from "react";

import { BoardView } from "@/components/board/board-view";
import Loader from "@/components/kokonutui/loader";
import { CommandPalette } from "@/components/command/command-palette";
import { getSessionUser } from "@/lib/auth/session";
import {
  listConsultants,
  listCustomers,
  listProjects,
  listUsers,
} from "@/lib/db/repo";
import { redirect } from "next/navigation";

/**
 * Everything that reads cookies or the database sits inside the boundary —
 * `getSessionUser()` included, since reading the session cookie is itself
 * uncached. The previous shape awaited above the <Suspense>, which resolved
 * before the boundary was reached and blocked the route from prerendering.
 *
 * The palette shares the board's data, so it renders here rather than being
 * hoisted out and refetching.
 */
async function BoardLoaded() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [projects, users, customers, consultants] = await Promise.all([
    listProjects(),
    listUsers(),
    listCustomers(),
    listConsultants(),
  ]);

  return (
    <>
      <BoardView
        projects={projects}
        users={users}
        customers={customers}
        consultants={consultants}
      />
      <CommandPalette projects={projects} customers={customers} />
    </>
  );
}

export default function BoardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center gap-4 border-b border-rule bg-surface px-5 py-3">
            <h1 className="page-title">Board</h1>
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Loader title="Loading board…" />
          </div>
        </div>
      }
    >
      <BoardLoaded />
    </Suspense>
  );
}
