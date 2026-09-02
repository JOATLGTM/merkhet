"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createConsultantAction } from "@/app/actions/consultants";
import { unwrap } from "@/lib/action-result";
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
import { Textarea } from "@/components/ui/textarea";
import type { Consultant } from "@/lib/types";

export function ConsultantsClient({
  consultants,
}: {
  consultants: Consultant[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openNew = searchParams.get("new") === "1";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ?new=1 from the header (or a deep link) must open after client nav —
  // useState(openNew) only applies on first mount, so a same-route query
  // change would otherwise leave the dialog closed until a full refresh.
  useEffect(() => {
    if (openNew) setOpen(true);
  }, [openNew]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return consultants
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          (c.company ?? "").toLowerCase().includes(q) ||
          (c.discipline ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [consultants, query]);

  const reset = () => {
    setName("");
    setCompany("");
    setDiscipline("");
    setEmail("");
    setPhone("");
    setNotes("");
    setError(null);
  };

  const openDialog = () => {
    setError(null);
    setOpen(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-rule bg-surface px-5 py-3">
        <h1 className="page-title">Consultants</h1>
        <span className="num font-mono text-[11px] text-ink-soft">
          {consultants.length}
        </span>
        <Button
          type="button"
          className="ml-auto h-8 rounded-none bg-phase-5 px-3 text-[13px] text-paper hover:bg-phase-5/90"
          onClick={openDialog}
        >
          New consultant
        </Button>
      </header>

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
              <TableHead className="label-caps h-9 text-ink-soft">Name</TableHead>
              <TableHead className="label-caps h-9 text-ink-soft">
                Discipline
              </TableHead>
              <TableHead className="label-caps h-9 text-ink-soft">
                Company
              </TableHead>
              <TableHead className="label-caps h-9 text-ink-soft">
                Email
              </TableHead>
              <TableHead className="label-caps h-9 text-ink-soft">
                Phone
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-rule">
                <TableCell
                  colSpan={5}
                  className="py-8 text-[13px] text-ink-soft"
                >
                  No consultants yet. Add soil engineers, septic designers, and
                  other external specialists here.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id} className="border-rule">
                  <TableCell>
                    <Link
                      href={`/consultants/${c.id}`}
                      className="text-[14px] font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[13px] text-ink-mid">
                    {c.discipline ?? "—"}
                  </TableCell>
                  <TableCell className="text-[13px] text-ink-mid">
                    {c.company ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-ink-mid">
                    {c.email ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-ink-mid">
                    {c.phone ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            reset();
            if (openNew) router.replace("/consultants");
          }
        }}
      >
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New consultant</DialogTitle>
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
              <Label>Discipline</Label>
              <Input
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                placeholder="e.g. Soil engineer"
                className="rounded-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="rounded-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="rounded-none"
              />
            </div>
            {error && <p className="text-[13px] text-redline">{error}</p>}
            <Button
              disabled={pending || !name.trim()}
              className="rounded-none bg-ink text-surface"
              onClick={() => {
                startTransition(async () => {
                  try {
                    const created = unwrap(await createConsultantAction({
                      name,
                      company,
                      discipline,
                      email,
                      phone,
                      notes,
                    }));
                    setOpen(false);
                    reset();
                    router.push(`/consultants/${created.id}`);
                    router.refresh();
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Could not create consultant",
                    );
                  }
                });
              }}
            >
              {pending ? "Creating…" : "Create consultant"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
