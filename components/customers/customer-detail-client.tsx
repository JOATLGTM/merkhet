"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteCustomerAction,
  updateCustomerAction,
} from "@/app/actions/customers";
import { PhaseRule } from "@/components/projects/phase-rule";
import { ProjectDetailSheet } from "@/components/projects/project-detail-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCardDate } from "@/lib/dates";
import {
  COLUMN_LABELS,
  boardColumnOf,
  initials,
  type Consultant,
  type Customer,
  type ProjectWithRelations,
  type User,
} from "@/lib/types";

export function CustomerDetailClient({
  customer,
  projects,
  users,
  consultants,
  initialProjectId,
}: {
  customer: Customer;
  projects: ProjectWithRelations[];
  users: User[];
  consultants: Consultant[];
  initialProjectId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const usersById = new Map(users.map((u) => [u.id, u]));
  const selected = projects.find((p) => p.id === projectId) ?? null;

  const saveField = (
    field:
      | "name"
      | "address"
      | "contact_name"
      | "contact_email"
      | "contact_phone"
      | "spouse_name"
      | "notes",
    value: string,
  ) => {
    startTransition(async () => {
      await updateCustomerAction(customer.id, {
        [field]: value === "" ? null : value,
      });
      router.refresh();
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-paper">
      <header className="border-b border-rule bg-surface px-5 py-3">
        <h1 className="page-title">{customer.name}</h1>
      </header>
      <div className="mb-8 grid max-w-3xl gap-4 px-5 py-5 md:grid-cols-2">
        {(
          [
            ["name", "Name", customer.name],
            ["address", "Address", customer.address ?? ""],
            ["contact_name", "Client name", customer.contact_name ?? ""],
            ["contact_email", "Client email", customer.contact_email ?? ""],
            ["contact_phone", "Client phone", customer.contact_phone ?? ""],
            ["spouse_name", "Spouse name", customer.spouse_name ?? ""],
          ] as const
        ).map(([field, label, value]) => (
          <div key={field} className="space-y-1.5">
            <Label className="label-caps text-ink-soft">{label}</Label>
            <Input
              defaultValue={value}
              className="rounded-none border-rule-strong"
              onBlur={(e) => {
                if (e.target.value !== value) saveField(field, e.target.value);
              }}
            />
          </div>
        ))}
        <div className="space-y-1.5 md:col-span-2">
          <Label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
            Notes
          </Label>
          <Textarea
            defaultValue={customer.notes ?? ""}
            className="rounded-[2px]"
            onBlur={(e) => {
              if (e.target.value !== (customer.notes ?? "")) {
                saveField("notes", e.target.value);
              }
            }}
          />
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between px-5">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink">
          Projects
        </h2>
        <Button
          variant="outline"
          className="rounded-[3px] text-redline"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await deleteCustomerAction(customer.id);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              router.push("/customers");
              router.refresh();
            });
          }}
        >
          Delete customer
        </Button>
      </div>

      {/* Margin, not padding — the box is bordered, so its edge has to sit at
          the same 5-unit inset as the text above rather than move inward. */}
      <div className="mx-5 mb-8 divide-y divide-rule border border-rule bg-surface">
        {projects.length === 0 && (
          <p className="p-4 text-[13px] text-ink-soft">No projects yet.</p>
        )}
        {projects.map((project) => {
          const current = project.phases.find(
            (p) => p.phase === project.current_phase,
          );
          const assignee = current?.assignee_id
            ? usersById.get(current.assignee_id)
            : null;
          return (
            <button
              key={project.id}
              type="button"
              className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-paper"
              onClick={() => setProjectId(project.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] text-ink-soft tabular-nums">
                  {project.project_number}
                </div>
                <div className="text-[15px] font-medium text-ink">
                  {project.name}
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mid">
                    {(() => {
                      const col = boardColumnOf(project);
                      return col
                        ? COLUMN_LABELS[col]
                        : project.status === "completed"
                          ? "Complete"
                          : "—";
                    })()}
                  </span>
                  {project.status === "active" && (
                    <PhaseRule
                      currentPhase={project.current_phase}
                      className="w-24"
                    />
                  )}
                </div>
              </div>
              <div className="font-mono text-[11px] tabular-nums text-ink-mid">
                {formatCardDate(project.target_completion)}
              </div>
              <div className="flex size-6 items-center justify-center rounded-full bg-ink font-mono text-[8px] text-surface">
                {assignee ? initials(assignee.name) : "—"}
              </div>
            </button>
          );
        })}
      </div>

      <ProjectDetailSheet
        project={selected}
        users={users}
        consultants={consultants}
        open={Boolean(selected)}
        onClose={() => setProjectId(null)}
      />
    </div>
  );
}
