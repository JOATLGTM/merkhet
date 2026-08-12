"use client";

import {
  Archive,
  Briefcase,
  CalendarRange,
  Columns3,
  PanelLeftClose,
  PanelLeftOpen,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials, type User } from "@/lib/types";

type NavRailProps = {
  user: User;
  projectCount: number;
  customerCount: number;
};

const links = [
  { href: "/", label: "Board", icon: Columns3 },
  { href: "/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/consultants", label: "Consultants", icon: Briefcase },
  { href: "/completed", label: "Completed projects", icon: Archive },
  { href: "/staff", label: "Staff", icon: UserCog, adminOnly: true },
];

export function NavRail({ user }: NavRailProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setCollapsed(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-rule bg-sidebar transition-[width] duration-200",
        collapsed ? "w-14" : "w-52",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center gap-2 border-b border-rule px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <span
          className="grid h-6 w-6 shrink-0 place-items-center bg-phase-5 text-[11px] font-bold text-paper"
          aria-hidden
        >
          M
        </span>
        {!collapsed && <span className="label-caps text-ink">Merkhet</span>}
      </div>

      <ul className="flex-1 space-y-0.5 p-2">
        {links.map((link) => {
          if (link.adminOnly && user.role !== "admin") return null;
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                title={link.label}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-surface font-medium text-ink shadow-[inset_2px_0_0_var(--phase-5)]"
                    : "text-ink-mid hover:bg-sidebar-accent hover:text-ink",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto border-t border-rule p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "mb-2 h-8 w-full justify-start gap-2 rounded-none px-2 text-ink-mid hover:bg-sidebar-accent hover:text-ink",
            collapsed && "justify-center px-0",
          )}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span className="text-[13px]">Collapse</span>
            </>
          )}
        </Button>

        <div
          className={cn(
            "mb-2 flex items-center gap-2.5 px-2 py-1",
            collapsed && "justify-center px-0",
          )}
        >
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-phase-5 font-mono text-[9px] font-medium text-paper">
            {initials(user.name)}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-ink">
                {user.name}
              </div>
              <div className="label-caps text-ink-soft">{user.role}</div>
            </div>
          )}
        </div>

        {!collapsed && (
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start rounded-none px-2 text-[13px] text-ink-mid hover:bg-sidebar-accent hover:text-redline"
            >
              Sign out
            </Button>
          </form>
        )}
      </div>
    </nav>
  );
}
