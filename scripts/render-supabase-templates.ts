/**
 * Compiles the Supabase auth templates to paste-ready HTML.
 *
 * `npm run email:supabase` writes one `.html` per auth template to
 * `out/emails/`, and prints the subject line and the dashboard field each one
 * belongs in. Nothing is sent, no database is touched and nothing talks to
 * Supabase — the last step is a human pasting the file into
 * Authentication → Emails.
 *
 * Kept apart from `preview-emails.ts` because these are not previews. That
 * script renders messages the app itself will send; this one produces the
 * artefact that becomes the live template.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { AUTH_COPY, type AuthKind } from "../lib/email/copy";
import { renderAuthLink } from "../lib/email/templates/auth-link";

/** Dashboard template each file replaces, and the redirect it must be paired with. */
const TEMPLATES: Array<{
  kind: AuthKind;
  file: string;
  dashboard: string;
  redirect: string;
}> = [
  {
    kind: "invite",
    file: "supabase-invite",
    dashboard: "Authentication → Emails → Invite user",
    redirect: "<site>/accept-invite",
  },
  {
    kind: "recovery",
    file: "supabase-recovery",
    dashboard: "Authentication → Emails → Reset password",
    redirect: "<site>/reset-password",
  },
];

const outDir = join(process.cwd(), "out", "emails");
mkdirSync(outDir, { recursive: true });

console.log("");
for (const template of TEMPLATES) {
  const email = renderAuthLink({ kind: template.kind });
  const htmlPath = join(outDir, `${template.file}.html`);
  writeFileSync(htmlPath, email.html, "utf8");
  // Reference only — the dashboard has no plain-text field.
  writeFileSync(join(outDir, `${template.file}.txt`), email.text, "utf8");

  console.log(`  ${template.dashboard}`);
  console.log(`    Subject   ${AUTH_COPY[template.kind].subject}`);
  console.log(`    Body      ${htmlPath}`);
  console.log(`    Redirect  ${template.redirect} (Auth → URL Configuration)`);
  console.log("");
}

console.log(
  "  Paste the HTML into the Body field, replacing everything already there.\n" +
    "  The .txt beside each file is reference only — Supabase has no text part.\n",
);
