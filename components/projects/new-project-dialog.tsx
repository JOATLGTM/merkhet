"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createProjectAction } from "@/app/actions/projects";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/lib/types";

type NewProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
};

export function NewProjectDialog({
  open,
  onOpenChange,
  customers,
}: NewProjectDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim() || !customerId) {
      setError("Name and customer are required.");
      return;
    }
    startTransition(async () => {
      try {
        const project = await createProjectAction({
          name: name.trim(),
          customer_id: customerId,
          description: description.trim() || null,
          status: "backlog",
        });
        onOpenChange(false);
        setName("");
        setDescription("");
        setError(null);
        router.push(`/?project=${project.id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create project");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.16em]">
              Name
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.16em]">
              Customer
            </Label>
            <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.16em]">
              Description
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          {error && <p className="text-[13px] text-redline">{error}</p>}
          <Button
            onClick={submit}
            disabled={pending}
            className="rounded-[3px] bg-ink text-surface"
          >
            {pending ? "Creating…" : "Create project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
