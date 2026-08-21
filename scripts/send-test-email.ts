/**
 * Sends a rendered template through Gmail SMTP, so a real message lands in a
 * real inbox and you can see what Gmail does to it.
 *
 * This is a **harness, not the send path.** The production design (Slice 6)
 * needs an outbox, retries and a review-before-send step, and will send from
 * the firm's own domain once its DNS is verified. Nothing here is wired into
 * the app — `lib/notifications.ts` is still a stub.
 *
 * Setup — the sending account needs an App Password, which requires
 * 2-Step Verification to be on:
 *
 *   1. myaccount.google.com → Security → turn on 2-Step Verification
 *   2. myaccount.google.com/apppasswords → create one, copy the 16 characters
 *   3. put it in `.env` (see `.env.example`)
 *
 * Usage:
 *
 *   npm run email:send                      # list the cases, send nothing
 *   npm run email:send -- --verify          # test the SMTP login only
 *   npm run email:send -- --case 03         # send both messages for case 03
 *   npm run email:send -- --case 03 --audience customer
 *   npm run email:send -- --all --yes       # every message, one after another
 *   npm run email:send -- --case 06 --to someone@example.com
 *
 * Every recipient is overridden with `GMAIL_TEST_TO`. The fixture addresses
 * are not used — two of them are on a real domain.
 */
import { config } from "dotenv";
import nodemailer from "nodemailer";

import { cases, findCase } from "./email-fixtures";
import { APP_URL, appUrlIsLocal, FIRM } from "../lib/email/tokens";
import type { EmailJob } from "../lib/email/plan";

config({ path: ".env.local" });
config({ path: ".env" });

/* ----------------------------------------------------------------- args -- */

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string): string | undefined => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
};

const wantList = flag("list") || argv.length === 0;
const wantVerify = flag("verify");
const wantAll = flag("all");
const caseKey = value("case");
const audienceFilter = value("audience");
const toOverride = value("to");

if (audienceFilter && audienceFilter !== "internal" && audienceFilter !== "customer") {
  console.error(`--audience must be "internal" or "customer", got "${audienceFilter}"`);
  process.exit(1);
}

/* ----------------------------------------------------------------- list -- */

if (wantList) {
  console.log("\nCases — pass one to --case\n");
  for (const testCase of cases) {
    const audiences = testCase.jobs.map((job) => job.audience).join(" + ");
    console.log(`  ${testCase.n}  ${testCase.title.padEnd(46)} ${audiences}`);
  }
  console.log(`\n  ${cases.length} events, ${cases.reduce((n, c) => n + c.jobs.length, 0)} messages`);
  console.log("\n  npm run email:send -- --case 03\n");
  process.exit(0);
}

/* ------------------------------------------------------------------ env -- */

const user = process.env.GMAIL_TEST_USER;
const pass = process.env.GMAIL_TEST_APP_PASSWORD?.replaceAll(" ", "");
const to = toOverride ?? process.env.GMAIL_TEST_TO;

const missing = [
  !user && "GMAIL_TEST_USER",
  !pass && "GMAIL_TEST_APP_PASSWORD",
  !to && !wantVerify && "GMAIL_TEST_TO (or --to)",
].filter(Boolean);

if (missing.length > 0) {
  console.error(`\nMissing in .env: ${missing.join(", ")}`);
  console.error("See .env.example, and the setup notes at the top of this file.\n");
  process.exit(1);
}

/* ------------------------------------------------------------- transport -- */

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user, pass },
});

/** Gmail's auth failures are opaque; translate the two that actually happen. */
function explain(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Username and Password not accepted|BadCredentials|EAUTH/i.test(message)) {
    return [
      message,
      "",
      "Gmail rejected the login. Usually one of:",
      "  · the value is the account password, not a 16-character App Password",
      "  · 2-Step Verification is off, so App Passwords cannot be created",
      "  · a Workspace admin has blocked App Passwords for the account",
    ].join("\n");
  }
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(message)) {
    return `${message}\n\nCould not reach smtp.gmail.com:465 — check the network or a firewall blocking SMTP.`;
  }
  return message;
}

/**
 * Things about the message itself that push a filter toward spam. None of
 * these are fatal, but the first test send is the one place they all land at
 * once, so it helps to know which are in play before blaming the templates.
 */
function preflight(): void {
  const warnings: string[] = [];

  if (appUrlIsLocal) {
    warnings.push(
      `Internal mail links to ${APP_URL}, which nobody outside this machine can open.\n` +
        `    An unresolvable plain-HTTP host is a real spam signal. Set NEXT_PUBLIC_APP_URL\n` +
        `    to a reachable https:// address to take this off the table.`,
    );
  }

  if (user && !process.env.GMAIL_TEST_REPLY_TO) {
    warnings.push(
      `From shows "${FIRM.shortName} (test)" over a ${user.split("@")[1]} address.\n` +
        `    A display name that does not match the sending domain is a mild spoofing signal.`,
    );
  }

  warnings.push(
    `No sending reputation. A first templated HTML message between two accounts with\n` +
      `    no correspondence history is close to the worst case a filter can see, and no\n` +
      `    amount of template work changes it — domain, SPF/DKIM/DMARC and volume do.`,
  );

  console.log("\nBefore you read anything into where this lands:\n");
  warnings.forEach((warning, i) => console.log(`  ${i + 1}. ${warning}\n`));
}

async function verify(): Promise<void> {
  process.stdout.write(`Connecting to smtp.gmail.com:465 as ${user} … `);
  try {
    await transporter.verify();
    console.log("ok");
  } catch (error) {
    console.log("failed\n");
    console.error(explain(error));
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ send -- */

async function send(job: EmailJob, testCase: { n: string; title: string }): Promise<void> {
  const intended = job.to.map((person) => person.email).join(", ") || "(nobody addressable)";

  console.log(`\n  ${testCase.n} · ${job.audience}`);
  console.log(`  subject   ${job.email.subject}`);
  console.log(`  would go  ${intended}`);
  console.log(`  sending   ${to}`);

  const info = await transporter.sendMail({
    from: `"${FIRM.shortName} (test)" <${user}>`,
    to,
    replyTo: process.env.GMAIL_TEST_REPLY_TO || user,
    subject: job.email.subject,
    text: job.email.text,
    html: job.email.html,
    headers: {
      // Marks the run so a test never gets mistaken for a real notification.
      "X-Merkhet-Test": "true",
      "X-Merkhet-Template": job.template,
      "X-Merkhet-Audience": job.audience,
    },
  });

  console.log(`  sent      ${info.messageId}`);
  if (info.rejected.length > 0) {
    console.log(`  REJECTED  ${info.rejected.join(", ")}`);
  }
}

async function main(): Promise<void> {
  await verify();
  if (!wantVerify) preflight();
  if (wantVerify) {
    console.log("\nLogin works. Nothing sent.\n");
    return;
  }

  let jobs: Array<{ job: EmailJob; testCase: { n: string; title: string } }> = [];

  if (wantAll) {
    if (!flag("yes")) {
      const total = cases.reduce((n, c) => n + c.jobs.length, 0);
      console.error(`\n--all would send ${total} messages to ${to}. Add --yes to confirm.\n`);
      process.exit(1);
    }
    jobs = cases.flatMap((testCase) =>
      testCase.jobs.map((job) => ({ job, testCase })),
    );
  } else if (caseKey) {
    const testCase = findCase(caseKey);
    if (!testCase) {
      console.error(`\nNo case "${caseKey}". Run without arguments to list them.\n`);
      process.exit(1);
    }
    jobs = testCase.jobs.map((job) => ({ job, testCase }));
  } else {
    console.error("\nNothing to send — pass --case <n> or --all.\n");
    process.exit(1);
  }

  if (audienceFilter) {
    jobs = jobs.filter((entry) => entry.job.audience === audienceFilter);
    if (jobs.length === 0) {
      console.error(`\nThat case has no "${audienceFilter}" message.\n`);
      process.exit(1);
    }
  }

  for (const [index, entry] of jobs.entries()) {
    try {
      await send(entry.job, entry.testCase);
    } catch (error) {
      console.log("  FAILED\n");
      console.error(explain(error));
      process.exit(1);
    }
    // Gmail throttles bursts; a beat between messages keeps a long run clean.
    if (index < jobs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  console.log(`\nSent ${jobs.length} message${jobs.length === 1 ? "" : "s"} to ${to}.\n`);
  transporter.close();
}

main();
