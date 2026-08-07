import { CalendarView } from "@/components/calendar/calendar-view";
import { listProjects, listUsers } from "@/lib/db/repo";

export default async function CalendarPage() {
  const [projects, users] = await Promise.all([listProjects(), listUsers()]);
  const active = projects.filter((p) => p.status !== "completed");

  return <CalendarView projects={active} users={users} />;
}
