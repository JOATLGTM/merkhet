import { Suspense } from "react";

import { ConsultantsClient } from "@/components/consultants/consultants-client";
import { listConsultants } from "@/lib/db/repo";

async function ConsultantsLoaded() {
  const consultants = await listConsultants();
  return <ConsultantsClient consultants={consultants} />;
}

export default function ConsultantsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center gap-4 border-b border-rule bg-surface px-5 py-3">
            <h1 className="page-title">Consultants</h1>
          </header>
          <div className="px-5 py-4 text-[13px] text-ink-soft">Loading…</div>
        </div>
      }
    >
      <ConsultantsLoaded />
    </Suspense>
  );
}
