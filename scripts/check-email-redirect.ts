/**
 * Read-only verification for `20260823100000_email_redirected.sql`.
 *
 * Answers the only question that matters before the next phase move: when a
 * client message is planned, is there an owner to redirect it to, or does it
 * fall through to `held` and reach nobody? Reads only; writes nothing.
 *
 *   npx tsx scripts/check-email-redirect.ts
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

/** Phases flagged customerVisible in lib/phases.ts — the ones that mail out. */
const CUSTOMER_VISIBLE = new Set([
  "schematic_design",
  "design_development",
  "construction_documents",
  "permitting",
]);

async function main() {
  let failures = 0;
  const fail = (msg: string) => {
    failures += 1;
    console.log(`FAIL ${msg}`);
  };

  // --- migration applied ---------------------------------------------------
  const { error: colErr } = await admin
    .from("email_outbox")
    .select("id, intended_to_addresses")
    .limit(1);
  if (colErr) {
    console.log(
      `FAIL email_outbox.intended_to_addresses is not queryable: ${colErr.message}`,
    );
    console.log("\nThe migration has not been applied.");
    process.exit(1);
  }
  console.log("ok   email_outbox.intended_to_addresses exists");

  // The enum value is only observable by trying to filter on it — a bad value
  // is rejected by the cast rather than returning an empty set.
  const { error: enumErr } = await admin
    .from("email_outbox")
    .select("id")
    .eq("status", "redirected")
    .limit(1);
  if (enumErr) {
    fail(`email_status has no 'redirected' value: ${enumErr.message}`);
  } else {
    console.log("ok   email_status accepts 'redirected'");
  }

  const enabled = process.env.EMAIL_CUSTOMER_ENABLED === "true";
  console.log(
    enabled
      ? "\n!    EMAIL_CUSTOMER_ENABLED=true — client mail goes to CLIENTS, not owners."
      : "\nok   EMAIL_CUSTOMER_ENABLED is off — client mail redirects to owners.",
  );

  // --- can every live project reach an owner? ------------------------------
  const { data: users } = await admin
    .from("users")
    .select("id, name, email, is_active");
  const userById = new Map(
    (users ?? []).map((u) => [
      String(u.id),
      {
        name: String(u.name),
        email: (u.email as string) ?? null,
        active: Boolean(u.is_active),
      },
    ]),
  );

  const { data: projects } = await admin
    .from("projects")
    .select(
      "id, project_number, name, status, current_phase, created_by, archived_at",
    )
    .order("project_number");

  const live = (projects ?? []).filter(
    (p) => !p.archived_at && p.status !== "completed",
  );

  console.log("\nWhere a client message would land, per live project:\n");
  const rows: Record<string, string>[] = [];

  for (const p of live) {
    const owner = p.created_by ? userById.get(String(p.created_by)) : undefined;
    const reachable = Boolean(owner?.active && owner.email);
    const mailsNow = CUSTOMER_VISIBLE.has(String(p.current_phase ?? ""));

    rows.push({
      project: String(p.project_number),
      column: String(p.current_phase ?? p.status),
      "client-visible phase": mailsNow ? "yes" : "no",
      "redirects to": reachable
        ? `${owner!.name} <${owner!.email}>`
        : owner
          ? `${owner.name} (${owner.active ? "no address" : "deactivated"})`
          : "— no owner",
      outcome: enabled ? "client" : reachable ? "redirected" : "held",
    });

    if (!reachable) {
      fail(
        `${p.project_number} has no reachable owner — client mail will be held, not seen`,
      );
    }
  }

  console.table(rows);

  // --- what the outbox already holds ---------------------------------------
  const { data: outbox } = await admin
    .from("email_outbox")
    .select("status, audience")
    .eq("audience", "customer");
  const tally = new Map<string, number>();
  for (const row of outbox ?? []) {
    const key = String(row.status);
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  const held = tally.get("held") ?? 0;
  console.log(
    `\nClient mail on record: ` +
      ([...tally].map(([k, v]) => `${v} ${k}`).join(", ") || "none"),
  );
  if (held) {
    // coalesce: rows held before 2026-08-23 kept the client in `to_addresses`.
    // New ones leave it empty and record the client in `intended_to_addresses`.
    console.log(
      `     The ${held} held row(s) are history, not a queue — this change does\n` +
        `     not resend them. Read them with:\n` +
        `       select subject, coalesce(intended_to_addresses, to_addresses)\n` +
        `         as meant_for, text_body from email_outbox\n` +
        `       where status = 'held' order by created_at desc;`,
    );
  }

  console.log(
    failures === 0 ? "\nAll checks passed." : `\n${failures} failure(s).`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
