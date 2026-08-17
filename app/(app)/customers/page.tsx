import Link from "next/link";
import { Suspense } from "react";

import { CustomersClient } from "@/components/customers/customers-client";
import Loader from "@/components/kokonutui/loader";
import { listCustomers } from "@/lib/db/repo";

function NewCustomerLink() {
  return (
    <Link
      href="/customers?new=1"
      className="ml-auto inline-flex h-8 items-center bg-phase-5 px-3 text-[13px] text-paper hover:bg-phase-5/90"
    >
      New customer
    </Link>
  );
}

/**
 * The count lives in the header, so the header renders inside the boundary
 * too — awaiting above it would block the route from prerendering even with
 * a <Suspense> around the client child.
 */
async function CustomersLoaded() {
  const customers = await listCustomers();

  return (
    <>
      <header className="flex items-center gap-4 border-b border-rule bg-surface px-5 py-3">
        <h1 className="page-title">Customers</h1>
        <span className="num font-mono text-[11px] text-ink-soft">
          {customers.length}
        </span>
        <NewCustomerLink />
      </header>
      {/* useSearchParams() needs its own boundary so the shell can prerender. */}
      <Suspense>
        <CustomersClient customers={customers} />
      </Suspense>
    </>
  );
}

export default function CustomersPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <>
            <header className="flex items-center gap-4 border-b border-rule bg-surface px-5 py-3">
              <h1 className="page-title">Customers</h1>
              <NewCustomerLink />
            </header>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <Loader title="Loading customers…" />
            </div>
          </>
        }
      >
        <CustomersLoaded />
      </Suspense>
    </div>
  );
}
