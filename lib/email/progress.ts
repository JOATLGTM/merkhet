/**
 * Progress indicators — the one strongly branded element in these mails, and
 * the reason the internal and customer templates cannot share a single
 * component.
 *
 * Internal mail shows all six phases (`DESIGN_PHASES`), gates included,
 * matching `components/projects/phase-rule.tsx`.
 *
 * Customer mail shows only the phases flagged `customerVisible` in
 * `lib/phases.ts` — Review and Final Review are internal approval gates and
 * are deliberately invisible to the client. Rendering the six-segment rule to
 * a customer would leak both.
 */
import { COLOR, FONT } from "@/lib/email/tokens";
import { esc } from "@/lib/email/layout";
import { PHASE_PRESENTATION } from "@/lib/phases";
import { DESIGN_PHASES, type DesignPhase } from "@/lib/types";

const PHASE_COLOR: Record<DesignPhase, string> = {
  schematic_design: COLOR.phase1,
  design_development: COLOR.phase2,
  review: COLOR.phase3,
  construction_documents: COLOR.phase4,
  final_review: COLOR.phase5,
  permitting: COLOR.phase6,
};

/** Phases a client is ever told about, in order. */
export const CUSTOMER_PHASES: DesignPhase[] = DESIGN_PHASES.filter(
  (phase) => PHASE_PRESENTATION[phase].customerVisible,
);

export function isCustomerVisible(phase: DesignPhase): boolean {
  return PHASE_PRESENTATION[phase].customerVisible;
}

/** The accent colour for a phase, used on the shell's top stripe. */
export function phaseAccent(phase: DesignPhase | null): string {
  return phase ? PHASE_COLOR[phase] : COLOR.ruleStrong;
}

/**
 * Six-segment rule, filled through the current phase. 2px gutters are real
 * cells rather than `border-spacing`, which Outlook ignores.
 */
export function phaseRule(current: DesignPhase | null): string {
  const currentIndex = current ? DESIGN_PHASES.indexOf(current) : -1;

  const cells = DESIGN_PHASES.map((phase, index) => {
    const filled = index <= currentIndex;
    const bg = filled ? PHASE_COLOR[phase] : COLOR.rule;
    const gutter =
      index < DESIGN_PHASES.length - 1
        ? `<td width="2" style="width:2px;font-size:0;line-height:0;">&nbsp;</td>`
        : "";
    return `<td height="3" style="height:3px;line-height:3px;font-size:0;background-color:${bg};">&nbsp;</td>${gutter}`;
  }).join("");

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
          <tr>${cells}</tr>
        </table>`;
}

/**
 * Customer-facing step track: four labelled stages with the current one
 * marked. Labels come from `customerLabel`, never from `COLUMN_LABELS` —
 * the client vocabulary is a separate, reviewable string set.
 */
export function customerTrack(current: DesignPhase | null, complete = false): string {
  const currentIndex = current ? CUSTOMER_PHASES.indexOf(current) : -1;

  const bars = CUSTOMER_PHASES.map((phase, index) => {
    const done = complete || index <= currentIndex;
    const isCurrent = !complete && index === currentIndex;
    const bg = done ? (isCurrent ? COLOR.phase5 : COLOR.phase3) : COLOR.rule;
    const gutter =
      index < CUSTOMER_PHASES.length - 1
        ? `<td width="4" style="width:4px;font-size:0;line-height:0;">&nbsp;</td>`
        : "";
    return `<td height="4" style="height:4px;line-height:4px;font-size:0;background-color:${bg};">&nbsp;</td>${gutter}`;
  }).join("");

  const labels = CUSTOMER_PHASES.map((phase, index) => {
    const isCurrent = !complete && index === currentIndex;
    const done = complete || index < currentIndex;
    const color = isCurrent ? COLOR.ink : done ? COLOR.inkMid : COLOR.inkSoft;
    const weight = isCurrent ? "600" : "400";
    const gutter =
      index < CUSTOMER_PHASES.length - 1
        ? `<td width="4" style="width:4px;font-size:0;line-height:0;">&nbsp;</td>`
        : "";
    return `<td valign="top" style="padding-top:8px;font-family:${FONT.sans};font-size:10px;line-height:14px;font-weight:${weight};letter-spacing:0.3px;color:${color};">${esc(PHASE_PRESENTATION[phase].customerLabel)}</td>${gutter}`;
  }).join("");

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
          <tr>${bars}</tr>
          <tr>${labels}</tr>
        </table>`;
}

/** Plain-text equivalent of the customer track, for the text alternative. */
export function customerTrackText(current: DesignPhase | null, complete = false): string {
  const currentIndex = current ? CUSTOMER_PHASES.indexOf(current) : -1;
  return CUSTOMER_PHASES.map((phase, index) => {
    const label = PHASE_PRESENTATION[phase].customerLabel;
    if (complete) return `  [x] ${label}`;
    if (index < currentIndex) return `  [x] ${label}`;
    if (index === currentIndex) return `  [>] ${label}  <- current`;
    return `  [ ] ${label}`;
  }).join("\n");
}
