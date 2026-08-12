"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = !mounted || resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "mb-2 h-8 w-full justify-start gap-2 rounded-none px-2 text-ink-mid hover:bg-sidebar-accent hover:text-ink",
        collapsed && "justify-center px-0",
      )}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0" />
      ) : (
        <Moon className="h-4 w-4 shrink-0" />
      )}
      {!collapsed && (
        <span className="text-[13px]">{isDark ? "Light mode" : "Dark mode"}</span>
      )}
    </Button>
  );
}
