/**
 * Email design tokens.
 *
 * Deliberately literal hex, not `var(--phase-5)`: custom properties are
 * unsupported in Outlook (Word engine) and stripped by several webmail
 * sanitisers, so every colour has to be inlined at its final value. These
 * mirror `app/globals.css` `:root` — the **light** palette only.
 *
 * There is no dark variant on purpose. `prefers-color-scheme` is honoured by
 * Apple Mail and ignored or partially rewritten by Gmail and Outlook, so a
 * dark block buys inconsistency rather than a second theme. The mail renders
 * as paper in every client; clients that force-invert produce a legible
 * result because the palette is a single hue ramp on near-white.
 */
export const COLOR = {
  paper: "#fbfbfa",
  surface: "#ffffff",
  mutedFill: "#f2f2f0",
  rule: "#e4e4e1",
  ruleStrong: "#c9cac5",
  ink: "#16181a",
  inkMid: "#5f6469",
  inkSoft: "#8e9298",

  phase1: "#d7e4e2",
  phase2: "#a8c6c2",
  phase3: "#6fa29c",
  phase4: "#3d7a74",
  phase5: "#1b5450",
  phase6: "#0f3d3a",

  redline: "#c8382a",
  warn: "#be7100",
} as const;

/**
 * Archivo and JetBrains Mono are webfonts; mail clients that block remote CSS
 * fall back on the stack, so the stack has to be a real design choice rather
 * than a formality. Helvetica/Arial carry the same grotesque proportions.
 */
export const FONT = {
  sans: "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
} as const;

/** Sharp corners throughout — the app uses a 4px radius only on inputs. */
export const RADIUS = "0";

export const WIDTH = 600;

/**
 * Firm details for the footer. Single source so a signature change is one
 * edit rather than four. Swap these for the real values before any send.
 *
 * The footer shows only the firm name — no address, phone or email.
 * `replyTo` is kept for the customer "Reply to your project team" button.
 */
export const FIRM = {
  name: "Merkhet Architecture",
  shortName: "Merkhet",
  replyTo: "studio@merkhet.studio",
} as const;

/**
 * Base URL for internal deep links. Internal mail links to
 * `/?project=<id>`, which the board reads (`lib/board-url.ts`).
 *
 * **Customer mail never links here** — clients have no login and never will
 * (WORKFLOW-2 §1), so a link would land them on `/login` with no way through.
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

/**
 * True when internal mail would carry links nobody outside this machine can
 * open. Harmless in a preview; in a real send it is both useless to the
 * recipient and a genuine spam signal — an unresolvable plain-HTTP host in an
 * HTML message is one of the cheaper things a filter can score against.
 */
export const appUrlIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(
  APP_URL,
);

export const projectUrl = (projectId: string) =>
  `${APP_URL}/?project=${encodeURIComponent(projectId)}`;
