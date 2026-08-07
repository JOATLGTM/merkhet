"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  inviteUserAction,
  setActiveAction,
  setSubscribersAction,
  updateRoleAction,
} from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  DESIGN_PHASES,
  COLUMN_LABELS,
  initials,
  type DesignPhase,
  type PhaseSubscriber,
  type User,
  type UserRole,
} from "@/lib/types";

export function SettingsClient({
  users,
  subscribers,
}: {
  users: User[];
  subscribers: PhaseSubscriber[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"team" | "subscribers">("team");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-rule bg-surface px-5 py-3">
        <h1 className="page-title">Settings</h1>
        <div className="mt-3 flex gap-4">
          <button
            type="button"
            onClick={() => setTab("team")}
            className={cn(
              "pb-2 text-[13px]",
              tab === "team"
                ? "border-b-2 border-phase-5 font-medium text-ink"
                : "text-ink-mid hover:text-ink",
            )}
          >
            Team
          </button>
          <button
            type="button"
            onClick={() => setTab("subscribers")}
            className={cn(
              "pb-2 text-[13px]",
              tab === "subscribers"
                ? "border-b-2 border-phase-5 font-medium text-ink"
                : "text-ink-mid hover:text-ink",
            )}
          >
            Phase subscribers
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-paper px-5 py-5">
        {tab === "team" ? (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-rule hover:bg-transparent">
                  <TableHead className="label-caps h-9 text-ink-soft">
                    Name
                  </TableHead>
                  <TableHead className="label-caps h-9 text-ink-soft">
                    Email
                  </TableHead>
                  <TableHead className="label-caps h-9 text-ink-soft">
                    Role
                  </TableHead>
                  <TableHead className="label-caps h-9 text-ink-soft">
                    Active
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-rule">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-6 w-6 place-items-center rounded-full bg-phase-5 font-mono text-[9px] font-medium text-paper">
                          {initials(user.name)}
                        </div>
                        <span className="text-[14px] text-ink">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-ink-mid">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => {
                          startTransition(async () => {
                            await updateRoleAction(user.id, value as UserRole);
                            router.refresh();
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 w-28 rounded-none border-rule-strong">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={user.is_active}
                        disabled={pending}
                        onCheckedChange={(checked) => {
                          startTransition(async () => {
                            await setActiveAction(user.id, Boolean(checked));
                            router.refresh();
                          });
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-6 flex max-w-xl flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="label-caps text-ink-soft">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 w-44 rounded-none border-rule-strong"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="label-caps text-ink-soft">Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 w-56 rounded-none border-rule-strong"
                />
              </div>
              <Button
                className="h-9 rounded-none bg-phase-5 px-4 text-[13px] text-paper"
                disabled={pending || !name || !email}
                onClick={() => {
                  startTransition(async () => {
                    await inviteUserAction({ name, email, role: "staff" });
                    setName("");
                    setEmail("");
                    router.refresh();
                  });
                }}
              >
                Invite
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {DESIGN_PHASES.map((phase) => {
              const selected = new Set(
                subscribers
                  .filter((s) => s.phase === phase)
                  .map((s) => s.user_id),
              );
              return (
                <div key={phase} className="border border-rule bg-surface p-4">
                  <h3 className="label-caps text-ink">
                    {COLUMN_LABELS[phase]}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-4">
                    {users
                      .filter((u) => u.is_active)
                      .map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center gap-2 text-[13px] text-ink"
                        >
                          <Checkbox
                            checked={selected.has(user.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selected);
                              if (checked) next.add(user.id);
                              else next.delete(user.id);
                              startTransition(async () => {
                                await setSubscribersAction(phase as DesignPhase, [
                                  ...next,
                                ]);
                                router.refresh();
                              });
                            }}
                          />
                          {user.name}
                        </label>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
