/**
 * Slice 5 verification against hosted Supabase.
 *
 * Creates ONE throwaway project, drives it through every gate scenario in
 * SLICE_5_APPLY.md, then deletes it (cascade) in a finally block. Touches no
 * existing project.
 *
 * Signs in as a real user with the anon key rather than using the service role,
 * because move_project / reject_gate are `security invoker` and granted to
 * `authenticated` — service_role is not a member of that role.
 */
import { format, isWeekend, nextMonday, parseISO } from "date-fns";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import WebSocket from "ws";

import { deriveSchedule } from "../lib/dates";
import { DESIGN_PHASES, type DesignPhase } from "../lib/types";

config({ path: ".env.local" });
config({ path: ".env" });

const url =
  process.env.NEXT_PUBLIC_SUPABASE_MERKET_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_MERKET_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const sb = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
});

let failures = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    failures += 1;
    console.log(`FAIL ${label}\n  got  ${g}\n  want ${w}`);
  } else {
    console.log(`ok   ${label}`);
  }
};

/** Asserts move_project raises, and that the message is the expected one. */
async function blocked(label: string, projectId: string, to: string, needle: string) {
  const { error } = await sb.rpc("move_project", {
    p_project_id: projectId,
    p_to_column: to,
    p_actor_id: actorId,
  });
  if (!error) {
    failures += 1;
    console.log(`FAIL ${label}\n  got  move succeeded\n  want blocked`);
    return;
  }
  if (!error.message.includes(needle)) {
    failures += 1;
    console.log(`FAIL ${label}\n  got  ${error.message}\n  want message containing "${needle}"`);
    return;
  }
  console.log(`ok   ${label}`);
}

async function allowed(label: string, projectId: string, to: string) {
  const { error } = await sb.rpc("move_project", {
    p_project_id: projectId,
    p_to_column: to,
    p_actor_id: actorId,
  });
  if (error) {
    failures += 1;
    console.log(`FAIL ${label}\n  got  ${error.message}\n  want move to succeed`);
    return;
  }
  console.log(`ok   ${label}`);
}

const phases = async (projectId: string) => {
  const { data } = await sb
    .from("project_phases")
    .select("phase, status, planned_start, planned_end, duration_days")
    .eq("project_id", projectId);
  return new Map((data ?? []).map((r) => [r.phase as DesignPhase, r]));
};

const currentPhase = async (projectId: string) => {
  const { data } = await sb
    .from("projects")
    .select("current_phase, status")
    .eq("id", projectId)
    .single();
  return data;
};

const approvalsOf = async (projectId: string, phase: string) => {
  const { data } = await sb
    .from("project_approvals")
    .select("party, status")
    .eq("project_id", projectId)
    .eq("phase", phase);
  return (data ?? []).map((r) => r.party).sort();
};

async function approve(projectId: string, phase: string, party: string) {
  const { error } = await sb.from("project_approvals").upsert(
    {
      project_id: projectId,
      phase,
      party,
      status: "approved",
      approved_at: new Date().toISOString(),
      recorded_by: actorId,
    },
    { onConflict: "project_id,phase,party" },
  );
  if (error) throw new Error(`approve ${party}@${phase}: ${error.message}`);
}

/**
 * Mirrors lib/db/repo.ts rejectGate exactly: the RPC does the state change,
 * then the dates are recomputed here because deriveSchedule lives in TS.
 */
async function rejectGate(projectId: string, phase: "review" | "final_review") {
  const { error } = await sb.rpc("reject_gate", {
    p_project_id: projectId,
    p_phase: phase,
    p_actor_id: actorId,
  });
  if (error) throw new Error(`reject_gate: ${error.message}`);

  const rows = await phases(projectId);
  const locked: Partial<Record<DesignPhase, string | null>> = {};
  const durations: Partial<Record<DesignPhase, number | null>> = {};
  for (const [ph, row] of rows) {
    durations[ph] = row.duration_days;
    if (row.status === "completed" || row.status === "skipped") {
      locked[ph] = row.planned_end;
    }
  }
  const schedule = deriveSchedule({
    anchor: new Date().toISOString().slice(0, 10),
    durations,
    locked,
  });
  for (const [phaseKey, dates] of Object.entries(schedule)) {
    const { error: e } = await sb
      .from("project_phases")
      .update({ planned_start: dates.planned_start, planned_end: dates.planned_end })
      .eq("project_id", projectId)
      .eq("phase", phaseKey);
    if (e) throw new Error(`re-date ${phaseKey}: ${e.message}`);
  }
}

let actorId = "";
let projectId = "";

async function main() {
  const { data: auth, error: authError } = await sb.auth.signInWithPassword({
    email: "chris@merkhet.studio",
    password: "password",
  });
  if (authError) throw new Error(`sign-in: ${authError.message}`);
  actorId = auth.user!.id;

  const { data: customer } = await sb.from("customers").select("id").limit(1).single();
  const { data: created, error: createError } = await sb
    .from("projects")
    .insert({
      customer_id: customer!.id,
      name: "ZZ Slice 5 verification (temporary)",
      description: "Created by a verification script. Safe to delete.",
      status: "pending",
    })
    .select("id, project_number")
    .single();
  if (createError) throw new Error(`create: ${createError.message}`);
  projectId = created!.id;
  console.log(`\n--- throwaway project ${created!.project_number} (${projectId}) ---\n`);

  // === Carried-forward Slice 2 gate: Pending needs a contract ================
  console.log("[Slice 2 gate — carried forward]");
  await blocked("Pending → Active without a contract is blocked", projectId, "active", "Upload an LOI or contract");
  await sb.from("projects").update({ contract_path: "verify/fake.pdf" }).eq("id", projectId);
  await allowed("Pending → Active with a contract", projectId, "active");

  // === Carried-forward Slice 4 gate: Active needs delegation ================
  console.log("\n[Slice 4 gate — carried forward]");
  await blocked("Active → SD undelegated is blocked", projectId, "schematic_design", "Plan the schedule first");

  // Delegate: assignee + duration on all five delegated phases, dates anchored
  // in the PAST so the rework floor has something to correct later.
  const durations: Record<string, number> = {
    schematic_design: 10,
    design_development: 5,
    construction_documents: 10,
    final_review: 3,
    permitting: 15,
  };
  const oldSchedule = deriveSchedule({ anchor: "2026-05-04", durations });
  for (const ph of DESIGN_PHASES) {
    await sb
      .from("project_phases")
      .update({
        assignee_id: ph === "review" ? null : actorId,
        duration_days: ph === "review" ? null : durations[ph],
        planned_start: oldSchedule[ph]?.planned_start ?? null,
        planned_end: oldSchedule[ph]?.planned_end ?? null,
      })
      .eq("project_id", projectId)
      .eq("phase", ph);
  }
  await allowed("Active → SD once delegated", projectId, "schematic_design");

  // === Gate crossing =======================================================
  console.log("\n[Gate crossing — from <= gate < to]");
  await allowed("SD → DD (no gate crossed)", projectId, "design_development");
  await blocked("DD → CD skips Review and is blocked", projectId, "construction_documents", "Review needs all three sign-offs");
  await blocked("DD → Permitting skips both gates and is blocked", projectId, "permitting", "Review needs all three sign-offs");
  await allowed("DD → Review", projectId, "review");

  await blocked("Review → CD with 0 sign-offs", projectId, "construction_documents", "Review needs all three sign-offs");
  await approve(projectId, "review", "client_contact");
  await approve(projectId, "review", "austin");
  await blocked("Review → CD with 2 of 3 sign-offs", projectId, "construction_documents", "Review needs all three sign-offs");
  await approve(projectId, "review", "client");
  await allowed("Review → CD with all 3 sign-offs", projectId, "construction_documents");

  await blocked("CD → Permitting skips Final review", projectId, "permitting", "Final review needs both sign-offs");
  await allowed("CD → Final review", projectId, "final_review");
  await blocked("Final review → Permitting with 0 sign-offs", projectId, "permitting", "Final review needs both sign-offs");
  await approve(projectId, "final_review", "client_contact");
  await blocked("Final review → Permitting with 1 of 2", projectId, "permitting", "Final review needs both sign-offs");
  await approve(projectId, "final_review", "austin");
  await allowed("Final review → Permitting with both", projectId, "permitting");

  await allowed("backward moves are never gated (Permitting → CD)", projectId, "construction_documents");

  // === Rework loop, pass 1 =================================================
  console.log("\n[Rework loop — pass 1]");
  await allowed("CD → Final review", projectId, "final_review");
  await rejectGate(projectId, "final_review");

  let proj = await currentPhase(projectId);
  let rows = await phases(projectId);
  // repo.ts anchors the re-plan on `new Date().toISOString()` (UTC), and
  // deriveSchedule floors a weekend anchor to the following Monday — so the
  // expected start is the business day at or after UTC today, not today.
  const today = new Date().toISOString().slice(0, 10);
  const floorDay = (d: string) => {
    const parsed = parseISO(d);
    return format(isWeekend(parsed) ? nextMonday(parsed) : parsed, "yyyy-MM-dd");
  };
  const workToday = floorDay(today);

  check("pass 1: returned to Construction documents", proj?.current_phase, "construction_documents");
  check("pass 1: still active", proj?.status, "active");
  check("pass 1: CD is in_progress", rows.get("construction_documents")?.status, "in_progress");
  check("pass 1: rejected gate is not_started, not completed", rows.get("final_review")?.status, "not_started");
  check("pass 1: Final review sign-offs cleared", await approvalsOf(projectId, "final_review"), []);
  check("pass 1: Review sign-offs untouched", await approvalsOf(projectId, "review"), ["austin", "client", "client_contact"]);
  check("pass 1: reworked CD re-dated from today", rows.get("construction_documents")?.planned_start, workToday);
  check(
    "pass 1: completed phases keep their old dates",
    rows.get("schematic_design")?.planned_end,
    oldSchedule.schematic_design?.planned_end,
  );
  const past1 = [...rows.values()].filter((r) => r.planned_start && r.status !== "completed" && r.planned_start < today);
  check("pass 1: nothing un-worked is scheduled in the past", past1.map((r) => r.phase), []);

  const { data: act1 } = await sb
    .from("activity_log")
    .select("event_type, payload")
    .eq("project_id", projectId)
    .eq("event_type", "gate.rejected");
  check("pass 1: one gate.rejected activity row", act1?.length, 1);
  check("pass 1: activity payload names the target", (act1?.[0]?.payload as Record<string, unknown>)?.to, "construction_documents");

  const { data: tr1 } = await sb
    .from("phase_transitions")
    .select("from_column, to_column, direction")
    .eq("project_id", projectId)
    .eq("direction", "backward");
  check("pass 1: backward transition recorded", tr1?.some((t) => t.from_column === "final_review" && t.to_column === "construction_documents"), true);

  // === Rework loop, pass 2 — the same project, a second time ===============
  console.log("\n[Rework loop — pass 2, same project]");
  await blocked("pass 2: CD → Permitting blocked again after the reset", projectId, "permitting", "Final review needs both sign-offs");
  await allowed("pass 2: CD → Final review", projectId, "final_review");
  await approve(projectId, "final_review", "client_contact");
  await approve(projectId, "final_review", "austin");
  check("pass 2: sign-offs recorded again on a re-entered gate", await approvalsOf(projectId, "final_review"), ["austin", "client_contact"]);

  await rejectGate(projectId, "final_review");
  proj = await currentPhase(projectId);
  rows = await phases(projectId);

  check("pass 2: returned to Construction documents", proj?.current_phase, "construction_documents");
  check("pass 2: CD is in_progress", rows.get("construction_documents")?.status, "in_progress");
  check("pass 2: rejected gate is not_started", rows.get("final_review")?.status, "not_started");
  check("pass 2: sign-offs cleared again", await approvalsOf(projectId, "final_review"), []);
  check("pass 2: CD re-dated from today again", rows.get("construction_documents")?.planned_start, workToday);
  const past2 = [...rows.values()].filter((r) => r.planned_start && r.status !== "completed" && r.planned_start < today);
  check("pass 2: nothing un-worked is scheduled in the past", past2.map((r) => r.phase), []);

  const { data: act2 } = await sb
    .from("activity_log")
    .select("id")
    .eq("project_id", projectId)
    .eq("event_type", "gate.rejected");
  check("pass 2: history accumulated (2 gate.rejected rows)", act2?.length, 2);

  // Scoped to the rejection route specifically — a plain backward drag
  // (Permitting → CD, earlier in this script) also records a backward
  // transition, so an unfiltered count is not a measure of the rework loop.
  const { data: tr2 } = await sb
    .from("phase_transitions")
    .select("id")
    .eq("project_id", projectId)
    .eq("direction", "backward")
    .eq("from_column", "final_review")
    .eq("to_column", "construction_documents");
  check("pass 2: both rejections recorded a backward transition", tr2?.length, 2);

  // === Rejection guards ====================================================
  console.log("\n[reject_gate guards]");
  const { error: notAtGate } = await sb.rpc("reject_gate", {
    p_project_id: projectId,
    p_phase: "review",
    p_actor_id: actorId,
  });
  check("rejecting a gate the project is not at is refused", notAtGate?.message?.includes("not at that gate"), true);

  const { error: notAGate } = await sb.rpc("reject_gate", {
    p_project_id: projectId,
    p_phase: "construction_documents",
    p_actor_id: actorId,
  });
  check("only Review and Final review can be rejected", notAGate?.message?.includes("Only Review and Final review"), true);

  // Reject at Review too, to exercise the other target.
  console.log("\n[Reject at Review → Design development]");
  await sb.from("project_approvals").delete().eq("project_id", projectId);
  await allowed("CD → DD (backward)", projectId, "design_development");
  await allowed("DD → Review", projectId, "review");
  await rejectGate(projectId, "review");
  proj = await currentPhase(projectId);
  rows = await phases(projectId);
  check("Review rejection returns to Design development", proj?.current_phase, "design_development");
  check("DD is in_progress", rows.get("design_development")?.status, "in_progress");
  check("Review is not_started", rows.get("review")?.status, "not_started");
  check("reworked DD re-dated from today", rows.get("design_development")?.planned_start, workToday);
  check("Review milestone follows the reworked DD, not the stale lock", rows.get("review")?.planned_start, rows.get("design_development")?.planned_end);
}

main()
  .catch((e) => {
    failures += 1;
    console.log(`\nFATAL ${e instanceof Error ? e.message : String(e)}`);
  })
  .finally(async () => {
    if (projectId) {
      const { error } = await sb.from("projects").delete().eq("id", projectId);
      console.log(
        error ? `\n!! could not delete throwaway project ${projectId}: ${error.message}` : `\ncleaned up throwaway project`,
      );
    }
    console.log(failures === 0 ? "\nAll Slice 5 live checks passed" : `\n${failures} FAILURES`);
    process.exit(failures === 0 ? 0 : 1);
  });
