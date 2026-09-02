/**
 * Wipes all project data from hosted Supabase, keeping exactly one account.
 *
 * Destructive and irreversible. Requires an explicit confirmation flag:
 *
 *   npx tsx scripts/reset-data.ts --keep you@example.com --yes
 *
 * Keeps the named account, promotes it to admin (it has to be able to invite
 * the others back), and deletes every other auth user, every row of project
 * data, and every file in the contracts bucket.
 *
 * Not wired into `npm run` on purpose — it should be awkward enough to reach
 * for that nobody runs it by muscle memory.
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
const keepEmail = args[args.indexOf("--keep") + 1];
const confirmed = args.includes("--yes");

if (!keepEmail || keepEmail.startsWith("--")) {
  console.error("Missing --keep <email>.");
  process.exit(1);
}
if (!confirmed) {
  console.error(
    `Refusing to run without --yes.\nThis deletes ALL project data and every account except ${keepEmail}.`,
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  // Node 20: supabase-js realtime expects a global WebSocket (Node 22+).
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
});

/**
 * Child-to-parent. Most of these cascade from `projects`, but deleting them
 * explicitly means the run reports what it actually removed instead of
 * trusting the FKs silently. Paired with the column used as a match-all
 * filter, since PostgREST refuses an unfiltered delete.
 */
const TABLES: Array<{ name: string; filter: "id" | "created_at" }> = [
  { name: "project_approvals", filter: "id" },
  { name: "phase_transitions", filter: "id" },
  { name: "project_consultants", filter: "created_at" },
  { name: "activity_log", filter: "id" },
  { name: "project_phases", filter: "id" },
  { name: "project_phase_recipients", filter: "created_at" },
  { name: "projects", filter: "id" },
  { name: "customers", filter: "id" },
  { name: "consultants", filter: "id" },
];

async function countOf(table: string) {
  const { count } = await admin
    .from(table)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

/** Contract paths are `{projectId}/{file}`, so the bucket root lists folders. */
async function emptyContractsBucket() {
  const bucket = admin.storage.from("contracts");
  const { data: folders, error } = await bucket.list("", { limit: 1000 });
  if (error) {
    console.error(`  ! could not list contracts: ${error.message}`);
    return;
  }

  const paths: string[] = [];
  for (const entry of folders ?? []) {
    // A row with no `id` is a folder placeholder, not an object.
    if (entry.id) {
      paths.push(entry.name);
      continue;
    }
    const { data: files } = await bucket.list(entry.name, { limit: 1000 });
    for (const file of files ?? []) paths.push(`${entry.name}/${file.name}`);
  }

  if (!paths.length) {
    console.log("  contracts bucket already empty");
    return;
  }
  const { error: removeError } = await bucket.remove(paths);
  if (removeError) console.error(`  ! ${removeError.message}`);
  else console.log(`  removed ${paths.length} contract file(s)`);
}

async function main() {
  console.log(`Target: ${url}`);

  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) throw new Error(listError.message);

  const keeper = list.users.find(
    (u) => u.email?.toLowerCase() === keepEmail.toLowerCase(),
  );
  if (!keeper) {
    console.error(
      `\n${keepEmail} is not an account in this project. Aborting — ` +
        `wiping now would leave no way back in.`,
    );
    process.exit(1);
  }
  const doomed = list.users.filter((u) => u.id !== keeper.id);

  console.log(`\nKeeping  ${keeper.email} (${keeper.id})`);
  console.log(`Deleting ${doomed.length} other account(s)\n`);

  console.log("Storage:");
  await emptyContractsBucket();

  console.log("\nTables:");
  for (const { name, filter } of TABLES) {
    const before = await countOf(name);
    const query = admin.from(name).delete();
    const { error } =
      filter === "id"
        ? await query.not("id", "is", null)
        : await query.gte("created_at", "1970-01-01");
    if (error) console.error(`  ! ${name}: ${error.message}`);
    else console.log(`  ${name.padEnd(22)} -${before}`);
  }

  console.log("\nAccounts:");
  for (const user of doomed) {
    // Cascades to public.users via the FK on users.id.
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) console.error(`  ! ${user.email}: ${error.message}`);
    else console.log(`  deleted ${user.email}`);
  }

  // Must be admin, or the surviving account cannot invite anyone.
  const { error: promoteError } = await admin
    .from("users")
    .update({ role: "admin", is_active: true })
    .eq("id", keeper.id);
  if (promoteError) console.error(`  ! promote: ${promoteError.message}`);
  else console.log(`  ${keeper.email} -> admin, active`);

  console.log("\nVerify:");
  for (const { name } of TABLES) {
    console.log(`  ${name.padEnd(22)} ${await countOf(name)}`);
  }
  console.log(`  ${"users".padEnd(22)} ${await countOf("users")}`);

  console.log(
    "\nOne step left, in the Supabase SQL editor — project numbering still\n" +
      "continues from where the demo data left off:\n\n" +
      "  alter sequence public.project_number_seq restart with 400;\n",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
