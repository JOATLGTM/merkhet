import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavRail } from "@/components/shell/nav-rail";
import { getSessionUser } from "@/lib/auth/session";
import { listCustomers, listProjects } from "@/lib/db/repo";
import { redirect } from "next/navigation";

/** Cookie-authenticated shell — not instant-navigable without private cache. */
export const instant = false;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [projects, customers] = await Promise.all([
    listProjects(),
    listCustomers(),
  ]);

  return (
    <TooltipProvider>
      <div className="flex min-h-full flex-1 bg-paper">
        <NavRail
          user={user}
          projectCount={projects.length}
          customerCount={customers.length}
        />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
