/**
 * Shared HTML primitives for every Merkhet email.
 *
 * Everything here is table-based with inline styles. That is not stylistic
 * conservatism: Outlook renders through Word, which has no flexbox, no grid,
 * no `max-width` on divs and no reliable `padding` on block elements. Tables
 * with explicit widths are the one layout model that survives all of it.
 *
 * The `<style>` block in `shell()` carries mobile rules only, and nothing in
 * it is load-bearing — a client that drops it still gets a correct 600px
 * layout.
 */
import { COLOR, FIRM, FONT, WIDTH } from "@/lib/email/tokens";

/** Escape interpolated values. Project and customer names are user input. */
export function esc(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Preheader — the grey line the inbox shows after the subject. Left unset it
 * fills with whatever text comes first, which here is the wordmark, so every
 * mail would preview as "MERKHET Merkhet Architecture". The trailing entities
 * push the real body content out of the preview window.
 *
 * Deliberately restrained. Stacking `opacity:0` and a paper-coloured
 * foreground on top of `display:none`, then padding with hundreds of
 * invisible characters, is how commercial senders do this — and it reads to a
 * spam filter as hidden-text stuffing, because that is what the technique is.
 * One hiding method and a short pad get the same preview line without the
 * heuristic.
 */
function preheader(text: string): string {
  const pad = "&zwnj;&nbsp;".repeat(20);
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">${esc(text)}${pad}</div>`;
}

function wordmark(): string {
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="26" height="26" align="center" valign="middle" style="width:26px;height:26px;background-color:${COLOR.phase5};font-family:${FONT.sans};font-size:15px;font-weight:600;line-height:26px;color:#ffffff;">M</td>
          <td width="10" style="width:10px;">&nbsp;</td>
          <td valign="middle" style="font-family:${FONT.sans};font-size:12px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${COLOR.ink};">Merkhet</td>
        </tr>
      </table>`;
}

function footer(audience: "internal" | "customer"): string {
  const lines =
    audience === "customer"
      ? [
          `${FIRM.name}`,
          ...FIRM.addressLines,
          `${FIRM.phone} &middot; ${FIRM.replyTo}`,
        ]
      : [
          `${FIRM.name} &middot; internal project tracking`,
          `You receive this because you are assigned to this project or subscribed to this phase.`,
        ];

  const note =
    audience === "customer"
      ? `Replying to this message reaches your project team directly.`
      : `Sent automatically when a project changes phase.`;

  return `
      <tr>
        <td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td height="1" style="height:1px;line-height:1px;font-size:0;background-color:${COLOR.rule};">&nbsp;</td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 32px 32px 32px;font-family:${FONT.sans};font-size:11px;line-height:18px;color:${COLOR.inkSoft};">
          ${lines.join(`<br />`)}
          <div style="margin-top:10px;">${note}</div>
        </td>
      </tr>`;
}

export type ShellInput = {
  title: string;
  preview: string;
  audience: "internal" | "customer";
  /** Accent stripe across the top — the phase colour, or redline on rework. */
  accent: string;
  body: string;
};

/** Wraps rendered body rows in the full document. */
export function shell({ title, preview, audience, accent, body }: ShellInput): string {
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="x-ua-compatible" content="ie=edge" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(title)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  /* Mobile only. Nothing here is required for a correct desktop render. */
  @media only screen and (max-width:620px) {
    .m-pad { padding-left:20px !important; padding-right:20px !important; }
    .m-stack { display:block !important; width:100% !important; }
    .m-stack + .m-stack { padding-top:14px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${COLOR.paper};-webkit-font-smoothing:antialiased;">
${preheader(preview)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.paper};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:${WIDTH}px;max-width:100%;background-color:${COLOR.surface};border:1px solid ${COLOR.rule};">
        <tr><td height="3" style="height:3px;line-height:3px;font-size:0;background-color:${accent};">&nbsp;</td></tr>
        <tr>
          <td class="m-pad" style="padding:24px 32px 0 32px;">${wordmark()}</td>
        </tr>
${body}
${footer(audience)}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/* ---------------------------------------------------------------- blocks -- */

/** Uppercase micro-label. Mirrors `.label-caps` in `app/globals.css`. */
export function eyebrow(text: string, color: string = COLOR.inkSoft): string {
  return `<div style="font-family:${FONT.sans};font-size:10px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:${color};">${esc(text)}</div>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:10px 0 0 0;font-family:${FONT.sans};font-size:24px;line-height:30px;font-weight:600;letter-spacing:-0.3px;color:${COLOR.ink};">${esc(text)}</h1>`;
}

export function paragraph(html: string, color: string = COLOR.inkMid): string {
  return `<p style="margin:14px 0 0 0;font-family:${FONT.sans};font-size:14px;line-height:22px;color:${color};">${html}</p>`;
}

/** Full-bleed body row. Every block in a template goes through this. */
export function row(inner: string, padding = "20px 32px 0 32px"): string {
  return `
      <tr>
        <td class="m-pad" style="padding:${padding};">${inner}</td>
      </tr>`;
}

export function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr><td height="1" style="height:1px;line-height:1px;font-size:0;background-color:${COLOR.rule};">&nbsp;</td></tr></table>`;
}

export function spacer(px: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="${px}" style="height:${px}px;line-height:${px}px;font-size:0;">&nbsp;</td></tr></table>`;
}

/**
 * The project identity block: number in mono, name, customer. The mono
 * treatment of `project_number` matches the board card and the detail sheet.
 */
export function projectHeader(input: {
  projectNumber: string;
  projectName: string;
  customerName?: string;
}): string {
  const customer = input.customerName
    ? `<div style="margin-top:4px;font-family:${FONT.sans};font-size:13px;line-height:20px;color:${COLOR.inkMid};">${esc(input.customerName)}</div>`
    : "";
  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.mutedFill};border:1px solid ${COLOR.rule};">
          <tr>
            <td style="padding:14px 16px;">
              <div style="font-family:${FONT.mono};font-size:11px;letter-spacing:0.6px;color:${COLOR.phase5};">${esc(input.projectNumber)}</div>
              <div style="margin-top:5px;font-family:${FONT.sans};font-size:16px;font-weight:600;line-height:22px;color:${COLOR.ink};">${esc(input.projectName)}</div>
              ${customer}
            </td>
          </tr>
        </table>`;
}

export type MetaItem = { label: string; value: string; accent?: string };

/**
 * Two-column label/value grid. Rendered as paired cells rather than a
 * definition list so Outlook keeps the columns aligned; collapses to one
 * column under 620px via `.m-stack`.
 */
export function metaGrid(items: MetaItem[]): string {
  if (items.length === 0) return "";
  const cell = (item: MetaItem) => `
              <td class="m-stack" width="50%" valign="top" style="width:50%;padding:0 0 14px 0;">
                <div style="font-family:${FONT.sans};font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${COLOR.inkSoft};">${esc(item.label)}</div>
                <div style="margin-top:4px;font-family:${FONT.sans};font-size:14px;line-height:20px;color:${item.accent ?? COLOR.ink};">${esc(item.value)}</div>
              </td>`;

  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const left = cell(items[i]);
    const right = items[i + 1]
      ? cell(items[i + 1])
      : `<td class="m-stack" width="50%" style="width:50%;">&nbsp;</td>`;
    rows.push(`<tr>${left}${right}</tr>`);
  }

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${rows.join("\n          ")}
        </table>`;
}

/**
 * Bulletproof button. The VML block is what gives Outlook a filled rectangle
 * instead of a bare underlined link.
 */
export function button(label: string, href: string): string {
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="background-color:${COLOR.phase5};">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:40px;v-text-anchor:middle;width:220px;" arcsize="0%" strokecolor="${COLOR.phase5}" fillcolor="${COLOR.phase5}">
                <w:anchorlock/><center style="color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;">${esc(label)}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${href}" style="display:inline-block;padding:12px 26px;font-family:${FONT.sans};font-size:13px;font-weight:600;letter-spacing:0.2px;line-height:16px;color:#ffffff;text-decoration:none;">${esc(label)}</a>
              <!--<![endif]-->
            </td>
          </tr>
        </table>`;
}

/** Left-ruled callout. Used for rework reasons and gate instructions. */
export function callout(input: {
  accent: string;
  title: string;
  body: string;
}): string {
  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.mutedFill};">
          <tr>
            <td width="3" style="width:3px;background-color:${input.accent};font-size:0;line-height:0;">&nbsp;</td>
            <td style="padding:14px 16px;">
              <div style="font-family:${FONT.sans};font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${input.accent};">${esc(input.title)}</div>
              <div style="margin-top:6px;font-family:${FONT.sans};font-size:14px;line-height:21px;color:${COLOR.ink};">${input.body}</div>
            </td>
          </tr>
        </table>`;
}

/** Checklist of sign-offs, rendered as rows with a state marker. */
export function checklist(
  items: Array<{ label: string; done: boolean; note?: string }>,
): string {
  const rows = items
    .map((item) => {
      const mark = item.done ? "&#10003;" : "&#9675;";
      const color = item.done ? COLOR.phase5 : COLOR.inkSoft;
      const weight = item.done ? "400" : "600";
      const note = item.note
        ? `<span style="color:${COLOR.inkSoft};"> &middot; ${esc(item.note)}</span>`
        : "";
      return `
            <tr>
              <td width="20" valign="top" style="width:20px;padding:5px 0;font-family:${FONT.sans};font-size:14px;line-height:20px;color:${color};">${mark}</td>
              <td valign="top" style="padding:5px 0;font-family:${FONT.sans};font-size:14px;line-height:20px;font-weight:${weight};color:${item.done ? COLOR.inkMid : COLOR.ink};">${esc(item.label)}${note}</td>
            </tr>`;
    })
    .join("");

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}
        </table>`;
}
