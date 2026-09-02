"use client";

import { Bell } from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

type PhaseRecipientsPickerProps = {
  /** Who can be picked. Pass the active roster — a deactivated person cannot be added. */
  users: User[];
  /** Current `notify_ids` for the phase. */
  selected: string[];
  onChange: (next: string[]) => void;
  /**
   * The phase assignee, hidden from the list: they are always notified, so
   * offering them as an extra recipient would only invite a redundant tick.
   */
  assigneeId?: string | null;
  disabled?: boolean;
  /** For the accessible name — "Also notify — Schematic design". */
  phaseLabel: string;
  className?: string;
};

/**
 * Inline "also notify" list for one phase of one project. Deliberately not a
 * popover: it is rendered inside the Plan schedule dialog as well as the
 * sheet, and a portalled popup inside a modal dialog is exactly the kind of
 * focus-trap interaction that is hard to verify without a browser. A row that
 * expands in place has no such failure mode.
 */
export function PhaseRecipientsPicker({
  users,
  selected,
  onChange,
  assigneeId = null,
  disabled = false,
  phaseLabel,
  className,
}: PhaseRecipientsPickerProps) {
  const [open, setOpen] = useState(false);
  const options = users.filter((u) => u.id !== assigneeId);
  const chosen = options.filter((u) => selected.includes(u.id));

  const toggle = (userId: string, checked: boolean) => {
    // Preserve ids not in `options` (the assignee, or someone since
    // deactivated) — this control only speaks for the people it shows.
    const next = new Set(selected);
    if (checked) next.add(userId);
    else next.delete(userId);
    onChange([...next]);
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Also notify — ${phaseLabel}`}
        disabled={disabled}
        className={cn(
          "inline-flex h-7 max-w-full items-center gap-1.5 px-1 text-[12px] text-ink-mid hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
          open && "text-ink",
        )}
      >
        <Bell className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {chosen.length === 0 ? (
            <span className="text-ink-soft">Notify no one else</span>
          ) : (
            <>
              <span className="text-ink-soft">Also notify </span>
              {chosen.map((u) => u.name).join(", ")}
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="mt-1 border border-rule bg-paper px-2.5 py-2">
          {options.length === 0 ? (
            <p className="text-[12px] text-ink-soft">
              Nobody else to notify.
            </p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {options.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 text-[13px] text-ink"
                >
                  <Checkbox
                    checked={selected.includes(user.id)}
                    disabled={disabled}
                    onCheckedChange={(value) => toggle(user.id, Boolean(value))}
                  />
                  {user.name}
                </label>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-ink-soft">
            The assignee is always notified. These people are copied on top.
          </p>
        </div>
      )}
    </div>
  );
}
