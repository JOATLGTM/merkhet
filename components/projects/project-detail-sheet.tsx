"use client";

import Link from "next/link";
import { ArrowUpRight, CirclePause, ExternalLink, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getContractViewUrlAction,
  toggleHoldAction,
  updateAssigneeAction,
  updatePhaseDatesAction,
  updateProjectFieldAction,
  uploadContractAction,
} from "@/app/actions/projects";
import { PhaseRule } from "@/components/projects/phase-rule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatActivity } from "@/lib/activity";
import { formatFullDate } from "@/lib/dates";
import { COLUMN_LABELS, boardColumnOf } from "@/lib/types";
import type { DesignPhase, ProjectWithRelations, User } from "@/lib/types";
import { cn } from "@/lib/utils";

type ProjectDetailSheetProps = {
  project: ProjectWithRelations | null;
  users: User[];
  open: boolean;
  onClose: () => void;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="label-caps text-ink-soft">{children}</div>;
}

function InlineText({
  value,
  onSave,
  multiline,
  className,
  placeholder,
}: {
  value: string;
  onSave: (value: string) => Promise<void>;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  const save = async () => {
    if (local === value) return;
    await onSave(local);
  };

  if (multiline) {
    return (
      <Textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={save}
        placeholder={placeholder}
        className={cn(
          "min-h-[56px] resize-none rounded-none border-0 bg-transparent p-0 text-[14px] text-ink shadow-none focus-visible:ring-0",
          className,
        )}
      />
    );
  }

  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={save}
      placeholder={placeholder}
      className={cn(
        "h-auto rounded-none border-0 bg-transparent p-0 text-[14px] text-ink shadow-none focus-visible:ring-0",
        className,
      )}
    />
  );
}

export function ProjectDetailSheet({
  project,
  users,
  open,
  onClose,
}: ProjectDetailSheetProps) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usersById = new Map(users.map((u) => [u.id, u]));
  const assigneeItems = [
    { label: "Unassigned", value: "none" },
    ...users.map((u) => ({ label: u.name, value: u.id })),
  ];

  if (!project) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full data-[side=right]:sm:max-w-xl" />
      </Sheet>
    );
  }

  const column = boardColumnOf(project);
  const statusLabel = column
    ? COLUMN_LABELS[column]
    : project.status === "completed"
      ? "Complete"
      : "—";
  const isPending =
    project.status === "pending" || project.status === "backlog";

  const phaseFill =
    project.status === "completed"
      ? 5
      : project.current_phase
        ? undefined
        : project.status === "active"
          ? 0
          : -1;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      {/* The variant prefix has to match sheet.tsx's own
          `data-[side=right]:sm:max-w-sm`, or tailwind-merge keeps both classes
          and the more specific base rule wins — which is how this panel was
          rendering at --container-sm (384px) despite asking for 520px. */}
      <SheetContent className="w-full gap-0 overflow-y-auto border-l border-rule bg-surface p-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="space-y-0 border-b border-rule px-6 py-5 text-left">
          <SheetTitle className="sr-only">{project.name}</SheetTitle>
          <Input
            defaultValue={project.name}
            key={`${project.id}-name`}
            className="h-auto border-0 px-0 text-[22px] font-semibold leading-tight tracking-tight text-ink shadow-none focus-visible:ring-0"
            onBlur={(e) => {
              if (e.target.value !== project.name) {
                startTransition(async () => {
                  await updateProjectFieldAction(
                    project.id,
                    "name",
                    e.target.value,
                  );
                });
              }
            }}
          />
          <Link
            href={`/customers/${project.customer_id}`}
            className="mt-1.5 inline-flex items-center gap-1 text-[13px] text-ink-mid hover:text-ink"
          >
            {project.customer.name}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="label-caps border border-rule-strong px-2 py-1.5 text-ink-mid">
              {statusLabel}
            </span>
            <Button
              type="button"
              variant="outline"
              className="h-auto rounded-none border-rule-strong px-2.5 py-1.5 text-[13px] font-normal text-ink"
              onClick={() => {
                const next = !project.on_hold;
                const reason =
                  next && typeof window !== "undefined"
                    ? window.prompt("Reason (optional)") || null
                    : null;
                startTransition(async () => {
                  await toggleHoldAction(project.id, next, reason);
                  toast.success(next ? "On hold" : "Off hold");
                });
              }}
            >
              <CirclePause className="h-3.5 w-3.5 text-ink-mid" />
              {project.on_hold ? "Resume" : "Put on hold"}
            </Button>
          </div>

          <PhaseRule
            currentPhase={project.current_phase}
            filledThrough={phaseFill}
            className="mt-4"
          />
        </SheetHeader>

        <div className="px-6">
          {isPending && (
            <section className="border-b border-rule py-5">
              <FieldLabel>Contract / LOI</FieldLabel>
              <p className="mt-2 text-[13px] text-ink-mid">
                Upload a PDF to move this project to Active. Dragging out of
                Pending is blocked until then.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  startTransition(async () => {
                    try {
                      const fd = new FormData();
                      fd.set("projectId", project.id);
                      fd.set("file", file);
                      await uploadContractAction(fd);
                      toast.success("Contract uploaded — project is Active");
                      router.refresh();
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Upload failed.",
                      );
                    }
                  });
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-4 h-auto rounded-none border-rule-strong px-3 py-2 text-[13px] font-normal text-ink"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-3.5 w-3.5 text-ink-mid" />
                Upload PDF
              </Button>
            </section>
          )}

          {!isPending && project.contract_path && (
            <section className="border-b border-rule py-5">
              <FieldLabel>Contract / LOI</FieldLabel>
              <p className="mt-2 font-mono text-[12px] text-ink-mid">
                {project.contract_filename ?? "contract.pdf"}
                {project.contract_uploaded_at
                  ? ` · ${formatFullDate(project.contract_uploaded_at)}`
                  : null}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-auto rounded-none border-rule-strong px-3 py-2 text-[13px] font-normal text-ink"
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const { url } = await getContractViewUrlAction(
                        project.id,
                      );
                      window.open(url, "_blank", "noopener,noreferrer");
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Could not open contract.",
                      );
                    }
                  });
                }}
              >
                <ExternalLink className="h-3.5 w-3.5 text-ink-mid" />
                View PDF
              </Button>
            </section>
          )}

          <section className="border-b border-rule py-5">
            <FieldLabel>Details</FieldLabel>
            <div className="mt-4">
              <FieldLabel>Description</FieldLabel>
              <div className="mt-1.5">
                <InlineText
                  value={project.description ?? ""}
                  multiline
                  placeholder="Add a description…"
                  onSave={async (value) => {
                    await updateProjectFieldAction(
                      project.id,
                      "description",
                      value,
                    );
                  }}
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <FieldLabel>Start date</FieldLabel>
                <Input
                  type="date"
                  defaultValue={project.start_date ?? ""}
                  key={`${project.id}-start`}
                  className="mt-1.5 h-9 rounded-none border-rule-strong bg-paper font-mono text-[12px]"
                  onBlur={(e) => {
                    if (e.target.value !== (project.start_date ?? "")) {
                      startTransition(async () => {
                        await updateProjectFieldAction(
                          project.id,
                          "start_date",
                          e.target.value || null,
                        );
                      });
                    }
                  }}
                />
              </div>
              <div>
                <FieldLabel>Target completion</FieldLabel>
                <Input
                  type="date"
                  defaultValue={project.target_completion ?? ""}
                  key={`${project.id}-target`}
                  className="mt-1.5 h-9 rounded-none border-rule-strong bg-paper font-mono text-[12px]"
                  onBlur={(e) => {
                    if (e.target.value !== (project.target_completion ?? "")) {
                      startTransition(async () => {
                        await updateProjectFieldAction(
                          project.id,
                          "target_completion",
                          e.target.value || null,
                        );
                      });
                    }
                  }}
                />
              </div>
              <div className="col-span-2">
                <FieldLabel>Hours / week</FieldLabel>
                <Input
                  type="number"
                  defaultValue={
                    project.hours_per_week != null
                      ? String(project.hours_per_week)
                      : ""
                  }
                  key={`${project.id}-hours`}
                  placeholder="—"
                  className="mt-1.5 h-9 w-28 rounded-none border-rule-strong bg-paper font-mono text-[12px]"
                  onBlur={(e) => {
                    const next =
                      e.target.value === "" ? null : Number(e.target.value);
                    if (next !== project.hours_per_week) {
                      startTransition(async () => {
                        await updateProjectFieldAction(
                          project.id,
                          "hours_per_week",
                          next,
                        );
                      });
                    }
                  }}
                />
              </div>
            </div>
          </section>

          <section className="border-b border-rule py-5">
            <FieldLabel>Customer</FieldLabel>
            <dl className="mt-4 space-y-2.5 text-[13px]">
              <div className="grid grid-cols-[88px_1fr] gap-3">
                <dt className="text-ink-soft">Name</dt>
                <dd className="text-ink">{project.customer.name}</dd>
              </div>
              <div className="grid grid-cols-[88px_1fr] gap-3">
                <dt className="text-ink-soft">Contact</dt>
                <dd className="text-ink">
                  {project.customer.contact_name ?? "—"}
                </dd>
              </div>
              <div className="grid grid-cols-[88px_1fr] gap-3">
                <dt className="text-ink-soft">Email</dt>
                <dd className="font-mono text-[12px] text-ink">
                  {project.customer.contact_email ?? "—"}
                </dd>
              </div>
              <div className="grid grid-cols-[88px_1fr] gap-3">
                <dt className="text-ink-soft">Phone</dt>
                <dd className="font-mono text-[12px] text-ink">
                  {project.customer.contact_phone ?? "—"}
                </dd>
              </div>
            </dl>
            <Link
              href={`/customers/${project.customer_id}`}
              className="mt-4 inline-flex items-center gap-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-phase-5 hover:underline"
            >
              Full record
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </section>

          <section className="border-b border-rule py-5">
            <FieldLabel>Phases</FieldLabel>
            <div className="mt-4 space-y-4">
              {project.phases.map((phase) => (
                <div key={phase.id}>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 bg-ink-soft" />
                    <span className="flex-1 text-[14px] text-ink">
                      {COLUMN_LABELS[phase.phase]}
                    </span>
                    <span className="label-caps text-ink-soft">
                      {phase.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_1fr_1fr] gap-2 pl-3.5">
                    <Select
                      // Base UI renders the raw value in the trigger without
                      // an items map — this showed user ids, not names.
                      items={assigneeItems}
                      value={phase.assignee_id ?? "none"}
                      onValueChange={(value) => {
                        startTransition(async () => {
                          await updateAssigneeAction(
                            project.id,
                            phase.phase as DesignPhase,
                            value === "none" ? null : value,
                          );
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 rounded-none border-rule-strong text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      defaultValue={phase.planned_start ?? ""}
                      className="h-9 rounded-none border-rule-strong font-mono text-[11px]"
                      onBlur={(e) => {
                        startTransition(async () => {
                          await updatePhaseDatesAction(
                            project.id,
                            phase.phase,
                            e.target.value || null,
                            phase.planned_end,
                          );
                        });
                      }}
                    />
                    <Input
                      type="date"
                      defaultValue={phase.planned_end ?? ""}
                      className="h-9 rounded-none border-rule-strong font-mono text-[11px]"
                      onBlur={(e) => {
                        startTransition(async () => {
                          await updatePhaseDatesAction(
                            project.id,
                            phase.phase,
                            phase.planned_start,
                            e.target.value || null,
                          );
                        });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="py-5">
            <FieldLabel>Activity</FieldLabel>
            <div className="mt-4 space-y-3">
              {project.activity.length === 0 && (
                <p className="text-[13px] text-ink-soft">No activity yet.</p>
              )}
              {project.activity.map((event) => (
                <div key={event.id} className="flex gap-3 text-[13px]">
                  <span className="w-24 shrink-0 font-mono text-[11px] text-ink-soft tabular-nums">
                    {formatFullDate(event.created_at)}
                  </span>
                  <p className="text-ink-mid">
                    {formatActivity(event, usersById)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
