import { Suspense } from "react";

import { CompletedProjectsClient } from "@/components/projects/completed-projects-client";
import {
  listCompletedProjects,
  listConsultants,
  listUsers,
} from "@/lib/db/repo";

async function CompletedLoaded() {
  const [projects, users, consultants] = await Promise.all([
    listCompletedProjects(),
    listUsers(),
    listConsultants(),
  ]);
  return (
    <CompletedProjectsClient
      projects={projects}
      users={users}
      consultants={consultants}
    />
  );
}

export default function CompletedProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="border-b border-rule bg-surface px-5 py-3">
            <h1 className="page-title">Completed projects</h1>
          </header>
          <div className="px-5 py-4 text-[13px] text-ink-soft">Loading…</div>
        </div>
      }
    >
      <CompletedLoaded />
    </Suspense>
  );
}
