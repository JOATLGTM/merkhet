/**
 * Customer-facing "your project has moved on" mail.
 *
 * Three rules this template exists to enforce:
 *
 * 1. **No link into the app.** Clients have no login and never will
 *    (WORKFLOW-2 §1), so any link would dead-end at `/login`. The reply
 *    address is the only call to action.
 * 2. **No internal vocabulary.** Stage names come from `customerLabel`, never
 *    `COLUMN_LABELS`; no delegate names, no board, no gates.
 * 3. **Customer-visible phases only.** The input type admits four phases, and
 *    `assertCustomerVisible` re-checks at runtime for callers coming from
 *    plain JS or a widened union.
 */
import {
  button,
  callout,
  divider,
  esc,
  eyebrow,
  heading,
  metaGrid,
  paragraph,
  projectHeader,
  row,
  shell,
  spacer,
} from "@/lib/email/layout";
import { CUSTOMER_COPY, type CustomerPhase } from "@/lib/email/copy";
import {
  customerTrack,
  customerTrackText,
  isCustomerVisible,
  phaseAccent,
} from "@/lib/email/progress";
import {
  formatDate,
  textFooter,
  textLines,
  TEXT_RULE,
  type EmailPerson,
  type EmailProject,
  type RenderedEmail,
} from "@/lib/email/render";
import { COLOR, FIRM, FONT } from "@/lib/email/tokens";
import { PHASE_PRESENTATION } from "@/lib/phases";
import type { DesignPhase } from "@/lib/types";

export type PhaseEntryCustomerInput = {
  project: EmailProject;
  phase: CustomerPhase;
  /** When we expect this stage to finish. Omitted from the mail when unknown. */
  expectedEnd: string | null;
  /**
   * The internal staff member who owns the client relationship — the person
   * signing the message. Not the phase delegate: the client hears from one
   * voice regardless of who is doing the drawing.
   */
  clientContact: EmailPerson | null;
};

/** Guards the one mistake that matters here: mailing a client about a gate. */
export function assertCustomerVisible(phase: DesignPhase): asserts phase is CustomerPhase {
  if (!isCustomerVisible(phase)) {
    throw new Error(
      `Refusing to render customer mail for "${phase}" — it is an internal approval gate (lib/phases.ts customerVisible=false).`,
    );
  }
}

export function renderPhaseEntryCustomer(
  input: PhaseEntryCustomerInput,
): RenderedEmail {
  const { project, phase, expectedEnd, clientContact } = input;
  assertCustomerVisible(phase);

  const copy = CUSTOMER_COPY[phase];
  const stage = PHASE_PRESENTATION[phase].customerLabel;
  const subject = copy.subject.replace("{project}", project.name);
  const preview = copy.lead;

  const signature = clientContact
    ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:${FONT.sans};font-size:14px;line-height:21px;color:${COLOR.ink};">
              <div style="font-weight:600;">${esc(clientContact.name)}</div>
              <div style="color:${COLOR.inkMid};">${esc(FIRM.name)}</div>
              ${clientContact.email ? `<div style="margin-top:4px;"><a href="mailto:${esc(clientContact.email)}" style="color:${COLOR.phase5};text-decoration:none;">${esc(clientContact.email)}</a></div>` : ""}
            </td>
          </tr>
        </table>`
    : "";

  const meta = [
    {
      label: `${stage} expected to finish`,
      value: expectedEnd ? formatDate(expectedEnd) : "We will confirm shortly",
    },
    {
      label: "Estimated completion",
      value: project.targetCompletion
        ? formatDate(project.targetCompletion)
        : "We will confirm shortly",
    },
  ];

  const body = [
    row(
      `${eyebrow("Project update")}${heading(copy.headline)}`,
      "22px 32px 0 32px",
    ),
    row(
      projectHeader({
        projectNumber: project.number,
        projectName: project.name,
      }),
    ),
    row(customerTrack(phase)),
    row(paragraph(esc(copy.lead), COLOR.ink)),
    row(paragraph(esc(copy.during)), "10px 32px 0 32px"),
    row(`${spacer(6)}${metaGrid(meta)}`),
    copy.fromYou
      ? row(
          callout({
            accent: COLOR.phase5,
            title: "What happens next",
            body: esc(copy.fromYou),
          }),
        )
      : "",
    row(
      button("Reply to your project team", `mailto:${clientContact?.email ?? FIRM.replyTo}`),
      "24px 32px 0 32px",
    ),
    signature ? row(`${divider()}${spacer(18)}${signature}`, "0 32px 26px 32px") : row("", "0 32px 26px 32px"),
  ].join("");

  const html = shell({
    title: subject,
    preview,
    audience: "customer",
    accent: phaseAccent(phase),
    body,
  });

  const text = textLines(
    copy.headline,
    TEXT_RULE,
    `${project.name}  (${project.number})`,
    "",
    copy.lead,
    "",
    copy.during,
    "",
    customerTrackText(phase),
    "",
    ...meta.map((item) => `${item.label}: ${item.value}`),
    copy.fromYou ? `\nWHAT HAPPENS NEXT\n${copy.fromYou}` : null,
    clientContact
      ? textLines(
          "",
          clientContact.name,
          FIRM.name,
          clientContact.email ?? FIRM.replyTo,
        )
      : null,
    textFooter("customer"),
  );

  return { subject, preview, html, text };
}
