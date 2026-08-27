"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createCustomerAction } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Customer } from "@/lib/types";

type Row = Customer & { total_projects: number; active_projects: number };

export function CustomersClient({ customers }: { customers: Row[] }) {
  const router = useRouter();
  // Read `?new=1` here rather than in the server page: awaiting searchParams
  // there is runtime data that blocks the route's static shell. The dialog is
  // driven straight off the URL — seeding useState from it would only be read
  // on mount, and the header link is a client nav that re-renders this
  // component rather than remounting it.
  const open = useSearchParams().get("new") === "1";
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const rows = useMemo(() => {
    return customers
      .filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, query]);

  return (
    <div className="flex-1 overflow-auto bg-paper px-5 py-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        className="mb-4 h-8 max-w-xs rounded-none border-rule-strong bg-surface"
      />

      <Table>
        <TableHeader>
          <TableRow className="border-rule hover:bg-transparent">
            <TableHead className="label-caps h-9 text-ink-soft">
              Customer
            </TableHead>
            <TableHead className="label-caps h-9 text-ink-soft">
              Contact
            </TableHead>
            <TableHead className="label-caps h-9 text-ink-soft">Email</TableHead>
            <TableHead className="label-caps h-9 text-right text-ink-soft">
              Projects
            </TableHead>
            <TableHead className="label-caps h-9 text-right text-ink-soft">
              Active
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id} className="border-rule">
              <TableCell>
                <Link
                  href={`/customers/${c.id}`}
                  className="text-[14px] font-medium text-ink underline-offset-2 hover:underline"
                >
                  {c.name}
                </Link>
              </TableCell>
              <TableCell className="text-[13px] text-ink-mid">
                {c.contact_name ?? "—"}
              </TableCell>
              <TableCell className="font-mono text-[12px] text-ink-mid">
                {c.contact_email ?? "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-[12px] tabular-nums text-ink">
                {c.total_projects}
              </TableCell>
              <TableCell className="text-right font-mono text-[12px] tabular-nums text-ink">
                {c.active_projects}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) router.replace("/customers");
        }}
      >
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>New customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact name</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="rounded-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact email</Label>
              <Input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="rounded-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact phone</Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="rounded-none"
              />
            </div>
            <Button
              disabled={pending || !name.trim()}
              className="rounded-none bg-phase-5 text-paper"
              onClick={() => {
                startTransition(async () => {
                  const customer = await createCustomerAction({
                    name: name.trim(),
                    contact_name: contactName || null,
                    contact_email: contactEmail || null,
                    contact_phone: contactPhone || null,
                  });
                  setName("");
                  setContactName("");
                  setContactEmail("");
                  setContactPhone("");
                  router.push(`/customers/${customer.id}`);
                  router.refresh();
                });
              }}
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
