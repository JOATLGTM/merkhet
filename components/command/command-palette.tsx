"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { moveProjectAction, toggleHoldAction } from "@/app/actions/projects";
import { pushBoardProject } from "@/lib/board-url";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { BOARD_COLUMNS, COLUMN_LABELS, type Customer, type ProjectWithRelations } from "@/lib/types";

type CommandPaletteProps = {
  projects: ProjectWithRelations[];
  customers: Customer[];
};

export function CommandPalette({ projects, customers }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setMoveFor(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="Search projects, customers, actions…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {!moveFor && (
            <>
              <CommandGroup heading="Projects">
                {projects.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.project_number} ${p.name} ${p.customer.name}`}
                    onSelect={() => {
                      setOpen(false);
                      pushBoardProject(window.location.search, p.id);
                    }}
                  >
                    <span className="font-mono text-[11px] text-ink-soft">
                      {p.project_number}
                    </span>
                    <span>{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Customers">
                {customers.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => {
                      setOpen(false);
                      router.push(`/customers/${c.id}`);
                    }}
                  >
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    router.push("/customers?new=1");
                  }}
                >
                  Create customer
                </CommandItem>
                {projects.slice(0, 8).map((p) => (
                  <CommandItem
                    key={`move-${p.id}`}
                    value={`move ${p.name}`}
                    onSelect={() => setMoveFor(p.id)}
                  >
                    Move {p.name} to phase…
                  </CommandItem>
                ))}
                {projects
                  .filter((p) => !p.on_hold)
                  .slice(0, 5)
                  .map((p) => (
                    <CommandItem
                      key={`hold-${p.id}`}
                      value={`hold ${p.name}`}
                      onSelect={() => {
                        startTransition(async () => {
                          await toggleHoldAction(p.id, true, "From command palette");
                          setOpen(false);
                        });
                      }}
                    >
                      Put {p.name} on hold
                    </CommandItem>
                  ))}
              </CommandGroup>
            </>
          )}
          {moveFor && (
            <CommandGroup heading="Move to">
              {BOARD_COLUMNS.map((column) => (
                <CommandItem
                  key={column}
                  onSelect={() => {
                    startTransition(async () => {
                      try {
                        await moveProjectAction(moveFor, column);
                        setOpen(false);
                        setMoveFor(null);
                        // The action's revalidatePath("/") already streams the
                        // moved board back, so this only has to open the sheet.
                        pushBoardProject(window.location.search, moveFor);
                      } catch (e) {
                        toast.error(
                          e instanceof Error
                            ? e.message
                            : "Could not move project.",
                        );
                      }
                    });
                  }}
                >
                  {COLUMN_LABELS[column]}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
