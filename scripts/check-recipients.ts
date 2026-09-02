/**
 * Read-only verification for `20260901100000_phase_recipients.sql`.
 *
 * Confirms the swap landed — `project_phase_recipients` queryable,
 * `phase_subscribers` and `projects.client_contact_id` gone — then prints, per
 * live project and phase, who the internal mail would actually reach once the
 * project enters it: the assignee, the project's notify list, and leadership
 * where the routing table copies them. Reads only; writes nothing.
 *
 *   npx tsx scripts/check-recipients.ts
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

/** Mirrors `lib/email/plan.ts`: where leadership is copied on phase entry. */
const LEADERSHIP_PHASES = new Set(["review", "final_review", "permitting"]);
/** Phases that take a delegate and a notify list — `DELEGATED_PHASES`. */
const DELEGATED = [
  "schematic_design",
  "design_development",
  "construction_documents",
  "final_review",
  "permitting",
];
const ORDER = [
  "schematic_design",
  "design_development",
  "review",
  "construction_documents",
  "final_review",
  "permitting",
];

async function main() {
  let failures = 0;
  const fail = (msg: string) => {
    failures += 1;
    console.log(`FAIL ${msg}`);
  };

  // --- schema -------------------------------------------------------------
  // Round-trip selects, not head counts: a head count returns no error for a
  // table that does not exist (NEXT.md, 2026-08-21).
  const { error: newErr } = await admin
    .from("project_phase_recipients")
    .select("project_id, phase, user_id")
    .limit(1);
  if (newErr) {
    console.log(`FAIL project_phase_recipients is not queryable: ${newErr.message}`);
    console.log("\nThe migration has not been applied.");
    process.exit(1);
  }
  console.log("ok   project_phase_recipients exists");

  const { error: oldErr } = await admin
    .from("phase_subscribers")
    .select("phase")
    .limit(1);
  if (oldErr) console.log("ok   phase_subscribers is gone");
  else fail("phase_subscribers still exists — the migration did not drop it");

  const { error: colErr } = await admin
    .from("projects")
    .select("client_contact_id")
    .limit(1);
  if (colErr) console.log("ok   projects.client_contact_id is gone");
  else fail("projects.client_contact_id still exists");

  // --- the data ------------------------------------------------------------
  const { data: users } = await admin
    .from("users")
    .select("id, name, role, is_active")
    .order("name");
  const nameOf = new Map((users ?? []).map((u) => [u.id, u.name as string]));
  const activeOf = new Map((users ?? []).map((u) => [u.id, u.is_active as boolean]));
  const leadership = (users ?? [])
    .filter((u) => u.role === "admin" && u.is_active)
    .map((u) => u.name as string);

  const { data: projects } = await admin
    .from("projects")
    .select("id, project_number, name, status, current_phase, archived_at")
    .order("project_number");
  const live = (projects ?? []).filter(
    (p) => !p.archived_at && p.status !== "completed",
  );

  const { data: phases } = await admin
    .from("project_phases")
    .select("project_id, phase, assignee_id");
  const assigneeOf = new Map<string, string | null>();
  for (const row of phases ?? []) {
    assigneeOf.set(`${row.project_id}:${row.phase}`, (row.assignee_id as string) ?? null);
  }

  const { data: recipients } = await admin
    .from("project_phase_recipients")
    .select("project_id, phase, user_id");
  const recipientsOf = new Map<string, string[]>();
  for (const row of recipients ?? []) {
    const key = `${row.project_id}:${row.phase}`;
    const list = recipientsOf.get(key) ?? [];
    list.push(String(row.user_id));
    recipientsOf.set(key, list);
    if (!DELEGATED.includes(String(row.phase))) {
      fail(`${key} has a recipient on a phase that takes none`);
    }
    if (!nameOf.has(String(row.user_id))) {
      fail(`${key} names user ${row.user_id}, which does not exist`);
    }
  }

  console.log(
    `\n${live.length} live project(s), ${recipients?.length ?? 0} recipient row(s). ` +
      `Leadership: ${leadership.join(", ") || "(no active admins)"}\n`,
  );
  console.log("Internal mail on phase entry — who it would reach:\n");

  const rows: Record<string, string>[] = [];
  for (const p of live) {
    const pid = String(p.id);
    for (const phase of ORDER) {
      const key = `${pid}:${phase}`;
      const assigneeId = assigneeOf.get(key) ?? null;
      const ids = recipientsOf.get(key) ?? [];

      const reach = new Set<string>();
      if (assigneeId && activeOf.get(assigneeId)) reach.add(nameOf.get(assigneeId)!);
      if (LEADERSHIP_PHASES.has(phase)) for (const n of leadership) reach.add(n);
      for (const id of ids) {
        if (activeOf.get(id)) reach.add(nameOf.get(id)!);
      }

      const inactive = ids.filter((id) => nameOf.has(id) && !activeOf.get(id));

      rows.push({
        project: String(p.project_number),
        phase,
        assignee: assigneeId ? (nameOf.get(assigneeId) ?? "UNKNOWN") : "—",
        notify: ids.map((id) => nameOf.get(id) ?? "UNKNOWN").join(", ") || "—",
        reaches: [...reach].join(", ") || "NOBODY",
      });

      if (reach.size === 0 && phase !== "review") {
        console.log(
          `     ${p.project_number} ${phase}: no assignee and nobody to notify — the internal mail would be dropped`,
        );
      }
      if (inactive.length) {
        console.log(
          `     ${p.project_number} ${phase}: notify list includes deactivated ${inactive
            .map((id) => nameOf.get(id))
            .join(", ")} — skipped at send time`,
        );
      }
    }
  }

  console.table(rows);

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} failure(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
