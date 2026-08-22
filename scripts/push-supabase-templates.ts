/**
 * Pushes the rendered auth templates into the live Supabase project.
 *
 *   npx tsx scripts/push-supabase-templates.ts          # report only
 *   npx tsx scripts/push-supabase-templates.ts --yes    # write them
 *
 * `npm run email:supabase` produces the HTML; this puts it in Supabase without
 * a trip through the dashboard. Both exist because the paste is a real step
 * that is easy to forget, and because the copy will be edited again.
 *
 * ## Why a personal access token and not the service role key
 *
 * Email templates are **project configuration**, not data. The service role key
 * authenticates against one project's Postgres and GoTrue; it has no standing
 * with the Management API, which is account-scoped and answers only to a
 * personal access token. `SUPABASE_SERVICE_MERKET_ROLE_KEY` will 401 here, and
 * the failure looks like a permissions bug rather than a wrong-credential one.
 *
 * Create one at https://supabase.com/dashboard/account/tokens and put it in
 * `.env` as `SUPABASE_ACCESS_TOKEN` (starts `sbp_`). It is **account-wide** —
 * every project the owner can reach — so it is the most powerful credential in
 * this repo's `.env`. Nothing in the app reads it; only this script does.
 *
 * ## Why not `supabase config push`
 *
 * The CLI pushes the whole `[auth]` block from `config.toml`, filling anything
 * unset with its own defaults. There is no `config.toml` here, so its idea of
 * "unset" is everything: Site URL, redirect URLs, SMTP, rate limits and the
 * session settings would all be rewritten to defaults on the first push. This
 * script PATCHes four fields and touches nothing else.
 *
 * Dry-run by default. `--yes` writes. Existing templates are saved to
 * `out/emails/*.backup.html` before anything is overwritten, so a bad push can
 * be undone with a paste.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { config } from "dotenv";

import { AUTH_COPY, type AuthKind } from "../lib/email/copy";
import { renderAuthLink } from "../lib/email/templates/auth-link";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Management API field names. `mailer_templates_*_content` holds the HTML;
 * `mailer_subjects_*` the subject line. Supabase calls the reset template
 * "recovery" in the API and "Reset password" in the dashboard.
 */
const FIELDS: Record<AuthKind, { subject: string; content: string; label: string }> = {
  invite: {
    subject: "mailer_subjects_invite",
    content: "mailer_templates_invite_content",
    label: "Invite user",
  },
  recovery: {
    subject: "mailer_subjects_recovery",
    content: "mailer_templates_recovery_content",
    label: "Reset password",
  },
};

const token = process.env.SUPABASE_ACCESS_TOKEN;
const url =
  process.env.NEXT_PUBLIC_SUPABASE_MERKET_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!url) {
  console.error("Need NEXT_PUBLIC_SUPABASE_MERKET_URL in .env");
  process.exit(1);
}
if (!token) {
  console.error(
    "\nNeed SUPABASE_ACCESS_TOKEN in .env — a personal access token, not the\n" +
      "service role key. Create one at:\n\n" +
      "  https://supabase.com/dashboard/account/tokens\n\n" +
      "Or paste the files by hand: npm run email:supabase, then\n" +
      "Authentication → Emails in the dashboard.\n",
  );
  process.exit(1);
}

/** `https://abcdefgh.supabase.co` → `abcdefgh`. */
const ref = new URL(url).hostname.split(".")[0];
const confirmed = process.argv.slice(2).includes("--yes");
const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function main() {
  const res = await fetch(api, { headers });
  if (!res.ok) {
    const body = await res.text();
    console.error(`\nGET ${api}\n  ${res.status} ${res.statusText}\n  ${body}\n`);
    if (res.status === 401 || res.status === 403) {
      console.error(
        "  A 401 here usually means the service role key was used instead of a\n" +
          "  personal access token, or the token does not cover this project.\n",
      );
    }
    process.exit(1);
  }
  const current = (await res.json()) as Record<string, unknown>;

  const outDir = join(process.cwd(), "out", "emails");
  mkdirSync(outDir, { recursive: true });

  const patch: Record<string, string> = {};
  console.log(`\n  Project ${ref}\n`);

  for (const kind of Object.keys(FIELDS) as AuthKind[]) {
    const field = FIELDS[kind];
    const email = renderAuthLink({ kind });
    const live = String(current[field.content] ?? "");
    const liveSubject = String(current[field.subject] ?? "");

    // Back up whatever is live, including "" — an empty template means Supabase
    // is falling back to its built-in default, which is what we are replacing.
    const backup = join(outDir, `supabase-${kind}.backup.html`);
    writeFileSync(backup, live, "utf8");

    const same = live.trim() === email.html.trim() && liveSubject === email.subject;
    console.log(`  ${field.label}`);
    console.log(`    Live      ${live ? `${live.length} bytes` : "empty — Supabase default"}`);
    console.log(`    New       ${email.html.length} bytes`);
    console.log(`    Subject   ${liveSubject || "(default)"} → ${email.subject}`);
    console.log(`    Backup    ${backup}`);
    console.log(`    ${same ? "Already current — skipping" : "Will be replaced"}`);
    console.log("");

    if (!same) {
      patch[field.content] = email.html;
      patch[field.subject] = AUTH_COPY[kind].subject;
    }
  }

  if (Object.keys(patch).length === 0) {
    console.log("  Nothing to do — Supabase already has these.\n");
    return;
  }

  if (!confirmed) {
    console.log("  Dry run. Re-run with --yes to write.\n");
    return;
  }

  const put = await fetch(api, {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
  });
  if (!put.ok) {
    console.error(`\n  PATCH failed: ${put.status} ${put.statusText}\n  ${await put.text()}\n`);
    process.exit(1);
  }

  console.log("  Written.\n");
  console.log(
    "  Now send yourself one invite from /staff and open it. A template push\n" +
      "  is also an opportunity to lose a placeholder, and the link is single-use.\n",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
