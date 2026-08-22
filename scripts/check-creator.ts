/**
 * Read-only verification for `20260822100000_project_created_by.sql`.
 *
 * Confirms the column landed, the activity-log backfill filled it, and that
 * every board project now resolves to something the card can render — either
 * a current-phase assignee or a creator. Reads only; writes nothing.
 *
 *   npx tsx scripts/check-creator.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import WebSocket from "ws";

config({ path: ".env.local" });
config({ path: ".env" });

const url =
  process.env.NEXT_PUBLIC_SUPABASE_MERKET_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_MERKET_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Need Supabase URL + service role key in .env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false },
  // Node 20: supabase-js realtime expects a global WebSocket (Node 22+).
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
});

async function main() {
  let failures = 0;
  const fail = (msg: string) => {
    failures += 1;
    console.log(`FAIL ${msg}`);
  };

  // --- column exists -------------------------------------------------------
  const { error: colErr } = await admin
    .from("projects")
    .select("id, created_by")
    .limit(1);
  if (colErr) {
    console.log(`FAIL projects.created_by is not queryable: ${colErr.message}`);
    console.log("\nThe migration has not been applied.");
    process.exit(1);
  }
  console.log("ok   projects.created_by exists");

  // --- the data ------------------------------------------------------------
  const { data: users } = await admin
    .from("users")
    .select("id, name, is_active")
    .order("name");
  const nameOf = new Map((users ?? []).map((u) => [u.id, u.name as string]));
  const activeOf = new Map((users ?? []).map((u) => [u.id, u.is_active as boolean]));

  const { data: projects } = await admin
    .from("projects")
    .select("id, project_number, name, status, current_phase, created_by, archived_at")
    .order("project_number");

  const { data: phases } = await admin
    .from("project_phases")
    .select("project_id, phase, assignee_id");

  const { data: created } = await admin
    .from("activity_log")
    .select("project_id, actor_id, created_at")
    .eq("event_type", "project.created")
    .order("created_at", { ascending: true });

  const firstActor = new Map<string, string>();
  for (const row of created ?? []) {
    const pid = String(row.project_id);
    if (!firstActor.has(pid) && row.actor_id) firstActor.set(pid, String(row.actor_id));
  }

  const assigneeOf = new Map<string, string | null>();
  for (const row of phases ?? []) {
    assigneeOf.set(`${row.project_id}:${row.phase}`, (row.assignee_id as string) ?? null);
  }

  const onBoard = (p: { status: string; archived_at: string | null }) =>
    !p.archived_at && p.status !== "completed";

  console.log("\nBoard cards — what the avatar will render:\n");
  const rows: Record<string, string>[] = [];

  for (const p of projects ?? []) {
    const pid = String(p.id);
    const assigneeId = p.current_phase
      ? assigneeOf.get(`${pid}:${p.current_phase}`)
      : null;
    const creatorId = (p.created_by as string) ?? null;

    // Backfill fidelity: created_by must match the earliest project.created row.
    const expected = firstActor.get(pid);
    if (expected && creatorId !== expected) {
      fail(
        `${p.project_number} created_by ${creatorId ?? "null"} ≠ activity log ${expected}`,
      );
    }
    if (!expected && !creatorId) {
      console.log(`     ${p.project_number} has no create event and no creator — will show —`);
    }

    const source = assigneeId ? "assignee" : creatorId ? "creator" : "none";
    const personId = assigneeId ?? creatorId;
    const personName = personId ? (nameOf.get(personId) ?? "UNKNOWN USER") : null;

    // The still-open listUsers(activeOnly) gap: the board's map holds active
    // staff only, so a deactivated person renders — despite the data being fine.
    const hidden = personId != null && activeOf.get(personId) === false;

    rows.push({
      project: String(p.project_number),
      column: p.archived_at || p.status === "completed"
        ? "(off board)"
        : String(p.current_phase ?? p.status),
      source,
      renders: hidden ? "— (deactivated)" : (personName ?? "—"),
    });

    if (onBoard(p as never) && source === "none") {
      fail(`${p.project_number} is on the board and still renders —`);
    }
    if (hidden) {
      fail(`${p.project_number} resolves to ${personName}, who is deactivated → renders —`);
    }
    if (personId && !nameOf.has(personId)) {
      fail(`${p.project_number} points at user ${personId}, which does not exist`);
    }
  }

  console.table(rows);

  const boardProjects = (projects ?? []).filter((p) => onBoard(p as never));
  const withCreator = (projects ?? []).filter((p) => p.created_by).length;
  console.log(
    `\n${withCreator}/${(projects ?? []).length} projects have a creator; ` +
      `${boardProjects.length} are on the board.`,
  );

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} failure(s).`);
  process.exit(failures === 0 ? 0 : 1);

}

main();
