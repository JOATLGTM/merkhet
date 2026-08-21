/**
 * Internal "project entered a phase" mail.
 *
 * One template covers all eight columns because the frame is identical and
 * only the middle block changes. Three body variants:
 *
 * - **delegated** (SD, DD, CD, Final review, Permitting) — who owns it, the
 *   dates delegation derived, and the planned hours.
 * - **gate** (Review, Final review) — the sign-offs standing between the
 *   project and the next phase. Final review is both, and gets both blocks.
 * - **holding** (Pending, Active) — no phase, no delegate; the block explains
 *   the gate that is holding the project where it is.
 */
import {
  button,
  callout,
  checklist,
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
import { INTERNAL_COPY } from "@/lib/email/copy";
import { phaseAccent, phaseRule } from "@/lib/email/progress";
import {
  formatDate,
  formatDateRange,
  formatDuration,
  formatHours,
  GATE_SET,
  textFooter,
  textLines,
  TEXT_RULE,
  type EmailPerson,
  type EmailPhaseSchedule,
  type EmailProject,
  type RenderedEmail,
} from "@/lib/email/render";
import { COLOR } from "@/lib/email/tokens";
import {
  BOARD_COLUMNS,
  COLUMN_LABELS,
  DESIGN_PHASES,
  GATE_PARTIES,
  PARTY_LABELS,
  isGatePhase,
  type ApprovalParty,
  type BoardColumn,
  type DesignPhase,
} from "@/lib/types";
import { projectUrl } from "@/lib/email/tokens";

export type PhaseEntryInternalInput = {
  project: EmailProject;
  /** The column the project just entered. */
  column: BoardColumn;
  /** Where it came from. Null on creation. */
  previousColumn: BoardColumn | null;
  /** Display name of whoever made the move. */
  movedBy: string;
  /** Delegate on the entered phase. Null on Pending, Active and Review. */
  delegate: EmailPerson | null;
  /** Derived schedule for the entered phase, when it has one. */
  schedule: EmailPhaseSchedule | null;
  /** Parties that have already signed off. Gate columns only. */
  approvedParties?: ApprovalParty[];
};

const isPhase = (column: BoardColumn): column is DesignPhase =>
  (DESIGN_PHASES as string[]).includes(column);

export function renderPhaseEntryInternal(
  input: PhaseEntryInternalInput,
): RenderedEmail {
  const { project, column, previousColumn, movedBy, delegate, schedule } = input;
  const copy = INTERNAL_COPY[column];
  const phase = isPhase(column) ? column : null;
  const label = COLUMN_LABELS[column];
  const isGate = phase != null && GATE_SET.has(phase);
  const projectLabel = `${project.number} ${project.name}`;

  const subject = isGate
    ? `${project.number} · ${label} needs sign-off · ${project.name}`
    : `${project.number} · ${label} · ${project.name}`;

  const preview = copy.lead.replace("{project}", projectLabel);

  /* ------------------------------------------------------------ meta grid -- */

  const meta: MetaItem[] = [];
  if (phase != null && !isGate) {
    meta.push({
      label: "Delegate",
      value: delegate?.name ?? "Unassigned",
      accent: delegate ? COLOR.ink : COLOR.redline,
    });
    meta.push({
      label: "Scheduled",
      value: formatDateRange(
        schedule?.plannedStart ?? null,
        schedule?.plannedEnd ?? null,
      ),
    });
    meta.push({ label: "Duration", value: formatDuration(schedule?.durationDays ?? null) });
    meta.push({ label: "Planned hours", value: formatHours(schedule?.plannedHours ?? null) });
  }
  meta.push({
    label: "Moved by",
    value: previousColumn ? `${movedBy}, from ${COLUMN_LABELS[previousColumn]}` : movedBy,
  });
  meta.push({
    label: "Target completion",
    value: project.targetCompletion ? formatDate(project.targetCompletion) : "Not set",
  });

  /* ---------------------------------------------------------- gate block -- */

  let gateBlock = "";
  let gateText = "";
  if (isGate && isGatePhase(phase)) {
    const approved = new Set(input.approvedParties ?? []);
    const items = GATE_PARTIES[phase].map((party: ApprovalParty) => ({
      label: PARTY_LABELS[party],
      done: approved.has(party),
      note:
        party === "client"
          ? "recorded by staff on the client's behalf"
          : undefined,
    }));
    const outstanding = items.filter((i) => !i.done).length;
    gateBlock =
      row(
        `${eyebrow(
          outstanding === 0
            ? "All sign-offs recorded"
            : `${outstanding} sign-off${outstanding === 1 ? "" : "s"} outstanding`,
          outstanding === 0 ? COLOR.phase5 : COLOR.warn,
        )}${spacer(8)}${checklist(items)}`,
      ) + row(divider(), "0 32px 0 32px");
    gateText = textLines(
      "",
      outstanding === 0
        ? "SIGN-OFFS — all recorded"
        : `SIGN-OFFS — ${outstanding} outstanding`,
      ...items.map(
        (i) => `  ${i.done ? "[x]" : "[ ]"} ${i.label}${i.note ? ` (${i.note})` : ""}`,
      ),
    );
  }

  /* -------------------------------------------------------------- on hold -- */

  const holdBlock = project.onHold
    ? row(
        callout({
          accent: COLOR.warn,
          title: "This project is on hold",
          body: "It carries the hold flag, so the dates below will drift until it is taken off hold.",
        }),
      )
    : "";

  const ruleCaption =
    phase != null
      ? `Phase ${DESIGN_PHASES.indexOf(phase) + 1} of ${DESIGN_PHASES.length} &middot; ${esc(label)}`
      : `${esc(label)} &middot; ${esc(String(BOARD_COLUMNS.indexOf(column) + 1))} of ${BOARD_COLUMNS.length} columns`;

  const body = [
    row(
      `${eyebrow(copy.eyebrow, phaseAccent(phase) === COLOR.phase1 ? COLOR.phase5 : COLOR.inkSoft)}${heading(copy.headline)}`,
      "22px 32px 0 32px",
    ),
    row(projectHeader({
      projectNumber: project.number,
      projectName: project.name,
      customerName: project.customerName,
    })),
    row(
      `${phaseRule(phase)}<div style="margin-top:8px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:${COLOR.inkSoft};">${ruleCaption}</div>`,
    ),
    row(paragraph(esc(copy.lead.replace("{project}", projectLabel)), COLOR.ink)),
    holdBlock,
    row(`${spacer(4)}${metaGrid(meta)}`),
    gateBlock,
    copy.action
      ? row(
          callout({
            accent: isGate ? COLOR.warn : COLOR.phase5,
            title: isGate ? "What unblocks it" : "What happens next",
            body: esc(copy.action),
          }),
        )
      : "",
    row(button(copy.cta, projectUrl(project.id)), "24px 32px 26px 32px"),
  ].join("");

  const html = shell({
    title: subject,
    preview,
    audience: "internal",
    accent: phase ? phaseAccent(phase) : COLOR.ruleStrong,
    body,
  });

  const text = textLines(
    copy.headline.toUpperCase(),
    TEXT_RULE,
    `${project.number}  ${project.name}`,
    project.customerName,
    "",
    copy.lead.replace("{project}", projectLabel),
    project.onHold
      ? "\nNOTE: this project is on hold — the dates below will drift until it is taken off hold."
      : null,
    "",
    ...meta.map((item) => `${item.label}: ${item.value}`),
    gateText,
    copy.action ? `\n${copy.action}` : null,
    "",
    `${copy.cta}: ${projectUrl(project.id)}`,
    textFooter("internal"),
  );

  return { subject, preview, html, text };
}
