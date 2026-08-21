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
  email: RenderedEmail;
};

/** Recipients a caller resolves before planning. */
export type Audiences = {
  /** Delegate on the phase being entered, when it has one. */
  delegate: EmailPerson | null;
  /** Internal staff member who owns the client relationship. */
  clientContact: EmailPerson | null;
  /** The external client — `customers.contact_name` / `contact_email`. */
  customerContact: EmailPerson | null;
  /**
   * Standing baseline from `phase_subscribers`. Demoted by WORKFLOW-2 §4 to a
   * copy list underneath delegate resolution — never the routing model.
   */
  subscribers?: EmailPerson[];
  /** Copied on Active, Permitting and completion. In practice Ryan and Austin. */
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
  input: Omit<PhaseEntryInternalInput, "delegate"> & {
    audiences: Audiences;
    /** Expected end of the entered phase, shown to the customer. */
    expectedEnd?: string | null;
  },
): EmailJob[] {
  const { audiences, expectedEnd, ...rest } = input;
  const { delegate, clientContact, customerContact } = audiences;
  const subscribers = audiences.subscribers ?? [];
  const leadership = audiences.leadership ?? [];
  const column = input.column;
  const phase = isPhase(column) ? column : null;
  const isGate = phase === "review" || phase === "final_review";

  const jobs: EmailJob[] = [];

  /* Internal — the delegate first, then the standing copy list. Gates have no
     delegate, so the client contact and leadership carry them instead. */
  const internalTo = recipients(
    delegate,
    ...(isGate ? [clientContact] : []),
    ...(LEADERSHIP_COLUMNS.has(column) || isGate ? leadership : []),
    ...subscribers,
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
      email: renderPhaseEntryCustomer({
        project: input.project,
        phase: phase as CustomerPhase,
        expectedEnd: expectedEnd ?? input.schedule?.plannedEnd ?? null,
        clientContact,
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
  const { delegate, clientContact } = audiences;

  return [
    {
      template: "gate-rejected",
      audience: "internal",
      to: recipients(delegate, clientContact, ...(audiences.subscribers ?? [])),
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
  const { clientContact, customerContact } = audiences;

  const jobs: EmailJob[] = [
    {
      template: "project-complete",
      audience: "internal",
      to: recipients(
        clientContact,
        ...(audiences.leadership ?? []),
        ...(audiences.subscribers ?? []),
      ),
      email: renderProjectComplete({
        project,
        audience: "internal",
        completedBy,
        completedOn,
        clientContact,
      }),
    },
  ];

  if (customerContact?.email) {
    jobs.push({
      template: "project-complete",
      audience: "customer",
      to: recipients(customerContact),
      email: renderProjectComplete({
        project,
        audience: "customer",
        completedOn,
        clientContact,
      }),
    });
  }

  return jobs;
}
