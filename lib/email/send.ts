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
 * Customer mail is rendered and recorded but not sent until this is turned on
 * deliberately. Phase changes reach real clients, and "we wired up email" is
 * not a good reason for a client's first contact to be an accident.
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
  suppressed: number;
};

type OutboxRow = {
  id: string;
  to_addresses: string[];
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
    suppressed: 0,
  };
  if (!jobs.length) return outcome;

  const sendable = jobs.filter((job) => {
    const allowed = job.audience === "internal" || customerSendEnabled();
    if (!allowed) outcome.suppressed += 1;
    return allowed && job.to.length > 0;
  });
  if (!sendable.length) return outcome;

  const supabase = await createServerSupabase();
  const { data: rows, error } = await supabase
    .from("email_outbox")
    .insert(
      sendable.map((job) => ({
        project_id: projectId,
        template: job.template,
        audience: job.audience,
        to_addresses: job.to.map((person) => person.email),
        subject: job.email.subject,
        html: job.email.html,
        text_body: job.email.text,
      })),
    )
    .select("id,to_addresses,subject,html,text_body");

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

  for (const row of rows as OutboxRow[]) {
    const result = await deliver(row, apiKey);
    const failed = Boolean(result.error);
    if (failed) {
      outcome.failed += 1;
      console.error(`[email] ${row.subject}: ${result.error}`);
    } else {
      outcome.sent += 1;
    }

    await supabase
      .from("email_outbox")
      .update({
        status: failed ? "failed" : "sent",
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
    suppressed: 0,
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
    .select("id,to_addresses,subject,html,text_body,attempts")
    .eq("status", "failed")
    .order("created_at", { ascending: true })
    .limit(limit);

  for (const row of (rows ?? []) as Array<OutboxRow & { attempts: number }>) {
    const result = await deliver(row, apiKey);
    const failed = Boolean(result.error);
    if (failed) outcome.failed += 1;
    else outcome.sent += 1;

    await supabase
      .from("email_outbox")
      .update({
        status: failed ? "failed" : "sent",
        error: result.error ?? null,
        provider_id: result.id ?? null,
        attempts: row.attempts + 1,
        sent_at: failed ? null : new Date().toISOString(),
      })
      .eq("id", row.id);
  }

  return outcome;
}
