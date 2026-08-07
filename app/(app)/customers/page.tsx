import Link from "next/link";

import { CustomersClient } from "@/components/customers/customers-client";
import { listCustomers } from "@/lib/db/repo";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const params = await searchParams;
  const customers = await listCustomers();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-rule bg-surface px-5 py-3">
        <h1 className="page-title">Customers</h1>
        <span className="num font-mono text-[11px] text-ink-soft">
          {customers.length}
        </span>
        <Link
          href="/customers?new=1"
          className="ml-auto inline-flex h-8 items-center bg-phase-5 px-3 text-[13px] text-paper hover:bg-phase-5/90"
        >
          New customer
        </Link>
      </header>
      <CustomersClient customers={customers} openNew={params.new === "1"} />
    </div>
  );
}
