"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createCustomerAction } from "@/app/actions/customers";
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

/** Sentinel option that swaps the picker for the inline create form. */
const NEW_CUSTOMER = "__new__";

const labelClass = "font-mono text-[10px] uppercase tracking-[0.16em]";

export function NewProjectDialog({
  open,
  onOpenChange,
  customers,
}: NewProjectDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState(
    customers[0]?.id ?? NEW_CUSTOMER,
  );
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Inline customer fields, only used when customerId === NEW_CUSTOMER
  const [newName, setNewName] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");

  const creatingCustomer = customerId === NEW_CUSTOMER;

  /**
   * Base UI's <Select.Value> renders the raw selected value unless the Root
   * is given an items map — unlike Radix, it does not mirror the chosen
   * <SelectItem>'s children into the trigger.
   */
  const customerItems = useMemo(
    () => [
      ...customers.map((c) => ({ label: c.name, value: c.id })),
      { label: "+ New customer", value: NEW_CUSTOMER },
    ],
    [customers],
  );

  const resetCustomerFields = () => {
    setNewName("");
    setNewContactName("");
    setNewContactEmail("");
    setNewContactPhone("");
  };

  const submit = () => {
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    if (creatingCustomer && !newName.trim()) {
      setError("Customer name is required.");
      return;
    }
    if (!creatingCustomer && !customerId) {
      setError("Select a customer.");
      return;
    }
    const email = newContactEmail.trim();
    if (creatingCustomer && email && !email.includes("@")) {
      setError("Enter a valid contact email.");
      return;
    }

    startTransition(async () => {
      try {
        // Create the customer first so the project has something to reference.
        // createCustomerAction revalidates /customers, so the new record shows
        // up in the Customers tab without a manual reload.
        const targetCustomerId = creatingCustomer
          ? (
              await createCustomerAction({
                name: newName.trim(),
                contact_name: newContactName.trim() || null,
                contact_email: email || null,
                contact_phone: newContactPhone.trim() || null,
              })
            ).id
          : customerId;

        const project = await createProjectAction({
          name: name.trim(),
          customer_id: targetCustomerId,
          description: description.trim() || null,
          status: "backlog",
        });

        onOpenChange(false);
        setName("");
        setDescription("");
        setError(null);
        resetCustomerFields();
        setCustomerId(targetCustomerId);
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
            <Label className={labelClass}>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Customer</Label>
            <Select
              items={customerItems}
              value={customerId}
              onValueChange={(v) => {
                setCustomerId(v ?? "");
                setError(null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_CUSTOMER}>+ New customer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {creatingCustomer && (
            <div className="space-y-3 border border-rule bg-paper p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                New customer
              </p>
              <div className="space-y-2">
                <Label className={labelClass} htmlFor="np-customer-name">
                  Customer name
                </Label>
                <Input
                  id="np-customer-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Halcyon Development"
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass} htmlFor="np-contact-name">
                  Contact name
                </Label>
                <Input
                  id="np-contact-name"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass} htmlFor="np-contact-email">
                  Contact email
                </Label>
                <Input
                  id="np-contact-email"
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass} htmlFor="np-contact-phone">
                  Contact phone
                </Label>
                <Input
                  id="np-contact-phone"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className={labelClass}>Description</Label>
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
