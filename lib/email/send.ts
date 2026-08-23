/**
 * The send path: outbox row first, provider second.
 *
 * `plan.ts` decides what to send and to whom; this module is the only place
 * that talks to a provider. Nothing here renders — a retry re-sends the stored
 * html, not a fresh render, so a template edit cannot silently rewrite a
 * message that was already planned.
 *
 * Resend's HTTP API rather than SMTP: the app runs serverless, where holding
 * an SMTP connection open is slow and prone to timing out mid-handshake. Same
 * credentials-free-of-nodemailer trade the rest of the codebase makes.
 */
import type { EmailJob } from "@/lib/email/plan";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Customer mail is not delivered to clients until this is turned on
 * deliberately. Phase changes reach real clients, and "we wired up email" is
 * not a good reason for a client's first contact to be an accident.
 *
 * Off does not mean silent. The message still goes out — to the project's
 * owner, verbatim — so the firm reads the real rendered mail in a real inbox
 * rather than pulling `text_body` out of the outbox by hand.
 */
function customerSendEnabled() {
  return process.env.EMAIL_CUSTOMER_ENABLED === "true";
}

function fromAddress() {
  return process.env.EMAIL_FROM ?? "Merkhet <noreply@merkhetdrafting.com>";
}

export type SendOutcome = {
  queued: number;
  sent: number;
  failed: number;
  /** Client mail delivered to the project owner instead of the client. */
  redirected: number;
  /** Recorded with status `held` rather than delivered. */
  suppressed: number;
  /** Dropped entirely — nobody to send to. */
  unaddressed: number;
};

type OutboxRow = {
  id: string;
  to_addresses: string[];
  intended_to_addresses: string[] | null;
  subject: string;
  html: string;
  text_body: string;
};

async function deliver(
  row: OutboxRow,
  apiKey: string,
): Promise<{ id?: string; error?: string }> {
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: row.to_addresses,
        subject: row.subject,
        html: row.html,
        text: row.text_body,
        /**
         * A redirected message is delivered verbatim — the client's copy, in
         * the owner's inbox, with nothing added to the subject or the body.
         * The provenance goes in a header instead, where it is inert to the
         * reader but present in the source and in Resend's log. Same
         * convention as `X-Merkhet-Test` in `scripts/send-test-email.ts`.
         */
        ...(row.intended_to_addresses?.length
          ? {
              headers: {
                "X-Merkhet-Redirected-From":
                  row.intended_to_addresses.join(", "),
              },
            }
          : {}),
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      id?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      return {
        error: payload?.message ?? `Provider returned ${response.status}`,
      };
    }
    return { id: payload?.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Network error" };
  }
}

/**
 * Record every job, then attempt each one. Never throws: a notification
 * failing must not roll back the phase change that triggered it — the outbox
 * row is the durable part, and a failed row can be retried.
 */
export async function enqueueAndSend(
  jobs: EmailJob[],
  projectId: string | null,
): Promise<SendOutcome> {
  const outcome: SendOutcome = {
    queued: 0,
    sent: 0,
    failed: 0,
    redirected: 0,
    suppressed: 0,
    unaddressed: 0,
  };
  if (!jobs.length) return outcome;

  /**
   * Everything addressable is recorded, including what we decline to deliver
   * to the addressee. A client message that reaches nobody is indistinguishable
   * from one that was never planned — and reading them before turning client
   * mail on is the whole reason the switch exists.
   *
   * Three outcomes for a client job, in order:
   *
   *  - switch on          → delivered to the client, `pending` → `sent`
   *  - switch off, owner  → delivered to the owner, `pending` → `redirected`
   *  - switch off, no one → recorded `held`, delivered nowhere
   *
   * A redirect is inserted `pending`, not `redirected`. The row must not claim
   * a delivery that has not happened — without an API key nothing is sent, and
   * a row already marked `redirected` would be neither retried nor true.
   * `intended_to_addresses`, not the status, is what marks a row as a redirect.
   *
   * `to_addresses` is *only ever* the set actually handed to the provider —
   * empty on a held row, the owner on a redirect. A client address never
   * appears in it while the switch is off, so no replay of that column, and no
   * missed status check, can deliver one. The client is recorded in
   * `intended_to_addresses`, which nothing sends to.
   */
  const deliverable = customerSendEnabled();
  const planned = jobs
    .filter((job) => {
      if (job.to.length > 0) return true;
      outcome.unaddressed += 1;
      return false;
    })
    .map((job) => {
      const withheld = job.audience === "customer" && !deliverable;
      const standIn = withheld ? (job.reviewTo ?? []) : [];

      if (!withheld) {
        return { job, to: job.to, intended: null, status: "pending" as const };
      }
      if (standIn.length) {
        return {
          job,
          to: standIn,
          intended: job.to,
          status: "pending" as const,
        };
      }
      /**
       * Nowhere to send it. `to_addresses` is left **empty** and the client
       * goes in `intended_to_addresses` — the same shape as a redirect.
       *
       * The status check below is what stops a held row, but a row is not
       * safe because one `continue` guards it. Storing the client address in
       * the column the provider reads means the only thing between a client
       * and this message is a branch nobody is watching. Empty means a stray
       * send fails at Resend instead of arriving.
       */
      outcome.suppressed += 1;
      return { job, to: [], intended: job.to, status: "held" as const };
    });
  if (!planned.length) return outcome;

  const supabase = await createServerSupabase();
  const { data: rows, error } = await supabase
    .from("email_outbox")
    .insert(
      planned.map(({ job, to, intended, status }) => ({
        project_id: projectId,
        template: job.template,
        audience: job.audience,
        to_addresses: to.map((person) => person.email),
        intended_to_addresses:
          intended?.map((person) => person.email) ?? null,
        subject: job.email.subject,
        html: job.email.html,
        text_body: job.email.text,
        status,
      })),
    )
    .select(
      "id,to_addresses,intended_to_addresses,subject,html,text_body,status",
    );

  if (error || !rows) {
    console.error(`[email] could not write outbox: ${error?.message}`);
    return outcome;
  }
  outcome.queued = rows.length;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Rows stay `pending` — configuring the key later and retrying is enough.
    console.warn("[email] RESEND_API_KEY unset; queued without sending");
    return outcome;
  }

  for (const row of rows as Array<OutboxRow & { status: string }>) {
    // The only status that reaches the provider on nobody's behalf.
    if (row.status === "held") continue;

    const wasRedirected = Boolean(row.intended_to_addresses?.length);
    const result = await deliver(row, apiKey);
    const failed = Boolean(result.error);
    if (failed) {
      outcome.failed += 1;
      console.error(`[email] ${row.subject}: ${result.error}`);
    } else if (wasRedirected) {
      outcome.redirected += 1;
    } else {
      outcome.sent += 1;
    }

    await supabase
      .from("email_outbox")
      .update({
        // `redirected` survives delivery. It was sent, but not to the person
        // the copy addresses, and collapsing that into `sent` would make the
        // outbox claim the client has been written to when they have not.
        status: failed ? "failed" : wasRedirected ? "redirected" : "sent",
        error: result.error ?? null,
        provider_id: result.id ?? null,
        attempts: 1,
        sent_at: failed ? null : new Date().toISOString(),
      })
      .eq("id", row.id);
  }

  return outcome;
}

/**
 * Re-attempt everything sitting in `failed`. Used by `npm run email:retry`.
 *
 * Service-role client rather than the request-scoped one: this runs from a
 * script, where `next/headers` has no request to read cookies from.
 */
export async function retryFailed(limit = 25): Promise<SendOutcome> {
  const outcome: SendOutcome = {
    queued: 0,
    sent: 0,
    failed: 0,
    redirected: 0,
    suppressed: 0,
    unaddressed: 0,
  };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY unset; nothing to retry with");
    return outcome;
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const supabase = createServiceClient();
  const { data: rows } = await supabase
    .from("email_outbox")
    .select(
      "id,to_addresses,intended_to_addresses,subject,html,text_body,attempts",
    )
    .eq("status", "failed")
    .order("created_at", { ascending: true })
    .limit(limit);

  for (const row of (rows ?? []) as Array<OutboxRow & { attempts: number }>) {
    // A redirect that failed retries as a redirect. `to_addresses` already
    // holds the owner, so this only decides what the row is called afterwards.
    const wasRedirected = Boolean(row.intended_to_addresses?.length);
    const result = await deliver(row, apiKey);
    const failed = Boolean(result.error);
    if (failed) outcome.failed += 1;
    else if (wasRedirected) outcome.redirected += 1;
    else outcome.sent += 1;

    await supabase
      .from("email_outbox")
      .update({
        status: failed ? "failed" : wasRedirected ? "redirected" : "sent",
        error: result.error ?? null,
        provider_id: result.id ?? null,
        attempts: row.attempts + 1,
        sent_at: failed ? null : new Date().toISOString(),
      })
      .eq("id", row.id);
  }

  return outcome;
}
