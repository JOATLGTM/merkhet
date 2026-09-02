/**
 * Which emails a transition produces, and who each one goes to.
 *
 * **This module sends nothing.** It is a pure function from "what happened"
 * to a list of rendered messages with recipients attached — the boundary
 * Slice 6 asked for, so the provider, the outbox and any review-before-send
 * step can be added later without touching template or routing logic.
 *
 * Recipients are passed in rather than looked up. Resolution is a database
 * concern (`lib/db/repo.ts`), and keeping it out of here is what lets the
 * whole routing table be exercised without a connection.
 *
 * Routing follows WORKFLOW-2 §4, with one scope decision recorded on top of
 * it: the customer is mailed on **every customer-visible phase** plus
 * completion, not only DD/CD/Permitting. `customerVisible` in `lib/phases.ts`
 * is the switch — Review and Final review are false and therefore silent.
 *
 * Client jobs also carry a `reviewTo` — the project owner — which `send.ts`
 * delivers to while client mail is switched off. Routing names the stand-in;
 * it does not decide whether one is used, which keeps this module pure.
 */
import {
  renderGateRejected,
  renderPhaseEntryCustomer,
  renderPhaseEntryInternal,
  renderProjectComplete,
  type GateRejectedInput,
  type PhaseEntryInternalInput,
} from "@/lib/email/templates";
import type { CustomerPhase } from "@/lib/email/copy";
import { isCustomerVisible } from "@/lib/email/progress";
import type {
  EmailAudience,
  EmailPerson,
  EmailProject,
  RenderedEmail,
} from "@/lib/email/render";
import { DESIGN_PHASES, type BoardColumn, type DesignPhase } from "@/lib/types";

export type EmailTemplateName =
  | "phase-entry-internal"
  | "phase-entry-customer"
  | "gate-rejected"
  | "project-complete";

export type EmailJob = {
  template: EmailTemplateName;
  audience: EmailAudience;
  /** Resolved recipients. Anyone without an address is dropped, not guessed. */
  to: EmailPerson[];
  /**
   * Where to deliver instead while the audience is not cleared for real
   * delivery. Set on client jobs only; `send.ts` decides whether to use it.
   * Routing stays pure — it names the fallback, it does not read the switch.
   */
  reviewTo?: EmailPerson[];
  email: RenderedEmail;
};

/** Recipients a caller resolves before planning. */
export type Audiences = {
  /** Delegate on the phase being entered, when it has one. */
  delegate: EmailPerson | null;
  /** The external client — `customers.contact_name` / `contact_email`. */
  customerContact: EmailPerson | null;
  /**
   * Whoever filed the project (`projects.created_by`). Not a routing party —
   * they receive client mail only as the stand-in recipient while client
   * delivery is switched off. See `send.ts`.
   */
  owner?: EmailPerson | null;
  /**
   * Staff chosen per project in Plan schedule to be copied on this phase,
   * alongside the delegate (`project_phase_recipients`). Never the routing
   * model — a copy list underneath delegate resolution. Empty for Pending and
   * Active, which have no phase row to hang a list on.
   */
  phaseRecipients?: EmailPerson[];
  /** Copied on Active, Permitting, the two gates and completion. Active admins. */
  leadership?: EmailPerson[];
};

const isPhase = (column: BoardColumn): column is DesignPhase =>
  (DESIGN_PHASES as string[]).includes(column);

/** Dedupe by address, drop anyone unaddressable, preserve order. */
function recipients(...people: Array<EmailPerson | null | undefined>): EmailPerson[] {
  const seen = new Set<string>();
  const out: EmailPerson[] = [];
  for (const person of people) {
    const key = person?.email?.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(person!);
  }
  return out;
}

/** Columns where leadership is copied regardless of who the delegate is. */
const LEADERSHIP_COLUMNS = new Set<BoardColumn>(["active", "permitting"]);

/**
 * A project entered a column. Produces the internal mail always, and the
 * customer mail when the column is a customer-visible phase.
 */
export function planPhaseEntry(
  input: Omit<PhaseEntryInternalInput, "delegate"> & { audiences: Audiences },
): EmailJob[] {
  const { audiences, ...rest } = input;
  const { delegate, customerContact } = audiences;
  const phaseRecipients = audiences.phaseRecipients ?? [];
  const leadership = audiences.leadership ?? [];
  const column = input.column;
  const phase = isPhase(column) ? column : null;
  const isGate = phase === "review" || phase === "final_review";

  const jobs: EmailJob[] = [];

  /* Internal — the delegate first, then the project's copy list for the
     phase. Review has no delegate and no list, so leadership carries it. */
  const internalTo = recipients(
    delegate,
    ...(LEADERSHIP_COLUMNS.has(column) || isGate ? leadership : []),
    ...phaseRecipients,
  );

  jobs.push({
    template: "phase-entry-internal",
    audience: "internal",
    to: internalTo,
    email: renderPhaseEntryInternal({ ...rest, delegate }),
  });

  /* Customer — customer-visible phases only, and only if we hold an address. */
  if (phase && isCustomerVisible(phase) && customerContact?.email) {
    jobs.push({
      template: "phase-entry-customer",
      audience: "customer",
      to: recipients(customerContact),
      reviewTo: recipients(audiences.owner),
      email: renderPhaseEntryCustomer({
        project: input.project,
        phase: phase as CustomerPhase,
      }),
    });
  }

  return jobs;
}

/** A gate was rejected. Internal only — see the note in `gate-rejected.ts`. */
export function planGateRejected(
  input: Omit<GateRejectedInput, "delegate"> & { audiences: Audiences },
): EmailJob[] {
  const { audiences, ...rest } = input;
  const { delegate } = audiences;

  return [
    {
      template: "gate-rejected",
      audience: "internal",
      to: recipients(delegate, ...(audiences.phaseRecipients ?? [])),
      email: renderGateRejected({ ...rest, delegate }),
    },
  ];
}

/** A project was marked complete. Both audiences. */
export function planProjectComplete(input: {
  project: EmailProject;
  completedBy: string;
  completedOn: string | null;
  audiences: Audiences;
}): EmailJob[] {
  const { project, completedBy, completedOn, audiences } = input;
  const { customerContact } = audiences;

  const jobs: EmailJob[] = [
    {
      template: "project-complete",
      audience: "internal",
      to: recipients(
        ...(audiences.leadership ?? []),
        ...(audiences.phaseRecipients ?? []),
      ),
      email: renderProjectComplete({
        project,
        audience: "internal",
        completedBy,
        completedOn,
      }),
    },
  ];

  if (customerContact?.email) {
    jobs.push({
      template: "project-complete",
      audience: "customer",
      to: recipients(customerContact),
      reviewTo: recipients(audiences.owner),
      email: renderProjectComplete({
        project,
        audience: "customer",
        completedOn,
      }),
    });
  }

  return jobs;
}
