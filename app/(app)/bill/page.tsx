import { Suspense } from "react";
import { redirect } from "next/navigation";

import { BillClient } from "@/components/billing/bill-client";
import Loader from "@/components/kokonutui/loader";
import { getSessionUser } from "@/lib/auth/session";
import { listCompletedProjects, listProjects, listUsers } from "@/lib/db/repo";

/**
 * Everything uncached sits inside the boundary, in a child that suspends —
 * the same shape as the board (see NEXT.md, Aug 14, for what happens when
 * the `await` lands above the `<Suspense>` instead).
 *
 * Both live and completed projects load: billing usually happens after the
 * work is done, so the project you need is often the one that just left the
 * board. Nothing else is read — the hours are already on the phases.
 */
async function BillLoaded() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [live, completed, users] = await Promise.all([
    listProjects(),
    listCompletedProjects(),
    // Whole roster: a deactivated colleague can still hold a phase.
    listUsers(false),
  ]);

  return <BillClient live={live} completed={completed} users={users} />;
}

export default function BillPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="border-b border-rule bg-surface px-5 py-3">
            <h1 className="page-title">Bill</h1>
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Loader title="Loading hours…" />
          </div>
        </div>
      }
    >
      <BillLoaded />
    </Suspense>
  );
}
