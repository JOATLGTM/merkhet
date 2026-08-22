/**
 * Supabase auth mail — the invite and the password reset.
 *
 * These two are unlike every other template here. The app never calls this at
 * request time: Supabase renders auth mail from HTML held in its own dashboard
 * (Authentication → Emails), so what this produces is a **build artefact** —
 * `npm run email:supabase` writes it to `out/emails/`, and someone pastes it
 * into the template editor. Nothing imports it from the send path.
 *
 * That is why the dynamic values are Go template placeholders rather than
 * arguments. GoTrue substitutes them when it sends:
 *
 * | Placeholder             | Becomes                                        |
 * |-------------------------|------------------------------------------------|
 * | `{{ .ConfirmationURL }}`| The one-time link, already carrying `redirectTo`|
 * | `{{ .Email }}`          | The recipient's address                         |
 *
 * Only these two are used. `.Token`, `.TokenHash` and `.SiteURL` exist too,
 * but every one added is another thing to get wrong in a message whose link
 * burns on first use. Placeholders are passed through `esc()` untouched —
 * none of `{`, `}`, `.` or space is escaped — so the ordinary blocks in
 * `layout.ts` can be used as they are.
 *
 * The editor has **one field for HTML and no plain-text part**, so the `text`
 * returned here is reference only: it is what the message would say if it had
 * one, kept so the copy can be read without a browser.
 *
 * Editing the template in Supabase's dashboard directly will be overwritten by
 * the next paste. Edit `AUTH_COPY` in `copy.ts`, re-render, re-paste.
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
  row,
  shell,
  spacer,
} from "@/lib/email/layout";
import { AUTH_COPY, type AuthKind } from "@/lib/email/copy";
import {
  textFooter,
  textLines,
  TEXT_RULE,
  type RenderedEmail,
} from "@/lib/email/render";
import { COLOR, FONT } from "@/lib/email/tokens";

/** GoTrue's one-time link. Never build this by hand. */
const CONFIRMATION_URL = "{{ .ConfirmationURL }}";
/** The address the message is going to. Always set for both templates. */
const EMAIL = "{{ .Email }}";

export type AuthLinkInput = {
  kind: AuthKind;
};

export function renderAuthLink({ kind }: AuthLinkInput): RenderedEmail {
  const copy = AUTH_COPY[kind];
  const preview = copy.lead;

  /**
   * The raw link, repeated as text. Buttons are the first thing a corporate
   * gateway rewrites or strips, and this link cannot be re-sent casually — an
   * invite is single-use, so a recipient who cannot click has no second path
   * unless one is printed.
   */
  const fallback = `
        <div style="font-family:${FONT.sans};font-size:11px;line-height:18px;color:${COLOR.inkSoft};">
          If the button does not work, paste this link into your browser:
          <div style="margin-top:6px;"><a href="${CONFIRMATION_URL}" style="font-family:${FONT.mono};font-size:11px;line-height:17px;color:${COLOR.phase5};text-decoration:underline;word-break:break-all;">${CONFIRMATION_URL}</a></div>
        </div>`;

  const body = [
    row(
      `${eyebrow(copy.eyebrow, COLOR.inkSoft)}${heading(copy.headline)}`,
      "22px 32px 0 32px",
    ),
    row(paragraph(esc(copy.lead), COLOR.ink)),
    row(`${spacer(4)}${metaGrid([{ label: "Account", value: EMAIL }])}`),
    row(button(copy.cta, CONFIRMATION_URL), "6px 32px 0 32px"),
    row(
      callout({
        accent: COLOR.phase5,
        title: copy.noticeTitle,
        body: esc(copy.notice),
      }),
    ),
    row(paragraph(esc(copy.unexpected), COLOR.inkSoft)),
    row(`${divider()}${spacer(16)}${fallback}`, "0 32px 26px 32px"),
  ].join("");

  const html = shell({
    title: copy.subject,
    preview,
    audience: "account",
    accent: COLOR.phase5,
    body,
  });

  const text = textLines(
    copy.headline.toUpperCase(),
    TEXT_RULE,
    `Account: ${EMAIL}`,
    "",
    copy.lead,
    "",
    `${copy.cta}: ${CONFIRMATION_URL}`,
    "",
    copy.noticeTitle.toUpperCase(),
    copy.notice,
    "",
    copy.unexpected,
    textFooter("account"),
  );

  return { subject: copy.subject, preview, html, text };
}
