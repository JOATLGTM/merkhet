import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ConsultantDetailClient } from "@/components/consultants/consultant-detail-client";
import { getConsultant } from "@/lib/db/repo";

async function ConsultantDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const consultant = await getConsultant(id);
  if (!consultant) notFound();
  return <ConsultantDetailClient consultant={consultant} />;
}

export default function ConsultantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-rule bg-surface px-5 py-3">
        <Link
          href="/consultants"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft hover:text-ink"
        >
          ← Consultants
        </Link>
      </div>
      <Suspense
        fallback={
          <div className="px-5 py-5 text-[13px] text-ink-soft">Loading…</div>
        }
      >
        <ConsultantDetail params={params} />
      </Suspense>
    </div>
  );
}
