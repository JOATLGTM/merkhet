/**
 * Every user-facing sentence in the notification emails, in one file.
 *
 * Two vocabularies, kept apart on purpose:
 *
 * - `INTERNAL_COPY` uses the board's own language and names the gates.
 * - `CUSTOMER_COPY` uses `customerLabel` from `lib/phases.ts` and describes
 *   the work rather than the workflow. A client should never read the words
 *   "gate", "delegate", "board" or "gate rejected" — those are ours.
 *
 * Copy lives here rather than inline in the templates so it can be reviewed
 * and edited by someone who does not read TypeScript, and so the two
 * vocabularies can be diffed side by side.
 */
import type { BoardColumn, DesignPhase, GatePhase } from "@/lib/types";

export type InternalCopy = {
  /** Micro-label above the headline. */
  eyebrow: string;
  headline: string;
  /** Leading paragraph. `{project}` is substituted, already escaped. */
  lead: string;
  /** What the recipient is expected to do. Omitted where nothing is owed. */
  action: string | null;
  /** Button label on the deep link into the board. */
  cta: string;
};

export const INTERNAL_COPY: Record<BoardColumn, InternalCopy> = {
  pending: {
    eyebrow: "New project",
    headline: "Waiting on a contract",
    lead: "{project} has been created and is sitting in Pending.",
    action:
      "Pending is a hard gate — the project cannot move until a signed contract or LOI is uploaded to it. Upload the document from the project sheet and it advances to Active automatically.",
    cta: "Open the project",
  },
  active: {
    eyebrow: "Contract received",
    headline: "Ready to plan the schedule",
    lead: "The contract for {project} is on file, so it has moved to Active.",
    action:
      "Active is a holding state. Use Plan schedule to assign a person and a duration to Schematic design, Design development, Construction documents, Final review and Permitting. The project cannot start Schematic design until all five are set.",
    cta: "Plan the schedule",
  },
  schematic_design: {
    eyebrow: "Phase started",
    headline: "Schematic design is underway",
    lead: "{project} has moved into Schematic design.",
    action:
      "You are the delegate for this phase. Advance the project to Design development on the board when the schematic set is ready.",
    cta: "Open the project",
  },
  design_development: {
    eyebrow: "Phase started",
    headline: "Design development is underway",
    lead: "{project} has moved into Design development.",
    action:
      "You are the delegate for this phase. When the set is ready, move the project to Review — it needs three sign-offs there before it can reach Construction documents.",
    cta: "Open the project",
  },
  review: {
    eyebrow: "Approval needed",
    headline: "Review is waiting on sign-off",
    lead: "{project} has reached Review and is blocked until every sign-off is recorded.",
    action:
      "Review consumes no schedule time and has no delegate — it holds the project until all three approvals are in. Record each one from the project sheet. The client's approval is recorded by whoever speaks to them.",
    cta: "Record sign-off",
  },
  construction_documents: {
    eyebrow: "Phase started",
    headline: "Construction documents are underway",
    lead: "{project} cleared Review and has moved into Construction documents.",
    action:
      "You are the delegate for this phase. Move the project to Final review when the documents are complete.",
    cta: "Open the project",
  },
  final_review: {
    eyebrow: "Approval needed",
    headline: "Final review is waiting on sign-off",
    lead: "{project} has reached Final review.",
    action:
      "Final review is both a worked phase and an approval gate: it has a delegate and a duration, and it also needs two sign-offs before Permitting. The client does not sign off at this gate.",
    cta: "Record sign-off",
  },
  permitting: {
    eyebrow: "Phase started",
    headline: "Submitted for permitting",
    lead: "{project} has moved into Permitting.",
    action:
      "Timing here depends on the jurisdiction. When the permits come back approved, mark the project complete from the board — nothing advances it automatically.",
    cta: "Open the project",
  },
};

/** Internal copy for the archive step, which is not a board column. */
export const INTERNAL_COMPLETE_COPY: InternalCopy = {
  eyebrow: "Project complete",
  headline: "Permits approved — project archived",
  lead: "{project} has been marked complete and has left the board.",
  action:
    "The project stays readable and searchable under Completed projects. Nothing further is required.",
  cta: "View the project",
};

export type CustomerCopy = {
  /** Subject line, with `{project}` substituted. */
  subject: string;
  headline: string;
  /** What this stage is, in the client's terms. */
  lead: string;
  /** What we are doing during this stage. */
  during: string;
  /** What, if anything, we need back from them. Null where we need nothing. */
  fromYou: string | null;
};

/**
 * Keyed only by the phases flagged `customerVisible`. Review and Final review
 * are internal approval gates and have no customer copy — that absence is the
 * safeguard: there is no string here to accidentally send.
 */
export type CustomerPhase = Extract<
  DesignPhase,
  "schematic_design" | "design_development" | "construction_documents" | "permitting"
>;

export const CUSTOMER_COPY: Record<CustomerPhase, CustomerCopy> = {
  schematic_design: {
    subject: "{project}: schematic design has begun",
    headline: "We have started on your design",
    lead: "Your project has moved into Schematic Design, the first design stage.",
    during:
      "We are working through the overall layout — how the spaces sit together, how the building meets the site, and the general form and scale. Expect early plans and sketches rather than finished drawings.",
    fromYou:
      "We will be in touch to walk you through the first concepts. Your reactions at this stage are the cheapest changes you will ever make, so tell us plainly what does and does not feel right.",
  },
  design_development: {
    subject: "{project}: now in design development",
    headline: "Your design is moving into detail",
    lead: "Your project has moved into Design Development.",
    during:
      "The agreed layout now gets resolved: dimensions, materials, window and door types, and how the building is actually put together. The drawings get considerably more specific.",
    fromYou:
      "Decisions on finishes and fixtures start to matter here. We will flag the ones we need from you, and when they are needed by.",
  },
  construction_documents: {
    subject: "{project}: construction documents underway",
    headline: "We are preparing your construction documents",
    lead: "Your project has moved into Construction Documents.",
    during:
      "This is the full technical set — the drawings and specifications your builder will price and build from, and that the permitting office will review. It is the most detailed stage of the work.",
    fromYou:
      "Nothing is needed from you right now. If you are still selecting a builder, this is a good time to do it, since the completed set is what they will bid against.",
  },
  permitting: {
    subject: "{project}: submitted for permitting",
    headline: "Your drawings are with the permitting office",
    lead: "Your project has moved into Permitting.",
    during:
      "The completed set has been submitted for review. This stage is in the jurisdiction's hands rather than ours, and reviewers sometimes come back with comments we then address. We will let you know as soon as we hear.",
    fromYou:
      "Nothing is needed from you. We will let you know as soon as the permits are approved.",
  },
};

export const CUSTOMER_COMPLETE_COPY: CustomerCopy = {
  subject: "{project}: permits approved",
  headline: "Your permits have been approved",
  lead: "Your project has cleared permitting and our design work is complete.",
  during:
    "Every drawing and document produced for the project is on file with us. If your builder, lender or the jurisdiction needs a copy of anything, ask and we will send it over.",
  fromYou:
    "Thank you for trusting us with it. If anything comes up during construction that needs a drawing revisited, get in touch — we would rather hear early.",
};

/** Which gate returned the project, in internal language. */
export const GATE_LABEL: Record<GatePhase, string> = {
  review: "Review",
  final_review: "Final review",
};

/* ------------------------------------------------------------------ auth -- */

/**
 * Supabase auth mail — the invite and the password reset.
 *
 * These are the only two messages the app does not send itself: Supabase
 * renders them from templates pasted into its dashboard, so the copy here is
 * compiled to static HTML by `npm run email:supabase` rather than called at
 * runtime. Edited here, re-rendered, re-pasted. See `templates/auth-link.ts`.
 *
 * The vocabulary is a third one again. An invitee has never seen the board, so
 * "phase", "delegate" and "gate" mean nothing to them yet, and a password
 * reset has no project to name at all.
 */
export type AuthCopy = {
  /** Subject line, pasted into the dashboard's Subject field separately. */
  subject: string;
  eyebrow: string;
  headline: string;
  lead: string;
  /** Button label on the confirmation link. */
  cta: string;
  /** Title and body of the callout under the button. */
  noticeTitle: string;
  notice: string;
  /** The "wasn't me" line. Every credential mail needs one. */
  unexpected: string;
};

export type AuthKind = "invite" | "recovery";

export const AUTH_COPY: Record<AuthKind, AuthCopy> = {
  invite: {
    subject: "You have been invited to Merkhet",
    eyebrow: "Account invitation",
    headline: "You've been invited to Merkhet",
    lead: "Someone at Merkhet Architecture has created an account for you. Merkhet is the studio's project board — where every project is tracked from contract through design, review and permitting.",
    cta: "Accept the invitation",
    noticeTitle: "What happens next",
    notice:
      "The link opens a page where you choose your own password, and takes you to the board once it is set. It can only be used once. If it has already expired, ask an admin to send a new invite.",
    unexpected:
      "If you were not expecting this, you can ignore this message — the account cannot be used until the link is opened.",
  },
  recovery: {
    subject: "Reset your Merkhet password",
    eyebrow: "Password reset",
    headline: "Reset your password",
    lead: "We received a request to reset the password on the Merkhet account for this address.",
    cta: "Choose a new password",
    noticeTitle: "What happens next",
    notice:
      "The link opens a page where you set a new password and signs you in once it is saved. It can only be used once. If it has already expired, request another from the sign-in page.",
    unexpected:
      "If you did not ask for this, you can ignore this message — your current password stays as it is unless the link is used.",
  },
};
