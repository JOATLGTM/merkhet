/**
 * Project marked complete — the one event both audiences hear about, so both
 * variants live in one file where the copy can be compared side by side.
 *
 * Internal: the project has left the board and is archived.
 * Customer: permits are approved and the engagement is finished. This is the
 * last message they receive, so it carries the sign-off rather than a
 * "what happens next".
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
  type MetaItem,
} from "@/lib/email/layout";
import { CUSTOMER_COMPLETE_COPY, INTERNAL_COMPLETE_COPY } from "@/lib/email/copy";
import { customerTrack, customerTrackText, phaseRule } from "@/lib/email/progress";
import {
  formatDate,
  textFooter,
  textLines,
  TEXT_RULE,
  type EmailAudience,
  type EmailPerson,
  type EmailProject,
  type RenderedEmail,
} from "@/lib/email/render";
import { COLOR, FIRM, FONT, projectUrl } from "@/lib/email/tokens";

export type ProjectCompleteInput = {
  project: EmailProject;
  audience: EmailAudience;
  /** Who marked it complete. Internal variant only. */
  completedBy?: string;
  /** Date it was archived. */
  completedOn: string | null;
  /** Signs the customer variant. */
  clientContact: EmailPerson | null;
};

export function renderProjectComplete(input: ProjectCompleteInput): RenderedEmail {
  return input.audience === "customer" ? customerVariant(input) : internalVariant(input);
}

/* ---------------------------------------------------------------- internal -- */

function internalVariant(input: ProjectCompleteInput): RenderedEmail {
  const { project, completedBy, completedOn } = input;
  const copy = INTERNAL_COMPLETE_COPY;
  const projectLabel = `${project.number} ${project.name}`;
  const subject = `${project.number} · complete · ${project.name}`;
  const preview = copy.lead.replace("{project}", projectLabel);

  const meta: MetaItem[] = [
    { label: "Completed by", value: completedBy ?? "—" },
    { label: "Completed on", value: completedOn ? formatDate(completedOn) : "—" },
    { label: "Customer", value: project.customerName },
    {
      label: "Target completion",
      value: project.targetCompletion ? formatDate(project.targetCompletion) : "Not set",
    },
  ];

  const body = [
    row(`${eyebrow(copy.eyebrow, COLOR.phase5)}${heading(copy.headline)}`, "22px 32px 0 32px"),
    row(
      projectHeader({
        projectNumber: project.number,
        projectName: project.name,
        customerName: project.customerName,
      }),
    ),
    row(phaseRule("permitting")),
    row(paragraph(esc(copy.lead.replace("{project}", projectLabel)), COLOR.ink)),
    row(`${spacer(4)}${metaGrid(meta)}`),
    copy.action
      ? row(callout({ accent: COLOR.phase5, title: "Where it lives now", body: esc(copy.action) }))
      : "",
    row(button(copy.cta, projectUrl(project.id)), "24px 32px 26px 32px"),
  ].join("");

  return {
    subject,
    preview,
    html: shell({
      title: subject,
      preview,
      audience: "internal",
      accent: COLOR.phase6,
      body,
    }),
    text: textLines(
      copy.headline.toUpperCase(),
      TEXT_RULE,
      `${project.number}  ${project.name}`,
      project.customerName,
      "",
      copy.lead.replace("{project}", projectLabel),
      "",
      ...meta.map((item) => `${item.label}: ${item.value}`),
      copy.action ? `\n${copy.action}` : null,
      "",
      `${copy.cta}: ${projectUrl(project.id)}`,
      textFooter("internal"),
    ),
  };
}

/* ---------------------------------------------------------------- customer -- */

function customerVariant(input: ProjectCompleteInput): RenderedEmail {
  const { project, clientContact } = input;
  const copy = CUSTOMER_COMPLETE_COPY;
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

  const body = [
    row(`${eyebrow("Project complete", COLOR.phase5)}${heading(copy.headline)}`, "22px 32px 0 32px"),
    row(projectHeader({ projectNumber: project.number, projectName: project.name })),
    row(customerTrack(null, true)),
    row(paragraph(esc(copy.lead), COLOR.ink)),
    row(paragraph(esc(copy.during)), "10px 32px 0 32px"),
    copy.fromYou
      ? row(callout({ accent: COLOR.phase5, title: "Thank you", body: esc(copy.fromYou) }))
      : "",
    row(
      button("Reply to your project team", `mailto:${clientContact?.email ?? FIRM.replyTo}`),
      "24px 32px 0 32px",
    ),
    signature
      ? row(`${divider()}${spacer(18)}${signature}`, "0 32px 26px 32px")
      : row("", "0 32px 26px 32px"),
  ].join("");

  return {
    subject,
    preview,
    html: shell({
      title: subject,
      preview,
      audience: "customer",
      accent: COLOR.phase6,
      body,
    }),
    text: textLines(
      copy.headline,
      TEXT_RULE,
      `${project.name}  (${project.number})`,
      "",
      copy.lead,
      "",
      copy.during,
      "",
      customerTrackText(null, true),
      copy.fromYou ? `\n${copy.fromYou}` : null,
      clientContact
        ? textLines("", clientContact.name, FIRM.name, clientContact.email ?? FIRM.replyTo)
        : null,
      textFooter("customer"),
    ),
  };
}
