"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  clearProjectContactAction,
  updateProjectFieldAction,
} from "@/app/actions/projects";
import { unwrap } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  CONTACT_LABELS,
  PROJECT_CONTACT_COLUMN,
  overriddenCount,
  resolveContact,
  type ContactField,
} from "@/lib/contact";
import { cn } from "@/lib/utils";
import type { ProjectWithRelations } from "@/lib/types";

/**
 * Project address and contact, in the detail sheet's Details section.
 *
 * A project usually sits at the customer's own address, so that is the default
 * and its own details are opt-in. Null on a field means "same as the
 * customer", resolved per field (`lib/contact.ts`), which is why unticking is
 * not a flag write and why a half-filled override still falls back for the
 * rest.
 *
 * "Same as customer" is therefore derived from the four columns rather than
 * stored, and cannot disagree with them. The one thing local state has to
 * carry is a project that has been *opened* for editing but not yet typed
 * into — keyed by project id, because this sheet swaps projects without
 * remounting.
 */
export function ProjectContactFields({
  project,
}: {
  project: ProjectWithRelations;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const customer = project.customer;
  const resolved = resolveContact(project, customer);
  const stored = overriddenCount(project, customer);
  const overriding = stored > 0 || openedFor === project.id;

  const save = (field: ContactField, value: string) => {
    const column = PROJECT_CONTACT_COLUMN[field];
    const next = value.trim() || null;
    if (next === (project[column] ?? null)) return;
    startTransition(async () => {
      try {
        unwrap(await updateProjectFieldAction(project.id, column, next));
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not save the change.",
        );
      }
    });
  };

  const clear = () => {
    startTransition(async () => {
      try {
        unwrap(await clearProjectContactAction(project.id));
        setOpenedFor(null);
        setConfirmingClear(false);
        toast.success("Back on the customer's address and contact");
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not clear the details.",
        );
      }
    });
  };

  const toggle = (checked: boolean) => {
    if (!checked) {
      setOpenedFor(project.id);
      return;
    }
    // Nothing typed yet — just fold the form away, no write needed.
    if (stored === 0) {
      setOpenedFor(null);
      return;
    }
    setConfirmingClear(true);
  };

  return (
    <div className="mt-5">
      <label className="flex items-start gap-2.5">
        <Checkbox
          className="mt-0.5"
          checked={!overriding}
          disabled={pending}
          onCheckedChange={(checked) => toggle(Boolean(checked))}
        />
        <span>
          <span className="block text-[13px] text-ink">
            Same address and contact as {customer.name}
          </span>
          <span className="mt-0.5 block text-[12px] text-ink-soft">
            {overriding
              ? "Anything left blank still uses the customer's."
              : "Untick to give this project its own."}
          </span>
        </span>
      </label>

      {confirmingClear && (
        <div className="mt-3 border border-redline bg-paper px-3 py-2.5">
          <p className="text-[13px] text-ink">
            Discard this project&rsquo;s own{" "}
            {stored === 1 ? "detail" : `${stored} details`} and use{" "}
            {customer.name}&rsquo;s?
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto rounded-none border-redline px-2.5 py-1 text-[12px] font-normal text-redline"
              disabled={pending}
              onClick={clear}
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-auto rounded-none px-2.5 py-1 text-[12px] font-normal text-ink-mid"
              disabled={pending}
              onClick={() => setConfirmingClear(false)}
            >
              Keep them
            </Button>
          </div>
        </div>
      )}

      <dl className="mt-3 space-y-2.5 text-[13px]">
        {resolved.map((row) => (
          <div
            key={row.field}
            className="grid grid-cols-[88px_1fr] items-baseline gap-3"
          >
            <dt className="text-ink-soft">{CONTACT_LABELS[row.field]}</dt>
            <dd>
              {overriding ? (
                <>
                  <Input
                    // Remount when the project or the stored value changes,
                    // so the field never shows the previous project's text.
                    key={`${project.id}-${row.field}-${project[PROJECT_CONTACT_COLUMN[row.field]] ?? ""}`}
                    defaultValue={
                      project[PROJECT_CONTACT_COLUMN[row.field]] ?? ""
                    }
                    placeholder={row.inherited ?? "—"}
                    disabled={pending}
                    className="h-8 rounded-none border-rule-strong bg-paper text-[13px]"
                    onBlur={(e) => save(row.field, e.target.value)}
                  />
                  {!row.overridden && row.inherited && (
                    <p className="mt-1 text-[11px] text-ink-soft">
                      Using {customer.name}&rsquo;s
                    </p>
                  )}
                </>
              ) : (
                <span
                  className={cn(
                    "text-ink",
                    row.field !== "address" &&
                      row.field !== "contact_name" &&
                      "font-mono text-[12px]",
                    !row.value && "text-ink-soft",
                  )}
                >
                  {row.value ?? "—"}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
