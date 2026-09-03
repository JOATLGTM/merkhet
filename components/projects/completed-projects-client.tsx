"use client";

import { useMemo, useState } from "react";

import { ProjectDetailSheet } from "@/components/projects/project-detail-sheet";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFullDate } from "@/lib/dates";
import type {
  Consultant,
  Customer,
  ProjectWithRelations,
  User,
} from "@/lib/types";

export function CompletedProjectsClient({
  projects,
  users,
  customers,
  consultants,
}: {
  projects: ProjectWithRelations[];
  users: User[];
  customers: Customer[];
  consultants: Consultant[];
}) {
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.project_number.toLowerCase().includes(q) ||
          p.customer.name.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aDate = a.archived_at ?? a.updated_at;
        const bDate = b.archived_at ?? b.updated_at;
        return bDate.localeCompare(aDate);
      });
  }, [projects, query]);

  const selected = projects.find((p) => p.id === projectId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-rule bg-surface px-5 py-3">
        <h1 className="page-title">Completed projects</h1>
        <span className="num font-mono text-[11px] text-ink-soft">
          {projects.length}
        </span>
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
              <TableHead className="label-caps h-9 text-ink-soft">
                Project
              </TableHead>
              <TableHead className="label-caps h-9 text-ink-soft">
                Number
              </TableHead>
              <TableHead className="label-caps h-9 text-ink-soft">
                Customer
              </TableHead>
              <TableHead className="label-caps h-9 text-ink-soft">
                Completed
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-rule">
                <TableCell
                  colSpan={4}
                  className="py-8 text-[13px] text-ink-soft"
                >
                  No completed projects yet. Mark a Permitting project complete
                  to archive it here.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.id} className="border-rule">
                  <TableCell>
                    <button
                      type="button"
                      className="text-left text-[14px] font-medium text-ink underline-offset-2 hover:underline"
                      onClick={() => setProjectId(p.id)}
                    >
                      {p.name}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-ink-mid">
                    {p.project_number}
                  </TableCell>
                  <TableCell className="text-[13px] text-ink-mid">
                    {p.customer.name}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-ink-mid">
                    {formatFullDate(p.archived_at ?? p.updated_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProjectDetailSheet
        project={selected}
        users={users}
        customers={customers}
        consultants={consultants}
        open={Boolean(selected)}
        onClose={() => setProjectId(null)}
      />
    </div>
  );
}
