/**
 * Removes an account completely — the `auth.users` row, not just the profile.
 *
 *   npx tsx scripts/delete-user.ts someone@example.com          # report only
 *   npx tsx scripts/delete-user.ts someone@example.com --yes    # delete
 *
 * Why this exists: deleting the row from the `users` table in the Supabase
 * table editor does **not** remove the account. `public.users.id` is
 * `references auth.users(id) on delete cascade` — the cascade runs from auth
 * *down* to the profile, never upwards. The login survives with no profile
 * attached, and the next invite to that address fails with "already has an
 * account" while the table editor shows nothing.
 *
 * Deleting the auth row cascades to `public.users`, and from there:
 * `project_phases.assignee_id` and `activity_log.actor_id` go null (history is
 * kept, attribution is lost), `project_phase_recipients` rows are deleted. The report
 * counts all three before touching anything.
 *
 * Like `reset-data.ts`, deliberately not wired into `npm run`.
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
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_MERKET_URL and SUPABASE_SERVICE_MERKET_ROLE_KEY in .env",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
const confirmed = args.includes("--yes");

if (!email) {
  console.error("Usage: npx tsx scripts/delete-user.ts <email> [--yes]");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  // Node 20: supabase-js realtime expects a global WebSocket (Node 22+).
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
});

/** `listUsers` is paged and has no email filter — walk it. */
async function findAuthUser(target: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function countRows(table: string, column: string, value: string) {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) return `? (${error.message})`;
  return String(count ?? 0);
}

async function main() {
  const authUser = await findAuthUser(email!);
  const { data: profile } = await admin
    .from("users")
    .select("id,name,email,role,is_active")
    .ilike("email", email!)
    .maybeSingle();

  console.log(`\n${email}`);
  console.log(
    `  auth.users    ${
      authUser
        ? `present — id ${authUser.id}, confirmed ${
            authUser.email_confirmed_at ? "yes" : "no"
          }, last sign-in ${authUser.last_sign_in_at ?? "never"}`
        : "absent"
    }`,
  );
  console.log(
    `  public.users  ${
      profile
        ? `present — ${profile.name}, ${profile.role}, active ${profile.is_active}`
        : "absent"
    }`,
  );

  const id = authUser?.id ?? profile?.id;
  if (!id) {
    console.log("\nNothing to delete. This address is free to invite.\n");
    return;
  }

  if (authUser && !profile) {
    console.log(
      "\n  ⚠ Orphaned login: the account exists but has no profile row.\n" +
        "    Inviting this address fails with \"already has an account\".",
    );
  }

  console.log("\n  Referenced by:");
  console.log(
    `    project_phases.assignee_id  ${await countRows(
      "project_phases",
      "assignee_id",
      id,
    )}  → set null`,
  );
  console.log(
    `    activity_log.actor_id       ${await countRows(
      "activity_log",
      "actor_id",
      id,
    )}  → set null`,
  );
  console.log(
    `    project_phase_recipients.user_id   ${await countRows(
      "project_phase_recipients",
      "user_id",
      id,
    )}  → deleted`,
  );

  if (!confirmed) {
    console.log("\nReport only. Re-run with --yes to delete.\n");
    return;
  }

  if (authUser) {
    const { error } = await admin.auth.admin.deleteUser(authUser.id);
    if (error) {
      console.error(`\nFailed to delete auth user: ${error.message}\n`);
      process.exit(1);
    }
    console.log("\n  Deleted auth.users row (public.users cascaded).");
  } else {
    // Reverse orphan: profile with no login behind it. Cannot happen through
    // the app, but a hand-edit in the table editor can leave one.
    const { error } = await admin.from("users").delete().eq("id", id);
    if (error) {
      console.error(`\nFailed to delete profile: ${error.message}\n`);
      process.exit(1);
    }
    console.log("\n  Deleted orphaned public.users row.");
  }

  const stillThere = await findAuthUser(email!);
  console.log(
    stillThere
      ? "  ⚠ auth.users row still present — deletion did not take.\n"
      : `  ${email} is free to invite again.\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
