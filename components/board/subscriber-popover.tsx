"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { setSubscribersAction } from "@/app/actions/settings";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  initials,
  type DesignPhase,
  type PhaseSubscriber,
  type User,
} from "@/lib/types";

type SubscriberPopoverProps = {
  phase: DesignPhase;
  subscribers: PhaseSubscriber[];
  users: User[];
  canEdit: boolean;
};

export function SubscriberPopover({
  phase,
  subscribers,
  users,
  canEdit,
}: SubscriberPopoverProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const selected = new Set(subscribers.map((s) => s.user_id));

  const toggle = (userId: string, checked: boolean) => {
    if (!canEdit) return;
    const next = new Set(selected);
    if (checked) next.add(userId);
    else next.delete(userId);
    startTransition(async () => {
      await setSubscribersAction(phase, [...next]);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex h-7 items-center gap-1 rounded-sm px-1 hover:bg-paper"
        disabled={pending}
      >
        <div className="flex -space-x-1.5">
          {subscribers.slice(0, 3).map((s) => {
            const user = users.find((u) => u.id === s.user_id);
            return (
              <Avatar key={s.user_id} className="size-5 border border-surface">
                <AvatarFallback className="bg-rule font-mono text-[7px]">
                  {user ? initials(user.name) : "?"}
                </AvatarFallback>
              </Avatar>
            );
          })}
          {subscribers.length === 0 && (
            <span className="flex size-5 items-center justify-center rounded-full border border-dashed border-rule-strong text-ink-soft">
              <Plus className="size-3" />
            </span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
          Phase subscribers
        </p>
        <div className="flex flex-col gap-2">
          {users.map((user) => (
            <label
              key={user.id}
              className="flex items-center gap-2 text-[13px] text-ink"
            >
              <Checkbox
                checked={selected.has(user.id)}
                disabled={!canEdit}
                onCheckedChange={(value) => toggle(user.id, Boolean(value))}
              />
              {user.name}
            </label>
          ))}
        </div>
        {!canEdit && (
          <p className="mt-2 text-[11px] text-ink-soft">Admin only to edit.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
