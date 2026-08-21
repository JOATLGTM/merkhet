/**
 * Renders every email template with sample data.
 *
 * `npm run email:preview` writes one `.html` and one `.txt` per message to
 * `out/emails/`, plus `index.html` linking them all. Nothing is sent and no
 * database is touched — this is a look-at-it harness for reviewing copy and
 * layout, and for pasting into Litmus or a client of your choice.
 *
 * To actually put one in an inbox, see `send-test-email.ts`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { cases } from "./email-fixtures";

const outDir = join(process.cwd(), "out", "emails");
mkdirSync(outDir, { recursive: true });

const rows: string[] = [];
let count = 0;

for (const testCase of cases) {
  for (const job of testCase.jobs) {
    const name = `${testCase.n}-${job.audience}`;
    writeFileSync(join(outDir, `${name}.html`), job.email.html, "utf8");
    writeFileSync(join(outDir, `${name}.txt`), job.email.text, "utf8");
    count += 1;
    rows.push(
      `<tr><td><a href="${name}.html">${name}</a></td><td>${testCase.title}</td>` +
        `<td>${job.audience}</td><td>${job.to.map((p) => p.email).join(", ") || "—"}</td>` +
        `<td>${job.email.subject}</td></tr>`,
    );
  }
}

writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Merkhet email previews</title>
<style>body{font:14px/1.5 system-ui;margin:40px;max-width:1100px}table{border-collapse:collapse;width:100%}
td,th{border-bottom:1px solid #e4e4e1;padding:8px;text-align:left;vertical-align:top}
th{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8e9298}</style>
<h1>Merkhet email previews</h1><p>${count} messages from ${cases.length} events.</p>
<table><tr><th>File</th><th>Event</th><th>Audience</th><th>To</th><th>Subject</th></tr>
${rows.join("\n")}</table>`,
  "utf8",
);

console.log(`Wrote ${count} messages to ${outDir}`);
console.log(`Open ${join(outDir, "index.html")}`);
