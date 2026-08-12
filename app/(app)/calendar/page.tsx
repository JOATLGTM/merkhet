import { CalendarView } from "@/components/calendar/calendar-view";
import { listConsultants, listProjects, listUsers } from "@/lib/db/repo";

export default async function CalendarPage() {
  const [projects, users, consultants] = await Promise.all([
    listProjects(),
    listUsers(),
    listConsultants(),
  ]);
  const active = projects.filter((p) => p.status !== "completed");

  return (
    <CalendarView projects={active} users={users} consultants={consultants} />
  );
}
