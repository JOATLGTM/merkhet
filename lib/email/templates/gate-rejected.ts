/**
 * Internal rework mail — a Review or Final review gate was rejected and the
 * project has gone back a phase.
 *
 * **Internal only, always.** There is no customer variant and there should
 * never be one: rejection is the firm's own quality loop, and a client
 * reading "your project was rejected" would misread an ordinary internal
 * correction as a failure. The customer simply hears nothing until the
 * project re-enters a customer-visible phase.
 *
 * The dates shown are the *re-planned* ones. `rejectGate` re-derives the
 * remaining schedule from today (`SLICE_5_APPLY.md` §3), so the delegate is
 * being told a new end date, not the old one.
 */
import {
  button,
  callout,
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
import { GATE_LABEL } from "@/lib/email/copy";
import { phaseRule } from "@/lib/email/progress";
import {
  formatDateRange,
  formatDuration,
  textFooter,
  textLines,
  TEXT_RULE,
  type EmailPerson,
  type EmailPhaseSchedule,
  type EmailProject,
  type RenderedEmail,
} from "@/lib/email/render";
import { COLOR, projectUrl } from "@/lib/email/tokens";
import { COLUMN_LABELS, type DesignPhase, type GatePhase } from "@/lib/types";

export type GateRejectedInput = {
  project: EmailProject;
  /** The gate that was rejected. */
  gate: GatePhase;
  /** Where the project went back to — DD for Review, CD for Final review. */
  returnedTo: DesignPhase;
  /** Delegate of the phase being returned to. The primary recipient. */
  delegate: EmailPerson | null;
  /** Who recorded the rejection. */
  rejectedBy: string;
  /** Free-text reason, when one was given. */
  reason: string | null;
  /** Re-derived schedule for the phase being returned to. */
  schedule: EmailPhaseSchedule | null;
};

export function renderGateRejected(input: GateRejectedInput): RenderedEmail {
  const { project, gate, returnedTo, delegate, rejectedBy, reason, schedule } = input;

  const gateLabel = GATE_LABEL[gate];
  const targetLabel = COLUMN_LABELS[returnedTo];
  const subject = `${project.number} · back to ${targetLabel} · ${gateLabel} rejected`;
  const preview = `${rejectedBy} sent ${project.number} back to ${targetLabel} for rework.`;

  const meta: MetaItem[] = [
    {
      label: "Now with",
      value: delegate?.name ?? "Unassigned",
      accent: delegate ? COLOR.ink : COLOR.redline,
    },
    { label: "Rejected by", value: rejectedBy },
    {
      label: "Re-planned dates",
      value: formatDateRange(
        schedule?.plannedStart ?? null,
        schedule?.plannedEnd ?? null,
      ),
    },
    { label: "Duration", value: formatDuration(schedule?.durationDays ?? null) },
  ];

  const body = [
    row(
      `${eyebrow(`${gateLabel} rejected`, COLOR.redline)}${heading(`Back to ${targetLabel.toLowerCase()} for rework`)}`,
      "22px 32px 0 32px",
    ),
    row(
      projectHeader({
        projectNumber: project.number,
        projectName: project.name,
        customerName: project.customerName,
      }),
    ),
    row(phaseRule(returnedTo)),
    row(
      paragraph(
        `${esc(project.number)} did not clear <strong style="color:${COLOR.ink};">${esc(gateLabel)}</strong> and has been returned to <strong style="color:${COLOR.ink};">${esc(targetLabel)}</strong>.`,
        COLOR.ink,
      ),
    ),
    reason
      ? row(
          callout({
            accent: COLOR.redline,
            title: "Reason given",
            body: esc(reason),
          }),
        )
      : "",
    row(`${spacer(4)}${metaGrid(meta)}`),
    row(
      callout({
        accent: COLOR.phase5,
        title: "What this changed",
        body:
          `The ${esc(gateLabel.toLowerCase())} sign-offs have been cleared, so the gate has to be approved again on the next pass. ` +
          `Remaining dates were re-planned from today — the schedule above is the new one, not the original.`,
      }),
    ),
    row(button("Open the project", projectUrl(project.id)), "24px 32px 26px 32px"),
  ].join("");

  const html = shell({
    title: subject,
    preview,
    audience: "internal",
    accent: COLOR.redline,
    body,
  });

  const text = textLines(
    `${gateLabel.toUpperCase()} REJECTED — BACK TO ${targetLabel.toUpperCase()}`,
    TEXT_RULE,
    `${project.number}  ${project.name}`,
    project.customerName,
    "",
    `${project.number} did not clear ${gateLabel} and has been returned to ${targetLabel}.`,
    reason ? `\nREASON GIVEN\n${reason}` : null,
    "",
    ...meta.map((item) => `${item.label}: ${item.value}`),
    "",
    `The ${gateLabel.toLowerCase()} sign-offs have been cleared and must be recorded again on the next pass.`,
    "Remaining dates were re-planned from today — the dates above are the new ones.",
    "",
    `Open the project: ${projectUrl(project.id)}`,
    textFooter("internal"),
  );

  return { subject, preview, html, text };
}
