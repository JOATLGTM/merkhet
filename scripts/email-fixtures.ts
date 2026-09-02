/**
 * Sample data for the email harnesses.
 *
 * Shared by `preview-emails.ts` (renders to disk) and `send-test-email.ts`
 * (sends through Gmail), so the message you look at and the message you send
 * are built from the same fixture.
 *
 * The addresses here are fixtures and are never used as real recipients —
 * `send-test-email.ts` overrides every recipient with `GMAIL_TEST_TO`. Two of
 * them resolve to a real domain, so that override is load-bearing.
 */
import {
  planGateRejected,
  planPhaseEntry,
  planProjectComplete,
  type Audiences,
  type EmailJob,
} from "../lib/email/plan";
import type { EmailPerson, EmailProject } from "../lib/email/render";

export const project: EmailProject = {
  id: "8f2b1c4a-0f3d-4a21-9c77-2b1f6d3a55e1",
  number: "MK-0412",
  name: "Ortega Residence — rear addition",
  customerName: "Ortega Residence",
  targetCompletion: "2026-12-18",
  onHold: false,
};

export const dana: EmailPerson = { name: "Dana Whitfield", email: "dana@merkhet.studio" };
export const marcus: EmailPerson = { name: "Marcus Reed", email: "marcus@merkhet.studio" };
export const chris: EmailPerson = { name: "Chris Alvarado", email: "chris@merkhet.studio" };
export const ines: EmailPerson = { name: "Ines Okafor", email: "ines@merkhet.studio" };
export const customer: EmailPerson = { name: "Luis Ortega", email: "luis.ortega@example.com" };

export const audiences = (delegate: EmailPerson | null): Audiences => ({
  delegate,
  customerContact: customer,
  phaseRecipients: [ines],
  leadership: [chris, marcus],
});

const sched = (s: string | null, e: string | null, d: number | null, h: number | null) => ({
  plannedStart: s,
  plannedEnd: e,
  durationDays: d,
  plannedHours: h,
});

export type EmailCase = {
  /** Two-digit key used by `--case`. */
  n: string;
  title: string;
  note: string;
  jobs: EmailJob[];
};

export const cases: EmailCase[] = [
  {
    n: "01",
    title: "Project created → Pending",
    note: "Pending is a hard gate. Nothing moves until a contract or LOI is uploaded, so the mail says exactly that.",
    jobs: planPhaseEntry({
      project,
      column: "pending",
      previousColumn: null,
      movedBy: "Chris Alvarado",
      schedule: null,
      audiences: audiences(null),
    }),
  },
  {
    n: "02",
    title: "Contract uploaded → Active",
    note: "Leadership only. Active is a holding state whose whole job is to raise the delegation form.",
    jobs: planPhaseEntry({
      project,
      column: "active",
      previousColumn: "pending",
      movedBy: "Chris Alvarado",
      schedule: null,
      audiences: audiences(null),
    }),
  },
  {
    n: "03",
    title: "→ Schematic design",
    note: "First customer-visible phase, so two messages: the delegate gets dates and hours, the client gets the stage explained.",
    jobs: planPhaseEntry({
      project,
      column: "schematic_design",
      previousColumn: "active",
      movedBy: "Chris Alvarado",
      schedule: sched("2026-08-24", "2026-09-11", 15, 48),
      audiences: audiences(dana),
    }),
  },
  {
    n: "04",
    title: "→ Design development",
    note: "Same pair. The client copy shifts from concept to decisions we will need back from them.",
    jobs: planPhaseEntry({
      project,
      column: "design_development",
      previousColumn: "schematic_design",
      movedBy: "Dana Whitfield",
      schedule: sched("2026-09-14", "2026-10-09", 20, 72),
      audiences: audiences(dana),
    }),
  },
  {
    n: "05",
    title: "→ Review",
    note: "Approval gate. Internal only — the sign-off checklist replaces the schedule block, and one approval is already recorded here.",
    jobs: planPhaseEntry({
      project,
      column: "review",
      previousColumn: "design_development",
      movedBy: "Dana Whitfield",
      schedule: sched("2026-10-09", "2026-10-09", null, null),
      approvedParties: ["austin"],
      audiences: audiences(null),
    }),
  },
  {
    n: "06",
    title: "Review rejected → Design development",
    note: "Internal, permanently. The client hears nothing until the project re-enters a visible phase. Dates shown are the re-planned ones.",
    jobs: planGateRejected({
      project,
      gate: "review",
      returnedTo: "design_development",
      rejectedBy: "Chris Alvarado",
      reason:
        "Client wants the rear elevation reworked — the roofline over the addition reads as a separate building rather than part of the house.",
      schedule: sched("2026-10-12", "2026-10-23", 10, 24),
      audiences: audiences(dana),
    }),
  },
  {
    n: "07",
    title: "→ Construction documents",
    note: "Client copy tells them nothing is needed, which is the useful thing to say when nothing is.",
    jobs: planPhaseEntry({
      project,
      column: "construction_documents",
      previousColumn: "review",
      movedBy: "Chris Alvarado",
      schedule: sched("2026-10-26", "2026-11-27", 25, 96),
      audiences: audiences(marcus),
    }),
  },
  {
    n: "08",
    title: "→ Final review",
    note: "The only column that is both a worked phase and a gate, so the internal mail carries the schedule block and the checklist together.",
    jobs: planPhaseEntry({
      project,
      column: "final_review",
      previousColumn: "construction_documents",
      movedBy: "Marcus Reed",
      schedule: sched("2026-11-30", "2026-12-04", 5, 12),
      approvedParties: [],
      audiences: audiences(marcus),
    }),
  },
  {
    n: "09",
    title: "→ Permitting",
    note: "Client copy sets expectations about jurisdiction timing without promising a date we do not control.",
    jobs: planPhaseEntry({
      project,
      column: "permitting",
      previousColumn: "final_review",
      movedBy: "Chris Alvarado",
      schedule: sched("2026-12-07", "2026-12-25", 15, 8),
      audiences: audiences(chris),
    }),
  },
  {
    n: "10",
    title: "Marked complete",
    note: "Last message the client receives, so it closes the engagement rather than pointing at a next step.",
    jobs: planProjectComplete({
      project,
      completedBy: "Chris Alvarado",
      completedOn: "2026-12-22",
      audiences: audiences(chris),
    }),
  },
  {
    n: "11",
    title: "Edge case — on hold, unassigned, no dates, no client address",
    note: "Every optional field empty. The delegate slot goes redline, dates read “Not scheduled”, and the customer mail is not produced at all.",
    jobs: planPhaseEntry({
      project: { ...project, onHold: true, targetCompletion: null },
      column: "schematic_design",
      previousColumn: "active",
      movedBy: "Chris Alvarado",
      schedule: null,
      audiences: { ...audiences(null), customerContact: null },
    }),
  },
];

export const findCase = (key: string): EmailCase | undefined =>
  cases.find((c) => c.n === key.padStart(2, "0"));
