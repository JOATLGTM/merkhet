import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CustomerDetailClient } from "@/components/customers/customer-detail-client";
import { getCustomer, listProjects, listUsers } from "@/lib/db/repo";

export default async function CustomerDetailPage({
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

  const [projects, users] = await Promise.all([listProjects(), listUsers()]);
  const related = projects.filter((p) => p.customer_id === id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-rule bg-surface px-6 py-5">
        <Link
          href="/customers"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft hover:text-ink"
        >
          ← Customers
        </Link>
        <h1 className="mt-2 text-[20px] text-ink">{customer.name}</h1>
      </div>
      <Suspense>
        <CustomerDetailClient
          customer={customer}
          projects={related}
          users={users}
          initialProjectId={sp.project ?? null}
        />
      </Suspense>
    </div>
  );
}
