"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteUserAction,
  inviteUserAction,
  setActiveAction,
  setSubscribersAction,
  updateRoleAction,
} from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  WorkloadCell,
  WorkloadDetail,
  WorkloadSummary,
  WorkloadToggle,
} from "@/components/settings/staff-workload";
import { cn } from "@/lib/utils";
import type { Week, WorkloadPerson } from "@/lib/workload";
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
  workload,
  week,
  currentUserId,
}: {
  users: User[];
  subscribers: PhaseSubscriber[];
  workload: WorkloadPerson[];
  week: Week;
  /** Whose session this is — the one row that cannot offer a delete button. */
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"team" | "subscribers">("team");
  // Several people can be open at once — comparing two rows is the point.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const workloadBy = new Map(workload.map((person) => [person.userId, person]));

  const toggle = (userId: string) =>
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(userId)) next.add(userId);
      return next;
    });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Holds the row being confirmed, not a boolean — the dialog needs the person
  // to name them and to count what deleting them costs.
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const deleteImpact = pendingDelete
    ? (workloadBy.get(pendingDelete.id)?.rows.length ?? 0)
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-rule bg-surface px-5 py-3">
        <h1 className="page-title">Staff</h1>
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
            <WorkloadSummary people={workload} week={week} />

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
                    This week
                  </TableHead>
                  <TableHead className="label-caps h-9 text-ink-soft">
                    Role
                  </TableHead>
                  <TableHead className="label-caps h-9 text-ink-soft">
                    Active
                  </TableHead>
                  <TableHead className="label-caps h-9 w-10 text-ink-soft">
                    <span className="sr-only">Delete</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const person = workloadBy.get(user.id);
                  const open = expanded.has(user.id);
                  return (
                  <Fragment key={user.id}>
                  <TableRow className="border-rule">
                    <TableCell>
                      <WorkloadToggle
                        expanded={open}
                        disabled={!person || person.rows.length === 0}
                        onToggle={() => toggle(user.id)}
                      >
                        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-phase-5 font-mono text-[9px] font-medium text-paper">
                          {initials(user.name)}
                        </div>
                        <span className="text-[14px] text-ink">{user.name}</span>
                      </WorkloadToggle>
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-ink-mid">
                      {user.email}
                    </TableCell>
                    <TableCell className="align-top">
                      <WorkloadCell person={person} />
                    </TableCell>
                    <TableCell>
                      <Select
                        // Base UI renders the raw value in the trigger
                        // without an items map — this showed "admin"/"staff".
                        items={{ admin: "Admin", staff: "Staff" }}
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
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-[3px] text-ink-soft hover:text-redline"
                        // Deleting yourself would end the session mid-request,
                        // so the server refuses it too — this only keeps the
                        // admin from finding that out by clicking.
                        disabled={pending || user.id === currentUserId}
                        title={
                          user.id === currentUserId
                            ? "You cannot delete your own account"
                            : `Delete ${user.name}`
                        }
                        onClick={() => setPendingDelete(user)}
                      >
                        <Trash2 />
                        <span className="sr-only">Delete {user.name}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                  {open && person && (
                    <TableRow className="border-rule hover:bg-transparent">
                      <TableCell colSpan={6} className="p-0">
                        <WorkloadDetail person={person} />
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                  );
                })}
              </TableBody>
            </Table>

            <p className="mt-8 text-[13px] text-ink-mid">
              Inviting emails a one-time link. They pick their own password on
              arrival; the account is active from that point.
            </p>
            <div className="mt-3 flex max-w-xl flex-wrap items-end gap-3">
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
                    const result = await inviteUserAction({
                      name,
                      email: email.trim(),
                      role: "staff",
                    });
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success(`Invite sent to ${email.trim()}`);
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

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px]">
              Delete {pendingDelete?.name}?
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Removes the login as well as the profile. There is no undo, and
              the account cannot be restored by re-inviting — that creates a new
              one.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-1.5 text-[13px] text-ink-mid">
            <li>
              <span className="font-mono tabular-nums text-ink">
                {deleteImpact}
              </span>{" "}
              in-progress {deleteImpact === 1 ? "phase" : "phases"} lose their
              assignee. The work stays where it is.
            </li>
            <li>
              Their activity history is kept but stops carrying their name.
            </li>
            <li>Phase subscriptions are removed.</li>
            <li>
              <span className="font-mono text-[12px] text-ink">
                {pendingDelete?.email}
              </span>{" "}
              becomes free to invite again.
            </li>
          </ul>

          <p className="border-t border-rule pt-3 text-[12px] text-ink-soft">
            To stop someone signing in without losing any of that, untick
            Active instead — that is the reversible one.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-none text-redline"
              disabled={pending}
              onClick={() => {
                const target = pendingDelete;
                if (!target) return;
                startTransition(async () => {
                  const result = await deleteUserAction(target.id);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(`${target.name} deleted`);
                  setPendingDelete(null);
                  router.refresh();
                });
              }}
            >
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
