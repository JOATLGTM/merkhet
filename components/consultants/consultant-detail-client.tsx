"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  deleteConsultantAction,
  updateConsultantAction,
} from "@/app/actions/consultants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Consultant } from "@/lib/types";

export function ConsultantDetailClient({
  consultant,
}: {
  consultant: Consultant;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const saveField = (
    field: "name" | "company" | "discipline" | "email" | "phone" | "notes",
    value: string,
  ) => {
    startTransition(async () => {
      await updateConsultantAction(consultant.id, {
        [field]: value === "" ? null : value,
      });
      router.refresh();
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-paper">
      <header className="border-b border-rule bg-surface px-5 py-3">
        <h1 className="page-title">{consultant.name}</h1>
        <p className="mt-1 text-[13px] text-ink-mid">
          External specialist — no login. Attach to projects from the project
          detail panel.
        </p>
      </header>

      <div className="mb-8 grid max-w-3xl gap-4 px-5 py-5 md:grid-cols-2">
        {(
          [
            ["name", "Name", consultant.name],
            ["discipline", "Discipline", consultant.discipline ?? ""],
            ["company", "Company", consultant.company ?? ""],
            ["email", "Email", consultant.email ?? ""],
            ["phone", "Phone", consultant.phone ?? ""],
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
          <Label className="label-caps text-ink-soft">Notes</Label>
          <Textarea
            defaultValue={consultant.notes ?? ""}
            className="rounded-[2px]"
            onBlur={(e) => {
              if (e.target.value !== (consultant.notes ?? "")) {
                saveField("notes", e.target.value);
              }
            }}
          />
        </div>
      </div>

      <div className="px-5 pb-8">
        <Button
          variant="outline"
          className="rounded-[3px] text-redline"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await deleteConsultantAction(consultant.id);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              router.push("/consultants");
              router.refresh();
            });
          }}
        >
          Delete consultant
        </Button>
      </div>
    </div>
  );
}
