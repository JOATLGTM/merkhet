import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CustomerDetailClient } from "@/components/customers/customer-detail-client";
import Loader from "@/components/kokonutui/loader";
import {
  getCustomer,
  listConsultants,
  listProjects,
  listUsers,
} from "@/lib/db/repo";

/**
 * All data access sits inside the boundary. Awaiting in the default export —
 * even with a <Suspense> further down the tree — resolves before the boundary
 * is reached and blocks the route from prerendering.
 */
async function CustomerDetailLoaded({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const [projects, users, consultants] = await Promise.all([
    listProjects(),
    listUsers(),
    listConsultants(),
  ]);
  const related = projects.filter((p) => p.customer_id === id);

  return (
    <>
      <div className="border-b border-rule bg-surface px-6 py-5">
        <Link
          href="/customers"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft hover:text-ink"
        >
          ← Customers
        </Link>
        <h1 className="mt-2 text-[20px] text-ink">{customer.name}</h1>
      </div>
      <CustomerDetailClient
        customer={customer}
        projects={related}
        users={users}
        consultants={consultants}
        initialProjectId={sp.project ?? null}
      />
    </>
  );
}

export default function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <>
            <div className="border-b border-rule bg-surface px-6 py-5">
              <Link
                href="/customers"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft hover:text-ink"
              >
                ← Customers
              </Link>
              <div className="mt-2 h-[26px]" />
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <Loader title="Loading customer…" />
            </div>
          </>
        }
      >
        <CustomerDetailLoaded params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
