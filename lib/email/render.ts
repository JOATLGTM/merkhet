/**
 * Shared types and text helpers for the email templates.
 *
 * Every template returns a `RenderedEmail` — subject, preview, HTML and a
 * plain-text alternative. The text part is not optional: a `text/html`-only
 * message scores badly with spam filters and is unreadable in text-mode
 * clients, and these are the firm's first outbound-to-client messages.
 */
import { FIRM } from "@/lib/email/tokens";
import { formatFullDate } from "@/lib/dates";
import type { Customer, DesignPhase, Project, User } from "@/lib/types";

export type EmailAudience = "internal" | "customer" | "account";

export type RenderedEmail = {
  /** Subject line. */
  subject: string;
  /** Inbox preview text — set explicitly, never inherited from the body. */
  preview: string;
  html: string;
  text: string;
};

/**
 * The project fields any template may use. Narrower than
 * `ProjectWithRelations` on purpose: templates should not be able to reach
 * for a field nobody agreed to put in an email — budgets and internal notes
 * are one careless interpolation away from a client's inbox otherwise.
 */
export type EmailProject = {
  id: string;
  number: string;
  name: string;
  customerName: string;
  targetCompletion: string | null;
  onHold: boolean;
};

export type EmailPerson = {
  name: string;
  email: string | null;
};

/** Schedule facts for one phase, as shown in the internal mail. */
export type EmailPhaseSchedule = {
  plannedStart: string | null;
  plannedEnd: string | null;
  durationDays: number | null;
  plannedHours: number | null;
};

/** Adapter from repo data. Keeps the whitelist above in one place. */
export function toEmailProject(
  project: Project,
  customer: Pick<Customer, "name">,
): EmailProject {
  return {
    id: project.id,
    number: project.project_number,
    name: project.name,
    customerName: customer.name,
    targetCompletion: project.target_completion,
    onHold: project.on_hold,
  };
}

export function toEmailPerson(user: Pick<User, "name" | "email">): EmailPerson {
  return { name: user.name, email: user.email };
}

/* ------------------------------------------------------------- formatting -- */

export const formatDate = (value: string | null | undefined): string =>
  formatFullDate(value);

export function formatDateRange(
  start: string | null,
  end: string | null,
): string {
  if (!start && !end) return "Not scheduled";
  if (start && end) return `${formatFullDate(start)} — ${formatFullDate(end)}`;
  return formatFullDate(start ?? end);
}

export function formatDuration(days: number | null): string {
  if (days == null || days <= 0) return "Not set";
  return days === 1 ? "1 working day" : `${days} working days`;
}

export function formatHours(hours: number | null): string {
  if (hours == null) return "Not set";
  return `${hours}h planned`;
}

/* ------------------------------------------------------------------ text -- */

export const TEXT_RULE = "-".repeat(56);

export function textLines(...lines: Array<string | null | undefined>): string {
  return lines.filter((line) => line != null).join("\n");
}

/** Standard sign-off for the text part. */
export function textFooter(audience: EmailAudience): string {
  if (audience === "account") {
    return textLines(
      "",
      TEXT_RULE,
      `${FIRM.name} · project tracking`,
      "You receive this because someone at Merkhet created an account for this",
      "address, or a reset was requested for it.",
      "Nobody here can see the password you choose.",
    );
  }
  if (audience === "customer") {
    return textLines(
      "",
      TEXT_RULE,
      FIRM.name,
      "",
      "Replying to this message reaches your project team directly.",
    );
  }
  return textLines(
    "",
    TEXT_RULE,
    `${FIRM.name} · internal project tracking`,
    "Sent automatically when a project changes phase.",
  );
}

/** Phases that are approval gates rather than worked phases. */
export const GATE_SET = new Set<DesignPhase>(["review", "final_review"]);
