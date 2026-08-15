/**
 * Slice 1A seed — ports demo-store into hosted Supabase.
 *
 * Prerequisites:
 * 1. Both migrations applied (init + move_project)
 * 2. SUPABASE_SERVICE_MERKET_ROLE_KEY set in `.env` / `.env.local`
 *
 *   npm run seed
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import WebSocket from "ws";

import { getDemoSeedData } from "../lib/db/demo-store";

config({ path: ".env.local" });
config({ path: ".env" });

const url =
  process.env.NEXT_PUBLIC_SUPABASE_MERKET_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_MERKET_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = "password";

if (!url || !serviceKey) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_MERKET_URL and SUPABASE_SERVICE_MERKET_ROLE_KEY in .env",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  // Node 20: supabase-js realtime expects a global WebSocket (Node 22+).
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
});

function remapPayload(
  payload: Record<string, unknown>,
  userMap: Map<string, string>,
) {
  const next = { ...payload };
  for (const key of ["from_user_id", "to_user_id", "actor_id"]) {
    const value = next[key];
    if (typeof value === "string" && userMap.has(value)) {
      next[key] = userMap.get(value);
    }
  }
  return next;
}

async function ensureAuthUser(input: {
  email: string;
  name: string;
  role: string;
}) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw listError;

  const existing = listed.users.find(
    (u) => u.email?.toLowerCase() === input.email.toLowerCase(),
  );
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { name: input.name, role: input.role },
    });
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { name: input.name, role: input.role },
  });
  if (error) throw error;
  if (!data.user) throw new Error(`No user returned for ${input.email}`);
  return data.user.id;
}

async function main() {
  const seed = getDemoSeedData();
  const userMap = new Map<string, string>();
  const customerMap = new Map<string, string>();
  const projectMap = new Map<string, string>();

  console.log("Creating auth users…");
  for (const user of seed.users) {
    const realId = await ensureAuthUser({
      email: user.email,
      name: user.name,
      role: user.role,
    });
    userMap.set(user.id, realId);
    const { error } = await admin.from("users").upsert({
      id: realId,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
    });
    if (error) throw error;
    console.log(`  ${user.email}`);
  }

  console.log("Clearing prior demo rows…");
  // project_phases has no created_at — clear via project cascade after activity/subscribers.
  for (const phase of [
    "schematic_design",
    "design_development",
    "review",
    "construction_documents",
    "final_review",
    "permitting",
  ] as const) {
    const { error } = await admin
      .from("phase_subscribers")
      .delete()
      .eq("phase", phase);
    if (error) throw error;
  }
  {
    const { error } = await admin
      .from("activity_log")
      .delete()
      .gte("created_at", "1970-01-01");
    if (error) throw error;
  }
  {
    const { error } = await admin
      .from("projects")
      .delete()
      .gte("created_at", "1970-01-01");
    if (error) throw error;
  }
  {
    const { error } = await admin
      .from("customers")
      .delete()
      .gte("created_at", "1970-01-01");
    if (error) throw error;
  }

  console.log("Inserting customers…");
  for (const c of seed.customers) {
    const id = crypto.randomUUID();
    customerMap.set(c.id, id);
    const { error } = await admin.from("customers").insert({
      id,
      name: c.name,
      contact_name: c.contact_name,
      contact_email: c.contact_email,
      contact_phone: c.contact_phone,
      spouse_name: c.spouse_name,
      notes: c.notes,
      created_at: c.created_at,
      updated_at: c.updated_at,
    });
    if (error) throw error;
  }

  console.log("Inserting projects…");
  for (const project of seed.projects) {
    const id = crypto.randomUUID();
    projectMap.set(project.id, id);
    const customer_id = customerMap.get(project.customer_id);
    if (!customer_id) throw new Error(`Missing customer for ${project.name}`);

    const { error } = await admin.from("projects").insert({
      id,
      customer_id,
      project_number: project.project_number,
      name: project.name,
      description: project.description,
      status: project.status === "backlog" ? "pending" : project.status,
      current_phase: project.current_phase,
      on_hold: project.on_hold,
      on_hold_since: project.on_hold_since,
      on_hold_reason: project.on_hold_reason,
      start_date: project.start_date,
      target_completion: project.target_completion,
      client_desired_completion: project.client_desired_completion,
      project_budget: project.project_budget,
      design_budget: project.design_budget,
      client_contact_id: project.client_contact_id
        ? userMap.get(project.client_contact_id) ?? null
        : null,
      hours_per_week: project.hours_per_week,
      archived_at: project.archived_at,
      contract_path: project.contract_path,
      contract_filename: project.contract_filename,
      contract_uploaded_at: project.contract_uploaded_at,
      created_at: project.created_at,
      updated_at: project.updated_at,
    });
    if (error) throw error;

    // Trigger already inserted blank phase rows — overwrite to match seed.
    const desired = seed.phases.filter((p) => p.project_id === project.id);
    for (const phase of desired) {
      const { error: phaseError } = await admin
        .from("project_phases")
        .update({
          assignee_id: phase.assignee_id
            ? (userMap.get(phase.assignee_id) ?? null)
            : null,
          status: phase.status,
          planned_start: phase.planned_start,
          planned_end: phase.planned_end,
          duration_days: phase.duration_days,
          planned_hours: phase.planned_hours,
          entered_at: phase.entered_at,
          completed_at: phase.completed_at,
          sort_order: phase.sort_order,
        })
        .eq("project_id", id)
        .eq("phase", phase.phase);
      if (phaseError) throw phaseError;
    }
  }

  console.log("Inserting activity…");
  if (seed.activity.length) {
    const { error } = await admin.from("activity_log").insert(
      seed.activity.map((a) => {
        const project_id = projectMap.get(a.project_id);
        if (!project_id) throw new Error(`Missing project for activity ${a.id}`);
        return {
          id: crypto.randomUUID(),
          project_id,
          actor_id: a.actor_id ? (userMap.get(a.actor_id) ?? null) : null,
          event_type: a.event_type,
          payload: remapPayload(a.payload, userMap),
          created_at: a.created_at,
        };
      }),
    );
    if (error) throw error;
  }

  console.log("Inserting phase subscribers…");
  if (seed.subscribers.length) {
    const { error } = await admin.from("phase_subscribers").insert(
      seed.subscribers.map((s) => ({
        phase: s.phase,
        user_id: userMap.get(s.user_id)!,
        created_at: s.created_at,
      })),
    );
    if (error) throw error;
  }

  const maxNum = Math.max(
    ...seed.projects.map((p) => Number(p.project_number.replace("MK-", ""))),
  );
  console.log(
    `\nSeeded ${seed.projects.length} projects. In SQL Editor run:\n  select setval('public.project_number_seq', ${maxNum});\n`,
  );
  console.log("Login: chris@merkhet.studio / password");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
