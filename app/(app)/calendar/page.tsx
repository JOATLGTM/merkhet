import { Suspense } from "react";

import { CalendarView } from "@/components/calendar/calendar-view";
import Loader from "@/components/kokonutui/loader";
import { listConsultants, listProjects, listUsers } from "@/lib/db/repo";

async function CalendarLoaded() {
  const [projects, users, consultants] = await Promise.all([
    listProjects(),
    listUsers(),
    listConsultants(),
  ]);
  const active = projects.filter((p) => p.status !== "completed");

  return (
    <CalendarView projects={active} users={users} consultants={consultants} />
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center gap-3 border-b border-rule bg-surface px-5 py-3">
            <h1 className="page-title">Calendar</h1>
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Loader title="Loading calendar…" />
          </div>
        </div>
      }
    >
      <CalendarLoaded />
    </Suspense>
  );
}
